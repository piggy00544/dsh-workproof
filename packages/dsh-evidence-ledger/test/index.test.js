import test from 'node:test';
import assert from 'node:assert/strict';

const plugin = await import('../index.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

test('host adapter registers the scoped tool and user command with managed storage lifecycle', async () => {
  assert.equal(typeof plugin.apply, 'function', 'host adapter implementation is absent');
  assert.deepEqual(new Set(plugin.inject), new Set(['tools', 'commands', 'storageDomain']));
  const rows = new Map();
  let tool;
  let command;
  let cleanup;
  let closed = false;
  await plugin.apply({
    storageDomain: { open: async () => ({ table: name => {
      assert.equal(name, 'ledgers');
      return { get: key => rows.get(key), put: async (key, row) => rows.set(key, row) };
    }, close: () => { closed = true; } }) },
    effect: fn => { cleanup = fn(); },
    tools: { register: value => { tool = value; } },
    commands: { register: value => { command = value; } },
  });
  assert.equal(tool.name, 'evidence_ledger');
  assert.equal(command.name, 'evidence_ledger');
  const agent = { id: 'synthetic-agent', session: { header: { cwd: '/synthetic-workspace' } } };
  const result = await command.handler({ agent, rawInput: '', signal: new AbortController().signal });
  assert.equal(result.kind, 'success');
  assert.equal(JSON.parse(result.text).ledger.version, 0);
  const invalid = await command.handler({ agent, rawInput: '{"action":"inspect","root":"/elsewhere"}', signal: new AbortController().signal });
  assert.equal(invalid.kind, 'error');
  const oversized = await command.handler({ agent, rawInput: ' '.repeat(32769), signal: new AbortController().signal });
  assert.equal(oversized.kind, 'error');
  cleanup();
  assert.equal(closed, true);
});
