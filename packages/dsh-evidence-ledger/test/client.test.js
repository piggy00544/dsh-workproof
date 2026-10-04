import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('ledger client uses exact native loader identity and disposable conversation slot', async () => {
  const code = await readFile(new URL('../client.js', import.meta.url), 'utf8').catch(() => '');
  assert.ok(code.length, 'ledger client not implemented');
  let bundle;
  vm.runInNewContext(code, { window: { __ModuleLoader__: { load: value => { bundle = value; } } } });
  assert.equal(bundle.id, 'dsh-evidence-ledger');
  const plugin = bundle.factory(name => { assert.equal(name, 'react'); return { createElement() {} }; });
  const cleanups = []; const slots = []; let disposed = 0;
  plugin.apply({
    effect: fn => { const cleanup = fn(); cleanups.push(cleanup); return cleanup; },
    locale: { register: () => () => disposed++, bind: () => key => key },
    slots: {
      inject: (name, fn) => { assert.equal(name, 'conversation.view'); cleanups.push(fn()); },
      register: (options, component) => { slots.push({ options, component }); return () => disposed++; },
    },
    remote: { commands: { execute: () => assert.fail('no request during registration') } },
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].options.id, 'workproof-evidence-ledger');
  assert.equal(typeof slots[0].component, 'function');
  cleanups.forEach(fn => fn?.());
  assert.equal(disposed, 2);
  assert.doesNotMatch(code, /dangerouslySetInnerHTML|innerHTML\s*=|document\.body|setInterval\(/);
  const tokens = new Set(['--dsw-alias-label-primary', '--dsw-alias-label-secondary', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-border-l2']);
  for (const token of new Set(code.match(/--dsw-alias-[a-z0-9-]+/g))) assert.ok(tokens.has(token), token);
});
