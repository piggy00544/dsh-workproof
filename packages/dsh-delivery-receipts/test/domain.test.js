import test from 'node:test';
import assert from 'node:assert/strict';

const domain = await import('../src/domain.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const NOW = '2026-10-04T00:00:00Z';
const LATER = '2026-10-04T00:01:00Z';
const observed = (path = 'report.md', sha256 = 'a'.repeat(64), size = 10) => ({ path, status: 'ok', size, sha256 });
const input = (changes = {}) => ({ id: 'receipt_1', title: 'Report', paths: ['report.md'], checks: ['Totals checked'], now: NOW, ...changes });
const create = (changes = {}, observations = [observed()]) => {
  assert.equal(typeof domain.createReceipt, 'function', 'createReceipt must be implemented');
  return domain.createReceipt(input(changes), observations);
};

test('creates a separate durable snapshot with explicitly agent-sourced claims', () => {
  const args = input();
  const observations = [observed()];
  assert.equal(typeof domain.createReceipt, 'function', 'createReceipt must be implemented');
  const receipt = domain.createReceipt(args, observations);
  assert.equal(receipt.version, 1);
  assert.equal(receipt.claimsSource, 'agent');
  assert.equal(receipt.createdAt, '2026-10-04T00:00:00.000Z');
  assert.equal(receipt.decision, null);
  assert.deepEqual(receipt.baseline, observations);
  const view = domain.inspectReceipt(receipt, observations);
  assert.equal(view.state, 'review_required');
  assert.deepEqual(view.claims, { source: 'agent', title: 'Report', paths: ['report.md'], checks: ['Totals checked'] });
  observations[0].sha256 = 'f'.repeat(64);
  args.paths.push('elsewhere.md');
  view.artifacts[0].baseline.sha256 = 'e'.repeat(64);
  assert.equal(receipt.baseline[0].sha256, 'a'.repeat(64));
  assert.deepEqual(receipt.paths, ['report.md']);
});

test('acceptance is bound to exact hashes and sizes and does not mutate the original', () => {
  const receipt = create();
  const before = JSON.stringify(receipt);
  const accepted = domain.decideReceipt(receipt, [observed()], { decision: 'accepted', note: 'Ready', now: LATER });
  assert.equal(JSON.stringify(receipt), before);
  assert.equal(domain.inspectReceipt(accepted, [observed()]).state, 'accepted');
  assert.equal(accepted.decision.version, 1);
  assert.equal(domain.inspectReceipt(accepted, [observed('report.md', 'b'.repeat(64))]).state, 'stale');
  assert.equal(domain.inspectReceipt(accepted, [observed('report.md', 'a'.repeat(64), 11)]).state, 'stale');
  assert.throws(() => domain.decideReceipt(receipt, [observed('report.md', 'b'.repeat(64))], { decision: 'accepted', note: '', now: LATER }), /accept|baseline|current/i);
});

test('missing and unverifiable artifacts cannot be accepted', () => {
  const receipt = create();
  assert.equal(domain.inspectReceipt(receipt, [{ path: 'report.md', status: 'missing' }]).state, 'missing');
  for (const status of ['unreadable', 'too_large', 'not_file', 'invalid_path', 'changed']) {
    const current = [{ path: 'report.md', status }];
    assert.equal(domain.inspectReceipt(receipt, current).state, 'unverifiable');
    assert.throws(() => domain.decideReceipt(receipt, current, { decision: 'accepted', now: LATER, note: '' }), /accept|baseline|current/i);
  }
  const missingBaseline = create({}, [{ path: 'report.md', status: 'missing' }]);
  assert.equal(domain.inspectReceipt(missingBaseline, [observed()]).state, 'stale');
});

test('rechecking leaves baseline fixed; explicit refresh advances version and clears acceptance', () => {
  const accepted = domain.decideReceipt(create(), [observed()], { decision: 'accepted', now: NOW, note: '' });
  const nextObservation = observed('report.md', 'b'.repeat(64));
  const original = JSON.stringify(accepted);
  domain.inspectReceipt(accepted, [nextObservation]);
  assert.equal(JSON.stringify(accepted), original);
  const next = domain.refreshReceipt(accepted, [nextObservation], LATER);
  assert.equal(next.version, 2);
  assert.equal(next.decision, null);
  assert.equal(domain.inspectReceipt(next, [nextObservation]).state, 'review_required');
  assert.equal(next.createdAt, accepted.createdAt);
  assert.equal(next.updatedAt, '2026-10-04T00:01:00.000Z');
  assert.equal(JSON.stringify(accepted), original);
  assert.ok(next.history.some((event) => event.type === 'decided' && event.decision === 'accepted'));
});

test('requested changes can be recorded even when evidence is missing', () => {
  const receipt = create();
  const rejected = domain.decideReceipt(receipt, [{ path: 'report.md', status: 'missing' }], { decision: 'changes_requested', note: 'Restore it', now: LATER });
  assert.equal(rejected.decision.decision, 'changes_requested');
  assert.equal(domain.inspectReceipt(rejected, [observed()]).state, 'changes_requested');
  assert.equal(domain.inspectReceipt(rejected, [{ path: 'report.md', status: 'missing' }]).state, 'missing');
});

test('audit history is bounded without retaining mutable references', () => {
  let receipt = create();
  for (let i = 0; i < 115; i += 1) receipt = domain.refreshReceipt(receipt, [observed()], LATER);
  assert.equal(receipt.version, 116);
  assert.equal(receipt.history.length, 100);
  assert.equal(receipt.history.at(-1).version, 116);
});

test('receipt input limits and ISO dates reject invalid claims', () => {
  for (const id of ['', 'a/b', 'x'.repeat(81), 'hello world']) assert.throws(() => create({ id }), /id/i);
  for (const title of ['', ' ', 'x'.repeat(201), 5]) assert.throws(() => create({ title }), /title/i);
  for (const paths of [[], ['report.md', 'report.md'], Array.from({ length: 21 }, (_, i) => `${i}.md`)]) assert.throws(() => create({ paths }), /path/i);
  for (const path of ['../secret', '/tmp/file', 'C:\\temp\\file', 'C:relative', '\\\\server\\file', 'a/../b', './a', 'a//b', 'a\0b', 'a\nb', 'a\\b']) {
    assert.throws(() => create({ paths: [path] }, [{ ...observed(), path }]), /path/i);
  }
  for (const checks of [Array(21).fill('x'), ['x'.repeat(501)], [4], 'not-an-array']) assert.throws(() => create({ checks }), /check/i);
  for (const now of ['yesterday', '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z', '2026-10-04', '2026-10-04T25:00:00Z']) assert.throws(() => create({ now }), /date|time|ISO/i);
  assert.equal(create({ now: '2026-10-04T00:00:00.1Z' }).createdAt, '2026-10-04T00:00:00.100Z');
});

test('sparse paths are rejected before observations can legitimize an undefined path', () => {
  assert.throws(() => create({ paths: Array(1) }, [{ ...observed(), path: undefined }]), /path/i);
});

test('sparse checks are rejected instead of becoming unchecked holes', () => {
  assert.throws(() => create({ checks: Array(1) }), /check/i);
  const checks = ['A declared check', 'Another check'];
  delete checks[1];
  assert.throws(() => create({ checks }), /check/i);
});

test('sparse persisted history is rejected when a receipt is inspected', () => {
  assert.throws(() => domain.inspectReceipt({ ...create(), history: Array(1) }, [observed()]), /history/i);
});

test('checks default only when undefined and reject null or wrong types', () => {
  assert.deepEqual(create({ checks: undefined }).checks, []);
  for (const checks of [null, false, 0, '', {}]) assert.throws(() => create({ checks }), /check/i);
});

test('decision notes default only when undefined and reject null or wrong types', () => {
  const receipt = create();
  assert.equal(domain.decideReceipt(receipt, [observed()], { decision: 'accepted', now: NOW }).decision.note, '');
  for (const note of [null, false, 0, [], {}]) {
    assert.throws(() => domain.decideReceipt(receipt, [observed()], { decision: 'accepted', note, now: NOW }), /note/i);
  }
});

test('observations must cover exactly the declared paths and contain valid evidence', () => {
  for (const observations of [[], [observed(), observed()], [observed('different.md')], [observed(), observed('extra.md')], [{ ...observed(), sha256: 'nope' }], [{ ...observed(), size: -1 }], [{ path: 'report.md', status: 'ok' }], [{ ...observed(), status: 'unknown' }], [{ path: 'report.md', status: 'missing', sha256: 'nope' }]]) {
    assert.throws(() => create({}, observations), /observation|hash|size|path|status/i);
  }
  const two = create({ paths: ['a.md', 'b.md'] }, [observed('b.md'), observed('a.md')]);
  assert.deepEqual(two.baseline.map((entry) => entry.path), ['a.md', 'b.md']);
  assert.throws(() => domain.inspectReceipt(create(), [observed('other.md')]), /observation|path/i);
});

test('decision and persisted receipt validation reject tampering and invalid state', () => {
  const receipt = create();
  assert.throws(() => domain.decideReceipt(receipt, [observed()], { decision: 'done', note: '', now: NOW }), /decision/i);
  assert.throws(() => domain.decideReceipt(receipt, [observed()], { decision: 'accepted', note: 'x'.repeat(2001), now: NOW }), /note/i);
  for (const changed of [{ version: 0 }, { claimsSource: 'verified' }, { history: Array(101).fill({ type: 'created', at: NOW, version: 1 }) }, { decision: { decision: 'accepted', note: '', at: NOW, version: 99 } }]) {
    assert.throws(() => domain.inspectReceipt({ ...receipt, ...changed }, [observed()]), /version|source|history|decision/i);
  }
  assert.throws(() => domain.refreshReceipt(receipt, [observed()], '2026-10-03T00:00:00Z'), /time|date|before/i);
});

test('Markdown is a bounded local receipt that neutralizes structural and HTML injection', () => {
  const path = '![photo](https:evil).md';
  const receipt = create({ title: '# Unsafe\n<script>alert(1)</script>\u001b', paths: [path], checks: ['> checked\n:::injected', '[click](https://bad.invalid)'] }, [observed(path)]);
  const decided = domain.decideReceipt(receipt, [observed(path)], { decision: 'changes_requested', note: '<img src=x onerror=x>\n```html\n::code-comment{title="x"}', now: LATER });
  const markdown = domain.receiptMarkdown(domain.inspectReceipt(decided, [observed(path)]));
  assert.match(markdown, /claims are not independent verification/i);
  assert.match(markdown, /local export is not external delivery/i);
  assert.match(markdown, /may still contain sensitive/i);
  assert.doesNotMatch(markdown, /<script>|<img|\u001b|\n```html|\n:::|::code-comment\{/);
  assert.doesNotMatch(markdown, /!\[photo\]\(https:evil\)|\[click\]\(https:\/\/bad/);
  assert.doesNotMatch(markdown, /\/Users\/|cwd|raw file contents/i);
  assert.match(markdown, /changes_requested/);
  assert.throws(() => domain.receiptMarkdown({ ...domain.inspectReceipt(decided, [observed(path)]), paths: ['/private/file.md'] }), /path/i);
});
