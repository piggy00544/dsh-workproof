import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/service.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const NOW = '2026-10-04T00:00:00Z';
function fixture(options = {}) {
  assert.equal(typeof module.createService, 'function', 'service implementation is absent');
  const rows = new Map();
  let count = 0;
  const table = { get: key => rows.get(key), put: async (key, row) => { rows.set(key, structuredClone(row)); } };
  return { rows, service: module.createService({ table, id: () => `id${++count}`, now: () => NOW, ...options }), owner: { sessionId: 'synthetic-session', cwd: '/synthetic-workspace' } };
}
const sourceInput = changes => ({ action: 'save_source', expectedVersion: 0, title: 'Synthetic source', sourceKind: 'local_reference', reference: 'not-read.md', ...changes });
const claimInput = changes => ({ action: 'save_claim', expectedVersion: 1, text: 'Synthetic claim', claimKind: 'fact_assertion', links: [{ sourceId: 'id1', relation: 'supports' }], ...changes });

test('inspection is read-only, has a stable empty shape, and performs no local content read', async () => {
  const { service, rows, owner } = fixture();
  assert.deepEqual((await service.tool(owner, { action: 'inspect' })).ledger.sources, []);
  assert.equal(rows.size, 0);
  const saved = await service.tool(owner, sourceInput());
  assert.equal(saved.ledger.version, 1);
  assert.equal(saved.ledger.sources[0].reference, 'not-read.md');
  assert.equal(rows.size, 1);
});

test('full host flow supports versioned edits, user review, safe export and invalidation', async () => {
  const { service, owner } = fixture();
  await service.tool(owner, sourceInput({ excerpt: 'Sensitive excerpt' }));
  await service.tool(owner, claimInput());
  const reviewed = await service.command(owner, { action: 'review', expectedVersion: 2, status: 'reviewed', note: 'Sensitive note' });
  assert.equal(reviewed.ledger.review.status, 'reviewed');
  const exported = await service.tool(owner, { action: 'export', claimIds: ['id2'] });
  assert.doesNotMatch(exported.markdown, /Sensitive|not-read/);
  const explicit = await service.command(owner, { action: 'export', claimIds: ['id2'], includeExcerpts: true, includeReviewNotes: true, includeLocalReferences: true });
  assert.match(explicit.markdown, /Sensitive excerpt/);
  const next = await service.tool(owner, { action: 'save_question', expectedVersion: 2, question: 'Unknown?', claimId: 'id2' });
  assert.equal(next.ledger.review, null);
  assert.equal(next.ledger.version, 3);
});

test('agent cannot review or enable sensitive export fields', async () => {
  const { service, owner, rows } = fixture();
  await assert.rejects(service.tool(owner, { action: 'review', expectedVersion: 0, status: 'reviewed' }), /user/i);
  await assert.rejects(service.tool(owner, { action: 'export', claimIds: ['anything'], includeExcerpts: true }), /field|user/i);
  assert.equal(rows.size, 0);
});

test('unknown fields and optional null or falsy wrong types cannot be erased by adapters', async () => {
  const { service, owner, rows } = fixture();
  for (const extra of [{ root: '/etc' }, { sessionId: 'elsewhere' }, { id: null }, { locator: null }, { excerpt: false }, { expectedVersion: undefined }]) {
    await assert.rejects(service.command(owner, sourceInput(extra)));
  }
  await service.tool(owner, sourceInput());
  for (const links of [null, false, '', Array(1)]) await assert.rejects(service.tool(owner, claimInput({ links })));
  assert.equal(rows.size, 1);
  assert.equal((await service.tool(owner, { action: 'inspect' })).ledger.version, 1);
});

test('session and workspace identity isolate reads and writes without caller-owned storage keys', async () => {
  const { service, owner } = fixture();
  await service.tool(owner, sourceInput());
  for (const other of [{ ...owner, sessionId: 'other-session' }, { ...owner, cwd: '/other-workspace' }]) {
    assert.equal((await service.tool(other, { action: 'inspect' })).ledger.version, 0);
    await assert.rejects(service.command(other, sourceInput({ expectedVersion: 1, id: 'id1' })), /version/i);
  }
  await assert.rejects(service.tool({ ...owner, cwd: 'relative' }, { action: 'inspect' }), /local|workspace/i);
  await assert.rejects(service.tool(owner, { action: 'inspect', key: 'other' }), /field/i);
});

test('same-version concurrent saves serialize and reject stale overwrite', async () => {
  const { service, owner } = fixture();
  const results = await Promise.allSettled([
    service.tool(owner, sourceInput()),
    service.tool(owner, sourceInput()),
  ]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter(item => item.status === 'rejected').length, 1);
  assert.equal((await service.tool(owner, { action: 'inspect' })).ledger.sources.length, 1);
});

test('queued actions snapshot their input instead of following later caller mutation', async () => {
  const { service, owner } = fixture();
  const input = sourceInput();
  const promise = service.tool(owner, input);
  input.reference = 'private/mutated.md';
  assert.equal((await promise).ledger.sources[0].reference, 'not-read.md');
});

test('every persisted write validates canonical schema and invalid stored data fails closed', async () => {
  const { service, owner, rows } = fixture();
  await service.tool(owner, sourceInput());
  const [key, row] = [...rows.entries()][0];
  rows.set(key, { ...row, ledger: { ...row.ledger, sources: Array(1) } });
  await assert.rejects(service.tool(owner, { action: 'inspect' }), /sparse|source|array/i);
  await assert.rejects(service.tool(owner, sourceInput({ expectedVersion: 1 })), /sparse|source|array/i);
});

test('storage failures do not advance ledger and aborted work does not write', async () => {
  const { service, owner, rows } = fixture();
  await assert.rejects(service.tool(owner, sourceInput(), AbortSignal.abort()));
  assert.equal(rows.size, 0);
  const failing = fixture({ table: { get: () => undefined, put: async () => { throw new Error('Synthetic storage failure'); } } });
  await assert.rejects(failing.service.tool(failing.owner, sourceInput()), /storage failure/i);
  assert.equal((await failing.service.tool(failing.owner, { action: 'inspect' })).ledger.version, 0);
});

test('stored row ownership is validated even if a table returns the wrong row', async () => {
  const { service, owner, rows } = fixture();
  await service.tool(owner, sourceInput());
  const [key, row] = [...rows.entries()][0];
  rows.set(key, { ...row, sessionId: 'other' });
  await assert.rejects(service.tool(owner, { action: 'inspect' }), /owner|session/i);
});
