import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('client registers the exact package ID and mounts/disposes through the native slot', async () => {
  const code = await readFile(new URL('../client.js', import.meta.url), 'utf8').catch(() => '');
  assert.ok(code.length > 0, 'client module has not been implemented');
  let bundle;
  vm.runInNewContext(code, { window: { __ModuleLoader__: { load: value => { bundle = value; } } } });
  assert.equal(bundle.id, 'dsh-delivery-receipts');
  const imports = [];
  const plugin = bundle.factory(name => { imports.push(name); assert.equal(name, 'react'); return { createElement() {} }; });
  assert.deepEqual(imports, ['react']);
  const slots = [];
  let disposed = 0;
  const cleanups = [];
  const ctx = {
    effect: effect => { const cleanup = effect(); cleanups.push(cleanup); return cleanup; },
    locale: { register: () => () => disposed++, bind: () => key => key },
    slots: { inject: (owner, effect) => { assert.equal(owner, 'conversation.view'); cleanups.push(effect()); }, register: (options, component) => { slots.push({ options, component }); return () => disposed++; } },
    remote: { commands: { execute: () => assert.fail('no request at plugin registration') } },
  };
  plugin.apply(ctx);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].options.name, 'conversation.view');
  assert.equal(slots[0].options.id, 'workproof-delivery-receipts');
  assert.equal(typeof slots[0].component, 'function');
  for (const cleanup of cleanups) cleanup?.();
  assert.equal(disposed, 2);
  assert.doesNotMatch(code, /dangerouslySetInnerHTML|innerHTML\s*=|document\.body|setInterval\(/);
});

test('client theme variables exist in the pinned official rc.2 theme', async () => {
  const code = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  // Names verified against dsh-client-ui-theme 0.2.0-rc.2 lib/client.js.
  const supported = new Set(['--dsw-alias-label-primary', '--dsw-alias-label-secondary', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-border-l2']);
  for (const token of new Set(code.match(/--dsw-alias-[a-z0-9-]+/g))) assert.ok(supported.has(token), `Unsupported rc.2 token: ${token}`);
});
