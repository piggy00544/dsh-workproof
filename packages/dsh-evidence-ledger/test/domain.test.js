import test from 'node:test';
import assert from 'node:assert/strict';

const domain = await import('../src/domain.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const NOW = '2026-10-04T00:00:00Z';
const LATER = '2026-10-04T00:01:00Z';
const empty = () => {
  assert.equal(typeof domain.createLedger, 'function', 'domain implementation is absent');
  return domain.createLedger(NOW);
};
const source = (ledger, changes = {}, id = 'source1') => domain.saveSource(ledger, {
  expectedVersion: ledger.version, title: 'Synthetic reference', sourceKind: 'public_url',
  reference: 'https://example.invalid/reference', locator: 'Section 1', ...changes,
}, { now: NOW, id });
const claim = (ledger, changes = {}, id = 'claim1') => domain.saveClaim(ledger, {
  expectedVersion: ledger.version, text: 'A synthetic assertion', claimKind: 'fact_assertion',
  links: [{ sourceId: 'source1', relation: 'supports' }], ...changes,
}, { now: NOW, id });
const question = (ledger, changes = {}, id = 'question1') => domain.saveQuestion(ledger, {
  expectedVersion: ledger.version, question: 'What is still unknown?', claimId: 'claim1', ...changes,
}, { now: NOW, id });

test('empty ledger starts at version zero without verification or review claims', () => {
  const ledger = empty();
  assert.equal(ledger.version, 0);
  assert.deepEqual(ledger.sources, []);
  assert.deepEqual(ledger.claims, []);
  assert.deepEqual(ledger.questions, []);
  assert.equal(ledger.review, null);
  assert.deepEqual(ledger.history, []);
  assert.deepEqual(domain.inspectLedger(ledger), { ledger, issues: [] });
});

test('source, claim and question saves are pure versioned edits with stable IDs', () => {
  const original = empty();
  const first = source(original);
  const second = claim(first);
  const third = question(second);
  assert.equal(original.version, 0);
  assert.equal(third.version, 3);
  assert.equal(third.sources[0].id, 'source1');
  assert.equal(third.claims[0].claimKind, 'fact_assertion');
  assert.equal(third.questions[0].status, 'open');
  const updated = source(third, { id: 'source1', title: 'Revised title' }, 'unused');
  assert.equal(updated.sources.length, 1);
  assert.equal(updated.sources[0].title, 'Revised title');
  assert.equal(third.sources[0].title, 'Synthetic reference');
  updated.claims[0].links[0].relation = 'context';
  assert.equal(third.claims[0].links[0].relation, 'supports');
});

test('stale versions, nonexistent updates and generated ID collisions are rejected', () => {
  const ledger = source(empty());
  assert.throws(() => source(ledger, { expectedVersion: 0 }), /version/i);
  assert.throws(() => source(ledger, { id: 'missing' }), /exist/i);
  assert.throws(() => source(ledger), /collision|exist/i);
  assert.throws(() => source(ledger, {}, 'unsafe/id'), /id/i);
});

test('all three edit types invalidate review while bounded history retains the old decision', () => {
  const ledger = question(claim(source(empty())));
  const reviewed = domain.reviewLedger(ledger, { expectedVersion: 3, status: 'reviewed', note: 'Read this version' }, LATER);
  assert.equal(reviewed.version, 3);
  assert.equal(reviewed.review.version, 3);
  for (const edit of [
    value => domain.saveSource(value, { expectedVersion: 3, id: 'source1', title: 'Changed', sourceKind: 'public_url', reference: 'https://example.invalid/other' }, { now: LATER }),
    value => domain.saveClaim(value, { expectedVersion: 3, id: 'claim1', text: 'Changed', claimKind: 'inference', links: [] }, { now: LATER }),
    value => domain.saveQuestion(value, { expectedVersion: 3, id: 'question1', question: 'Changed', status: 'open' }, { now: LATER }),
  ]) {
    const next = edit(reviewed);
    assert.equal(next.version, 4);
    assert.equal(next.review, null);
    assert.ok(next.history.some(item => item.type === 'review' && item.status === 'reviewed' && item.version === 3));
  }
  assert.equal(reviewed.review.status, 'reviewed');
});

test('reference relations enforce existing sources and unique source IDs', () => {
  const ledger = source(empty());
  for (const links of [
    [{ sourceId: 'missing', relation: 'supports' }],
    [{ sourceId: 'source1', relation: 'verified' }],
    [{ sourceId: 'source1', relation: 'supports' }, { sourceId: 'source1', relation: 'contradicts' }],
    [{ sourceId: 'source1', relation: 'supports', invented: true }],
  ]) assert.throws(() => claim(ledger, { links }), /source|relation|field|link/i);
  assert.throws(() => question(ledger, { claimId: 'missing' }), /claim/i);
});

test('resolved questions need an explanation and can explicitly remove their claim association', () => {
  const ledger = claim(source(empty()));
  assert.throws(() => question(ledger, { status: 'resolved', resolution: ' ' }), /resolution/i);
  const next = question(ledger, { status: 'resolved', resolution: 'Scope narrowed, not truth established.' });
  assert.equal(next.questions[0].status, 'resolved');
  const unlinked = domain.saveQuestion(next, { expectedVersion: 3, id: 'question1', question: 'Follow-up', status: 'open' }, { now: NOW });
  assert.equal(unlinked.questions[0].claimId, undefined);
});

test('issues report structural gaps and contradictions rather than truth scores', () => {
  let ledger = source(empty(), { locator: '' });
  ledger = claim(ledger, { links: [] });
  ledger = claim(ledger, { claimKind: 'inference', links: [{ sourceId: 'source1', relation: 'contradicts' }] }, 'claim2');
  ledger = question(ledger);
  const result = domain.inspectLedger(ledger);
  assert.deepEqual(new Set(result.issues.map(item => item.type)), new Set(['assertion_without_source', 'source_without_locator', 'recorded_contradiction', 'open_question']));
  assert.equal(result.ledger.verified, undefined);
  assert.equal(result.ledger.score, undefined);
});

test('public URLs reject unsafe protocols, credentials and controls; local references never need to exist', () => {
  for (const reference of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.invalid/', 'https://example.invalid/\nsecret', 'http:', 'ftp://example.invalid/']) {
    assert.throws(() => source(empty(), { reference }), /reference|URL/i);
  }
  for (const reference of ['/private/note.md', '../secret', 'a/../b', 'C:note', 'a\\b', 'a//b', 'a\0b']) {
    assert.throws(() => source(empty(), { sourceKind: 'local_reference', reference }), /reference|path/i);
  }
  assert.equal(source(empty(), { sourceKind: 'local_reference', reference: 'never-read/nonexistent.md' }).sources[0].reference, 'never-read/nonexistent.md');
});

test('wrong types, unknown fields, sparse arrays and implicit null defaults are rejected', () => {
  for (const locator of [null, false, 0, []]) assert.throws(() => source(empty(), { locator }), /locator/i);
  for (const excerpt of [null, false, 0, []]) assert.throws(() => source(empty(), { excerpt }), /excerpt/i);
  const ledger = source(empty());
  for (const links of [null, false, '', Array(1)]) assert.throws(() => claim(ledger, { links }), /link/i);
  assert.throws(() => source(ledger, { extra: true }), /field/i);
  assert.throws(() => claim(ledger, { links: [], claimKind: 'fact' }), /kind/i);
  assert.throws(() => question(ledger, { claimId: null }), /claim/i);
  assert.throws(() => question(ledger, { status: null }), /status/i);
  assert.throws(() => domain.reviewLedger(ledger, { expectedVersion: 1, status: 'reviewed', note: null }, NOW), /note/i);
  for (const field of ['sources', 'claims', 'questions', 'history']) assert.throws(() => domain.validateLedger({ ...ledger, [field]: Array(1) }), /array|sparse|entry|object|source|claim|question|history/i);
});

test('text and collection limits are enforced including links and questions', () => {
  for (const changes of [{ title: 'x'.repeat(201) }, { reference: 'x'.repeat(2001) }, { locator: 'x'.repeat(301) }, { excerpt: 'x'.repeat(501) }]) assert.throws(() => source(empty(), changes));
  const ledger = source(empty());
  assert.throws(() => claim(ledger, { text: 'x'.repeat(2001) }), /text/i);
  assert.throws(() => claim(ledger, { links: Array(21).fill({ sourceId: 'source1', relation: 'context' }) }), /link/i);
  assert.throws(() => question(ledger, { question: 'x'.repeat(1001) }), /question/i);
  assert.throws(() => question(ledger, { resolution: 'x'.repeat(1001) }), /resolution/i);
  assert.throws(() => domain.reviewLedger(ledger, { expectedVersion: 1, status: 'reviewed', note: 'x'.repeat(2001) }, NOW), /note/i);
  const with100Sources = { ...ledger, sources: Array.from({ length: 100 }, (_, i) => ({ ...ledger.sources[0], id: `s${i}` })) };
  assert.throws(() => source(with100Sources, {}, 'one_more'), /limit/i);
  const with100Claims = { ...ledger, claims: Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, text: 'Synthetic', claimKind: 'proposal', links: [] })) };
  assert.throws(() => claim(with100Claims), /limit/i);
  const with50Questions = { ...ledger, questions: Array.from({ length: 50 }, (_, i) => ({ id: `q${i}`, question: 'Synthetic?', status: 'open', resolution: '' })) };
  assert.throws(() => question(with50Questions, { claimId: undefined }), /limit/i);
});

test('persisted ledgers reject duplicate IDs, dangling links, invalid review versions and dates', () => {
  const ledger = claim(source(empty()));
  for (const changed of [
    { sources: [ledger.sources[0], ledger.sources[0]] },
    { sources: [] },
    { review: { status: 'reviewed', note: '', at: NOW, version: 1 } },
    { createdAt: '2026-02-30T00:00:00Z' },
    { version: -1 },
    { extra: 'not canonical' },
  ]) assert.throws(() => domain.validateLedger({ ...ledger, ...changed }));
  assert.throws(() => domain.reviewLedger(ledger, { expectedVersion: 2, status: 'reviewed' }, '2026-10-03T00:00:00Z'), /time/i);
});

test('history retains at most 100 events and records are detached from callers', () => {
  let ledger = source(empty());
  for (let i = 0; i < 105; i += 1) ledger = source(ledger, { id: 'source1', title: `Change ${i}` });
  assert.equal(ledger.version, 106);
  assert.equal(ledger.history.length, 100);
  const view = domain.inspectLedger(ledger);
  view.ledger.sources[0].title = 'Changed in result';
  assert.equal(ledger.sources[0].title, 'Change 104');
});

test('selected export includes related sources and questions only, omitting private fields by default', () => {
  let ledger = source(empty(), { sourceKind: 'local_reference', reference: 'private/selection.md', excerpt: 'Sensitive excerpt' });
  ledger = source(ledger, { title: 'Unrelated source', reference: 'https://example.invalid/unrelated' }, 'source2');
  ledger = claim(ledger);
  ledger = claim(ledger, { text: 'Unselected claim', links: [{ sourceId: 'source2', relation: 'supports' }] }, 'claim2');
  ledger = question(ledger, { question: 'Selected question?' });
  ledger = question(ledger, { question: 'Unrelated question?', claimId: 'claim2' }, 'question2');
  ledger = domain.reviewLedger(ledger, { expectedVersion: 6, status: 'reviewed', note: 'Sensitive review note' }, NOW);
  const markdown = domain.exportLedger(ledger, { claimIds: ['claim1'] });
  assert.match(markdown, /Selected question/);
  assert.doesNotMatch(markdown, /Unselected claim|Unrelated source|Unrelated question|Sensitive excerpt|Sensitive review note|private/);
  assert.match(markdown, /not.*verif|not.*truth/i);
  assert.match(markdown, /not.*publication|not.*delivery/i);
  const full = domain.exportLedger(ledger, { claimIds: ['claim1'], includeExcerpts: true, includeReviewNotes: true, includeLocalReferences: true });
  assert.match(full, /Sensitive excerpt|Sensitive review note/);
  assert.match(full, /private&#47;selection&#46;md/);
});

test('export requires a real nonempty unique dense selection and boolean inclusion flags', () => {
  const ledger = claim(source(empty()));
  for (const claimIds of [undefined, null, [], Array(1), ['missing'], ['claim1', 'claim1']]) assert.throws(() => domain.exportLedger(ledger, { claimIds }), /claim|select|array|sparse/i);
  for (const includeExcerpts of [null, 1, 'true']) assert.throws(() => domain.exportLedger(ledger, { claimIds: ['claim1'], includeExcerpts }), /includeExcerpts|boolean/i);
  assert.throws(() => domain.exportLedger(ledger, { claimIds: ['claim1'], all: true }), /field/i);
});

test('exports escape Markdown, HTML and control syntax instead of executing recorded material', () => {
  const ledger = claim(source(empty(), { title: '<script>bad</script>', locator: '`x`' }), {
    text: '# Heading\n<script>x</script>\n::code-comment{title="bad"}\u001b',
    links: [{ sourceId: 'source1', relation: 'contradicts' }],
  });
  const markdown = domain.exportLedger(ledger, { claimIds: ['claim1'] });
  assert.doesNotMatch(markdown, /<script>|\n::code-comment|\u001b|\n# Heading/);
  assert.match(markdown, /https/);
  assert.match(markdown, /contradicts/);
});
