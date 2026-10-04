import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const module = await import('../src/service.js').catch(() => ({}));
const createService = module.createService;

test('service exposes a shared host operation implementation', () => {
  assert.equal(typeof createService, 'function');
});

async function fixture(t) {
  assert.equal(typeof createService, 'function', 'service implementation is absent');
  const root = await mkdtemp(join(tmpdir(), 'workproof-service-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'report.md'), 'Synthetic report version 1');
  const rows = new Map();
  const table = { get: id => rows.get(id), entries: () => rows.entries(), put: async (id, value) => rows.set(id, structuredClone(value)) };
  let counter = 0;
  const service = createService({ table, id: () => `r${++counter}`, now: () => '2026-10-04T00:00:00Z' });
  return { root, rows, service, owner: { sessionId: 'session-a', cwd: root } };
}

test('record, check, user acceptance, content change and refresh preserve evidence boundaries', async t => {
  const { root, service, owner } = await fixture(t);
  const first = await service.tool(owner, { action: 'record', title: 'Report', paths: ['report.md'], checks: ['Agent says checks passed'] });
  assert.equal(first.view.state, 'review_required');
  assert.equal(first.view.claims.source, 'agent');
  const id = first.view.id;
  const accepted = await service.command(owner, { action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: 'Reviewed' });
  assert.equal(accepted.view.state, 'accepted');
  await writeFile(join(root, 'report.md'), 'Synthetic report version 2');
  assert.equal((await service.tool(owner, { action: 'inspect', id })).view.state, 'stale');
  await assert.rejects(service.command(owner, { action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }));
  const refreshed = await service.tool(owner, { action: 'refresh', id, expectedVersion: 1 });
  assert.equal(refreshed.view.version, 2);
  assert.equal(refreshed.view.decision, null);
  await assert.rejects(service.command(owner, { action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }), /version|版本/i);
});

test('tool cannot record a user decision or nominate a different workspace', async t => {
  const { service, owner, rows } = await fixture(t);
  await assert.rejects(service.tool(owner, { action: 'decide', id: 'r1', decision: 'accepted' }), /user|用户/i);
  await assert.rejects(service.tool(owner, { action: 'record', title: 'Bad', paths: ['report.md'], cwd: '/etc' }), /field|字段/i);
  assert.equal(rows.size, 0);
});

test('receipt reads and decisions remain scoped to both session and workspace', async t => {
  const { root, service, owner } = await fixture(t);
  const { view } = await service.tool(owner, { action: 'record', title: 'Report', paths: ['report.md'] });
  const other = { sessionId: 'session-b', cwd: root };
  assert.deepEqual((await service.tool(other, { action: 'list' })).receipts, []);
  await assert.rejects(service.tool(other, { action: 'inspect', id: view.id }), /session|会话/i);
  await assert.rejects(service.command({ ...owner, cwd: tmpdir() }, { action: 'decide', id: view.id, expectedVersion: 1, decision: 'accepted', note: '' }), /session|会话/i);
});

test('list does not reread artifacts and never advertises cached state as current', async t => {
  const { root, service, owner } = await fixture(t);
  await service.tool(owner, { action: 'record', title: 'Report', paths: ['report.md'] });
  await rm(join(root, 'report.md'));
  const result = await service.tool(owner, { action: 'list' });
  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0].state, undefined);
  assert.equal(result.receipts[0].evidenceFreshness, 'recheck_required');
  assert.equal(JSON.stringify(result).includes(root), false);
});

test('preview only reads a file already included in this receipt and export stays local', async t => {
  const { root, service, owner } = await fixture(t);
  await writeFile(join(root, 'private.txt'), 'not selected');
  const { view } = await service.tool(owner, { action: 'record', title: 'Report', paths: ['report.md'] });
  const preview = await service.tool(owner, { action: 'preview', id: view.id, path: 'report.md' });
  assert.match(preview.preview.text, /Synthetic report/);
  await assert.rejects(service.tool(owner, { action: 'preview', id: view.id, path: 'private.txt' }), /receipt|回执/i);
  const out = await service.tool(owner, { action: 'export', id: view.id });
  assert.equal(typeof out.markdown, 'string');
  assert.equal(out.markdown.includes(root), false);
  assert.equal(out.markdown.includes('Synthetic report version 1'), false);
});

test('aborted operations and storage limits fail before mutation', async t => {
  const { service, owner, rows } = await fixture(t);
  const aborted = AbortSignal.abort();
  await assert.rejects(service.tool(owner, { action: 'record', title: 'No', paths: ['report.md'] }, aborted));
  assert.equal(rows.size, 0);
  const bounded = createService({ table: { get: id => rows.get(id), entries: () => rows.entries(), put: async (id, row) => rows.set(id, row) }, maxReceipts: 1, id: () => 'limit' });
  await bounded.tool(owner, { action: 'record', title: 'One', paths: ['report.md'] });
  await assert.rejects(bounded.tool(owner, { action: 'record', title: 'Two', paths: ['report.md'] }), /limit|限/i);
});

test('concurrent refreshes cannot silently overwrite a newer version', async t => {
  const { service, owner } = await fixture(t);
  const { view } = await service.tool(owner, { action: 'record', title: 'Report', paths: ['report.md'] });
  const results = await Promise.allSettled([
    service.tool(owner, { action: 'refresh', id: view.id, expectedVersion: 1 }),
    service.tool(owner, { action: 'refresh', id: view.id, expectedVersion: 1 }),
  ]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected').length, 1);
});

test('commands reject invalid falsy check and note types instead of erasing them', async t => {
  const { service, owner, rows } = await fixture(t);
  for (const checks of [false, 0, '']) {
    await assert.rejects(service.command(owner, { action: 'record', title: 'Report', paths: ['report.md'], checks }), /checks/);
  }
  assert.equal(rows.size, 0);
  const { view } = await service.command(owner, { action: 'record', title: 'Report', paths: ['report.md'] });
  for (const note of [false, 0]) {
    await assert.rejects(service.command(owner, { action: 'decide', id: view.id, expectedVersion: 1, decision: 'accepted', note }), /note/);
  }
  assert.equal((await service.command(owner, { action: 'inspect', id: view.id })).view.decision, null);
});
