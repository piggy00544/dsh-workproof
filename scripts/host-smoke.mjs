/**
 * No-model integration smoke against the real DSH 0.2.0-rc.2 host services.
 * Run: node --test scripts/host-smoke.mjs
 *
 * Only the caller identity is synthetic: SessionStore, ToolRuntime,
 * CommandRuntime, the Cordis lifecycle and JSON-backed storage are real.
 * No agent loop, provider, network transport or desktop profile is mounted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import CommandRuntime from '@deepseek-ai/dsh-commands';
import Storage from '@deepseek-ai/dsh-storage';
import * as JsonStorage from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session';

const require = createRequire(import.meta.url);
const DSH_PACKAGES = [
  'dsh-system-prompt', 'dsh-tools', 'dsh-commands', 'dsh-storage',
  'dsh-storage-json', 'dsh-storage-domain', 'dsh-session',
];

test('smoke uses the pinned official rc.2 host runtime', () => {
  assert.equal(require('@deepseek-ai/cordis/package.json').version, '4.0.4');
  for (const name of DSH_PACKAGES) {
    assert.equal(require(`@deepseek-ai/${name}/package.json`).version, '0.2.0-rc.2', name);
  }
});

async function openHost(storageRoot, workspace, receiptPlugin) {
  const ctx = new Context();
  const toolResults = [];
  const sessionEvents = [];
  try {
    await ctx.plugin(SystemPrompt, {});
    await ctx.plugin(ToolRuntime, { mode: 'native' });
    await ctx.plugin(CommandRuntime);
    await ctx.plugin(Storage);
    await ctx.plugin(JsonStorage, { root: storageRoot });
    await ctx.plugin(StorageDomain, { backend: 'json' });
    await ctx.plugin(SessionStore);
    ctx.on('tools/result', (exec, result) => {
      toolResults.push({ callId: exec.callId, result });
    });
    ctx.on('session/event', (session, event) => {
      sessionEvents.push({ sessionId: session.id, event });
    });
    await ctx.plugin(receiptPlugin);

    const caller = (id) => {
      const session = ctx.sessions.create(SessionId(id), { meta: { cwd: workspace } });
      // These services need a scoped identity plus an actual Session; they do
      // not need AgentRuntime or a provider to execute a registered tool/command.
      return Object.freeze({ id: `agent-${id}`, session, ctx });
    };
    const owner = caller('workproof-smoke-owner');
    const other = caller('workproof-smoke-other');
    let callNumber = 0;
    const signal = () => new AbortController().signal;

    async function invokeTool(agent, args) {
      const callId = `workproof-smoke-${++callNumber}`;
      const result = await ctx.tools.execute({
        callId, name: 'delivery_receipt', arguments: args, agent, signal: signal(),
      });
      const observed = toolResults.find((entry) => entry.callId === callId);
      assert.ok(observed, 'call must traverse the real tools/result pipeline');
      assert.deepEqual(observed.result, result, 'pipeline observer must see the returned outcome');
      assert.equal(Object.isFrozen(observed.result), true, 'runtime materializes an immutable result');
      return result;
    }
    async function tool(args, agent = owner) {
      const result = await invokeTool(agent, args);
      assert.equal(result.isError, false, JSON.stringify(result.error ?? result.content));
      assert.ok(Object.hasOwn(result, 'value'), 'successful tools return their canonical value');
      return result.value;
    }
    async function toolDenied(args, reason, agent = owner) {
      const result = await invokeTool(agent, args);
      assert.equal(result.isError, true, 'forbidden tool action must fail in the host pipeline');
      assert.equal(Object.hasOwn(result, 'value'), false, 'failed calls cannot carry successful values');
      assert.match(JSON.stringify(result.error ?? result.content), reason);
    }
    async function invokeCommand(args, agent = owner) {
      return ctx.commands.execute(agent, `/delivery_receipts ${JSON.stringify(args)}`, [], signal());
    }
    async function command(args, agent = owner) {
      const outcome = await invokeCommand(args, agent);
      assert.ok(outcome, 'slash command must resolve through CommandRuntime');
      assert.equal(outcome.result.kind, 'success', outcome.result.text);
      assert.equal(typeof outcome.result.text, 'string', 'UI command returns JSON text');
      const paired = sessionEvents.filter(({ sessionId, event }) =>
        sessionId === agent.session.id && event.data.commandId === outcome.commandId);
      assert.deepEqual(paired.map(({ event }) => event.type), ['command/run', 'command/done']);
      assert.equal(paired[0].event.data.source.kind, 'user');
      return JSON.parse(outcome.result.text);
    }
    async function commandDenied(args, reason, agent = owner) {
      const settled = await invokeCommand(args, agent).then(
        (outcome) => ({ outcome }), (error) => ({ error }),
      );
      if (settled.error) {
        assert.match(String(settled.error), reason);
        return;
      }
      assert.ok(settled.outcome, 'a rejected action must still resolve the registered command');
      assert.equal(settled.outcome.result.kind, 'error', 'command must reject the stale/foreign decision');
      assert.match(settled.outcome.result.text, reason);
    }
    assert.ok(ctx.tools.schemas(owner).some(({ name }) => name === 'delivery_receipt'));
    assert.ok(ctx.commands.list(owner).some(({ name }) => name === 'delivery_receipts'));
    return { ctx, owner, other, tool, toolDenied, command, commandDenied, close: () => ctx.fiber.dispose() };
  } catch (error) {
    await ctx.fiber.dispose();
    throw error;
  }
}

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('real host pipeline preserves receipt evidence, user authority and persistence', { timeout: 30000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workproof-host-smoke-'));
  const workspace = join(root, 'synthetic-workspace');
  const storageRoot = join(root, 'synthetic-storage');
  const originalHome = process.env.DSH_HOME;
  process.env.DSH_HOME = join(root, 'isolated-dsh-home');
  let host;
  t.after(async () => {
    try { if (host) await host.close(); }
    finally {
      if (originalHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = originalHome;
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(workspace);
  const v1 = Buffer.from('Synthetic delivery report v1\n合成验收数据\n', 'utf8');
  const v2 = Buffer.from('Synthetic delivery report v2\n内容已更新\n', 'utf8');
  const binary = Buffer.from([0, 255, 1, 13, 10]);
  await writeFile(join(workspace, 'report.md'), v1);
  await writeFile(join(workspace, 'bytes.bin'), binary);

  const receiptPlugin = await import('../packages/dsh-delivery-receipts/index.js');
  assert.equal(typeof receiptPlugin.apply, 'function', 'host plugin entry must export apply(ctx)');
  assert.deepEqual(new Set(receiptPlugin.inject), new Set(['tools', 'commands', 'storageDomain']));
  host = await openHost(storageRoot, workspace, receiptPlugin);
  assert.deepEqual((await host.tool({ action: 'list' })).receipts, []);

  const recorded = await host.tool({
    action: 'record', title: 'Synthetic report', paths: ['report.md', 'bytes.bin'],
    checks: ['Agent claims synthetic checks passed'],
  });
  const { id } = recorded.view;
  assert.equal(recorded.view.version, 1);
  assert.equal(recorded.view.state, 'review_required');
  assert.equal(recorded.view.claims.source, 'agent');
  assert.equal(recorded.view.claims.title, 'Synthetic report');
  assert.deepEqual(recorded.view.claims.checks, ['Agent claims synthetic checks passed']);
  assert.equal(Number.isNaN(Date.parse(recorded.checkedAt)), false);
  for (const [path, bytes] of [['report.md', v1], ['bytes.bin', binary]]) {
    const artifact = recorded.view.artifacts.find((entry) => entry.path === path);
    assert.ok(artifact, `recorded evidence must include ${path}`);
    for (const observation of [artifact.current, artifact.baseline]) {
      assert.equal(observation.status, 'ok');
      assert.equal(observation.size, bytes.length);
      assert.equal(observation.sha256, digest(bytes));
    }
  }
  t.diagnostic('record: canonical value and exact UTF-8/binary hashes verified through ToolRuntime');

  await host.toolDenied({ action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }, /action|decide|enum|user|用户/i);
  assert.equal((await host.tool({ action: 'inspect', id })).view.decision, null);
  assert.deepEqual((await host.tool({ action: 'list' }, host.other)).receipts, []);
  await host.toolDenied({ action: 'inspect', id }, /session|会话/i, host.other);
  await host.commandDenied({ action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }, /session|会话/i, host.other);
  t.diagnostic('authority: tool decisions and cross-session reads/decisions rejected');

  const preview = await host.tool({ action: 'preview', id, path: 'report.md' });
  assert.equal(preview.preview.text, v1.toString('utf8'));
  const exported = await host.tool({ action: 'export', id });
  assert.equal(typeof exported.markdown, 'string');
  assert.ok(exported.markdown.length > 0);
  assert.equal(exported.markdown.includes(workspace), false);
  assert.equal(exported.markdown.includes(v1.toString('utf8')), false);

  const accepted = await host.command({ action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: 'Synthetic user reviewed v1' });
  assert.equal(accepted.view.state, 'accepted');
  assert.equal(accepted.view.decision.version, 1);
  assert.equal(accepted.view.decision.decision, 'accepted');
  assert.equal((await host.tool({ action: 'inspect', id })).view.state, 'accepted');
  await writeFile(join(workspace, 'report.md'), v2);
  const stale = await host.tool({ action: 'inspect', id });
  assert.equal(stale.view.state, 'stale');
  const changed = stale.view.artifacts.find(({ path }) => path === 'report.md');
  assert.equal(changed.baseline.sha256, digest(v1));
  assert.equal(changed.current.sha256, digest(v2));
  await host.commandDenied({ action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }, /accept|baseline|current|stale|当前|基准/i);

  const refreshed = await host.tool({ action: 'refresh', id, expectedVersion: 1 });
  assert.equal(refreshed.view.version, 2);
  assert.equal(refreshed.view.state, 'review_required');
  assert.equal(refreshed.view.decision, null);
  assert.equal(refreshed.view.artifacts.find(({ path }) => path === 'report.md').baseline.sha256, digest(v2));
  await host.commandDenied({ action: 'decide', id, expectedVersion: 1, decision: 'accepted', note: '' }, /version|版本/i);
  t.diagnostic('lifecycle: user acceptance, stale detection, refusal and version refresh verified');

  await host.close();
  host = undefined;
  host = await openHost(storageRoot, workspace, receiptPlugin);
  assert.equal((await host.tool({ action: 'list' })).receipts.length, 1);
  const reopened = await host.tool({ action: 'inspect', id });
  assert.equal(reopened.view.version, 2);
  assert.equal(reopened.view.decision, null);
  assert.equal(reopened.view.state, 'review_required');
  assert.equal(reopened.view.artifacts.find(({ path }) => path === 'report.md').baseline.sha256, digest(v2));
  assert.deepEqual((await host.tool({ action: 'list' }, host.other)).receipts, []);
  t.diagnostic('persistence: disposed and reopened real JSON/Domain services retain the receipt');
});
