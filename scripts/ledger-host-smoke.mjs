/**
 * No-model integration smoke against the real DSH 0.2.0-rc.2 host services.
 * Run: node --test scripts/ledger-host-smoke.mjs
 *
 * The caller identity is synthetic; SessionStore, ToolRuntime, CommandRuntime,
 * Cordis lifecycle and JSON-backed storage are real. Only temporary storage is
 * mounted. No provider, agent loop, transport or desktop profile is loaded.
 * Sources use reserved .invalid URLs and nonexistent local references: this
 * ledger records metadata, and the test never fetches source URLs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
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
const HOST_PACKAGES = [
  'dsh-system-prompt', 'dsh-tools', 'dsh-commands', 'dsh-storage',
  'dsh-storage-json', 'dsh-storage-domain', 'dsh-session',
];

test('ledger smoke uses the pinned official rc.2 host runtime', () => {
  assert.equal(require('@deepseek-ai/cordis/package.json').version, '4.0.4');
  for (const name of HOST_PACKAGES) {
    assert.equal(require(`@deepseek-ai/${name}/package.json`).version, '0.2.0-rc.2', name);
  }
});

async function openHost(storageRoot, workspace, plugin) {
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
    ctx.on('tools/result', (execution, result) => {
      toolResults.push({ callId: execution.callId, result });
    });
    ctx.on('session/event', (session, event) => {
      sessionEvents.push({ sessionId: session.id, event });
    });
    await ctx.plugin(plugin);

    const caller = id => {
      const session = ctx.sessions.create(SessionId(id), { meta: { cwd: workspace } });
      return Object.freeze({ id: session.id, session, ctx });
    };
    const owner = caller('ledger-smoke-owner');
    const other = caller('ledger-smoke-other');
    let callNumber = 0;
    const signal = () => new AbortController().signal;

    async function invokeTool(args, agent = owner) {
      const callId = `ledger-smoke-${++callNumber}`;
      const outcome = await ctx.tools.execute({
        callId, name: 'evidence_ledger', arguments: args, agent, signal: signal(),
      });
      const observed = toolResults.find(item => item.callId === callId);
      assert.ok(observed, 'tool call must traverse the real tools/result pipeline');
      assert.deepEqual(observed.result, outcome);
      assert.equal(Object.isFrozen(outcome), true);
      return outcome;
    }
    async function tool(args, agent = owner) {
      const outcome = await invokeTool(args, agent);
      assert.equal(outcome.isError, false, JSON.stringify(outcome.error ?? outcome.content));
      assert.ok(Object.hasOwn(outcome, 'value'));
      return outcome.value;
    }
    async function toolDenied(args, reason, agent = owner) {
      const outcome = await invokeTool(args, agent);
      assert.equal(outcome.isError, true, 'forbidden tool action must fail');
      assert.equal(Object.hasOwn(outcome, 'value'), false);
      assert.match(JSON.stringify(outcome.error ?? outcome.content), reason);
    }
    async function invokeCommand(args, agent = owner) {
      return ctx.commands.execute(agent, `/evidence_ledger ${JSON.stringify(args)}`, [], signal());
    }
    async function command(args, agent = owner) {
      const outcome = await invokeCommand(args, agent);
      assert.ok(outcome, 'command must resolve through the real CommandRuntime');
      assert.equal(outcome.result.kind, 'success', outcome.result.text);
      const paired = sessionEvents.filter(({ sessionId, event }) =>
        sessionId === agent.session.id && event.data.commandId === outcome.commandId);
      assert.deepEqual(paired.map(({ event }) => event.type), ['command/run', 'command/done']);
      assert.equal(paired[0].event.data.source.kind, 'user');
      return JSON.parse(outcome.result.text);
    }
    async function commandDenied(args, reason, agent = owner) {
      const outcome = await invokeCommand(args, agent);
      assert.ok(outcome, 'rejected command must still resolve the registered command');
      assert.equal(outcome.result.kind, 'error', 'forbidden command must not report success');
      assert.match(outcome.result.text, reason);
    }
    assert.ok(ctx.tools.schemas(owner).some(item => item.name === 'evidence_ledger'));
    assert.ok(ctx.commands.list(owner).some(item => item.name === 'evidence_ledger'));
    return { owner, other, tool, toolDenied, command, commandDenied, close: () => ctx.fiber.dispose() };
  } catch (error) {
    await ctx.fiber.dispose();
    throw error;
  }
}

// Also check omission after entity decoding, so escaped private metadata cannot
// accidentally satisfy a raw-substring-only privacy assertion.
const decodedText = markdown => markdown.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const assertEmpty = result => {
  assert.equal(result.ledger.version, 0);
  assert.deepEqual(result.ledger.sources, []);
  assert.deepEqual(result.ledger.claims, []);
  assert.deepEqual(result.ledger.questions, []);
  assert.equal(result.ledger.review, null);
  assert.deepEqual(result.issues, []);
};

test('real host ledger flow preserves scope, review authority, selected exports and persistence', { timeout: 30000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-ledger-host-smoke-'));
  const workspace = join(root, 'synthetic-workspace');
  const storageRoot = join(root, 'synthetic-storage');
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = join(root, 'isolated-dsh-home');
  let host;
  t.after(async () => {
    try { if (host) await host.close(); }
    finally {
      if (previousDshHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previousDshHome;
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(workspace);
  const plugin = await import('../packages/dsh-evidence-ledger/index.js');
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(new Set(plugin.inject), new Set(['tools', 'commands', 'storageDomain']));
  host = await openHost(storageRoot, workspace, plugin);
  assertEmpty(await host.tool({ action: 'inspect' }));

  const publicInput = {
    title: 'Selected public source', sourceKind: 'public_url',
    reference: 'https://example.invalid/synthetic-source', locator: 'Synthetic section 1',
    excerpt: 'SYNTHETIC_PUBLIC_EXCERPT',
  };
  const localReference = 'private-synthetic/LOCAL_REFERENCE_ONLY.md';
  let output = await host.tool({ action: 'save_source', expectedVersion: 0, ...publicInput });
  assert.equal(output.ledger.version, 1);
  const publicId = output.ledger.sources[0].id;
  assert.match(publicId, /^[A-Za-z0-9_-]{1,80}$/);
  output = await host.tool({
    action: 'save_source', expectedVersion: 1, title: 'Selected local source',
    sourceKind: 'local_reference', reference: localReference, locator: 'Synthetic paragraph',
    excerpt: 'SYNTHETIC_LOCAL_EXCERPT',
  });
  assert.equal(output.ledger.version, 2);
  const localId = output.ledger.sources.find(item => item.sourceKind === 'local_reference').id;
  assert.equal(output.ledger.sources.find(item => item.id === localId).reference, localReference);
  output = await host.tool({
    action: 'save_source', expectedVersion: 2, title: 'UNSELECTED_SOURCE_SENTINEL',
    sourceKind: 'public_url', reference: 'https://example.invalid/unselected', locator: 'Synthetic section',
  });
  const unrelatedId = output.ledger.sources.find(item => item.title === 'UNSELECTED_SOURCE_SENTINEL').id;
  assert.equal(output.ledger.version, 3);

  const claimText = 'Selected synthetic assertion\n<script>never execute</script>\n::code-comment{title="synthetic"}';
  output = await host.tool({
    action: 'save_claim', expectedVersion: 3, text: claimText, claimKind: 'fact_assertion',
    links: [{ sourceId: publicId, relation: 'supports' }, { sourceId: localId, relation: 'context' }],
  });
  const selectedId = output.ledger.claims[0].id;
  assert.equal(output.ledger.version, 4);
  assert.equal(output.ledger.claims[0].claimKind, 'fact_assertion');
  output = await host.tool({
    action: 'save_claim', expectedVersion: 4, text: 'UNSELECTED_CLAIM_SENTINEL', claimKind: 'inference',
    links: [{ sourceId: unrelatedId, relation: 'contradicts' }],
  });
  const unselectedId = output.ledger.claims.find(item => item.text === 'UNSELECTED_CLAIM_SENTINEL').id;
  assert.equal(output.ledger.version, 5);
  output = await host.tool({ action: 'save_question', expectedVersion: 5, question: 'Selected open question?', claimId: selectedId });
  assert.equal(output.ledger.version, 6);
  assert.equal(output.ledger.questions[0].status, 'open');
  output = await host.tool({ action: 'save_question', expectedVersion: 6, question: 'UNSELECTED_QUESTION_SENTINEL', claimId: unselectedId });
  assert.equal(output.ledger.version, 7);
  assert.ok(output.issues.some(item => item.type === 'open_question'));
  assert.ok(output.issues.some(item => item.type === 'recorded_contradiction'));
  assert.equal(output.ledger.verified, undefined);
  assert.equal(output.ledger.score, undefined);
  t.diagnostic('entries: real tools save sources, claims and questions; references remain unverified metadata');

  await host.toolDenied({ action: 'review', expectedVersion: 7, status: 'reviewed' }, /action|review|enum|user/i);
  assert.equal((await host.tool({ action: 'inspect' })).ledger.review, null);
  assertEmpty(await host.tool({ action: 'inspect' }, host.other));
  await host.commandDenied({ action: 'review', expectedVersion: 7, status: 'reviewed' }, /version/i, host.other);
  await host.toolDenied({ action: 'save_source', expectedVersion: 0, id: publicId, ...publicInput }, /exist|source/i, host.other);
  await host.toolDenied({ action: 'export', claimIds: [selectedId] }, /claim|select/i, host.other);
  assertEmpty(await host.tool({ action: 'inspect' }, host.other));
  const reviewed = await host.command({ action: 'review', expectedVersion: 7, status: 'reviewed', note: 'SYNTHETIC_USER_REVIEW_NOTE' });
  assert.equal(reviewed.ledger.version, 7);
  assert.equal(reviewed.ledger.review.status, 'reviewed');
  assert.equal(reviewed.ledger.review.version, 7);
  t.diagnostic('authority: tool review and foreign-session access denied; user command records exact-version review');

  await host.toolDenied({ action: 'export', claimIds: [] }, /claim|select/i);
  for (const flag of ['includeExcerpts', 'includeReviewNotes', 'includeLocalReferences']) {
    await host.toolDenied({ action: 'export', claimIds: [selectedId], [flag]: true }, /field|user|argument|parameter|schema|additional|unknown/i);
  }
  const selectedExport = await host.tool({ action: 'export', claimIds: [selectedId] });
  assert.equal(typeof selectedExport.markdown, 'string');
  const exportedText = decodedText(selectedExport.markdown);
  assert.match(exportedText, /Selected synthetic assertion/);
  assert.match(exportedText, /Selected public source/);
  assert.match(exportedText, /Selected local source/);
  assert.match(exportedText, /Selected open question/);
  for (const omitted of ['UNSELECTED_SOURCE_SENTINEL', 'UNSELECTED_CLAIM_SENTINEL', 'UNSELECTED_QUESTION_SENTINEL', 'SYNTHETIC_PUBLIC_EXCERPT', 'SYNTHETIC_LOCAL_EXCERPT', 'SYNTHETIC_USER_REVIEW_NOTE', localReference, workspace]) {
    assert.equal(exportedText.includes(omitted), false, `default export must omit ${omitted === workspace ? 'workspace root' : omitted}`);
  }
  assert.doesNotMatch(selectedExport.markdown, /<script>|\n::code-comment\{/);
  assert.match(exportedText, /not.*verif|not.*truth/i);
  assert.match(exportedText, /not.*publication|not.*delivery/i);
  const explicitExport = await host.command({
    action: 'export', claimIds: [selectedId], includeExcerpts: true, includeReviewNotes: true, includeLocalReferences: true,
  });
  const explicitText = decodedText(explicitExport.markdown);
  for (const included of ['SYNTHETIC_PUBLIC_EXCERPT', 'SYNTHETIC_LOCAL_EXCERPT', 'SYNTHETIC_USER_REVIEW_NOTE', localReference]) {
    assert.ok(explicitText.includes(included), `explicit user export must include ${included}`);
  }
  assert.equal(explicitText.includes('UNSELECTED_CLAIM_SENTINEL'), false);
  t.diagnostic('export: explicit claim selection, inert syntax and default privacy omissions verified; only user opt-in exposes optional fields');

  const revised = await host.tool({ action: 'save_source', expectedVersion: 7, id: publicId, ...publicInput, title: 'Revised selected public source' });
  assert.equal(revised.ledger.version, 8);
  assert.equal(revised.ledger.sources.length, 3);
  assert.equal(revised.ledger.sources.find(item => item.id === publicId).title, 'Revised selected public source');
  assert.equal(revised.ledger.review, null);
  assert.ok(revised.ledger.history.some(item => item.type === 'review' && item.status === 'reviewed' && item.version === 7));
  await host.toolDenied({ action: 'save_source', expectedVersion: 7, id: publicId, ...publicInput }, /version/i);
  await host.commandDenied({ action: 'review', expectedVersion: 7, status: 'reviewed' }, /version/i);
  assert.deepEqual((await host.tool({ action: 'inspect' })).ledger, revised.ledger);
  t.diagnostic('invalidation: existing source edit advances once and clears review; stale saves/reviews do not change persisted data');

  await host.close();
  host = undefined;
  host = await openHost(storageRoot, workspace, plugin);
  const reopened = await host.tool({ action: 'inspect' });
  assert.deepEqual(reopened.ledger, revised.ledger);
  assertEmpty(await host.tool({ action: 'inspect' }, host.other));
  const needsWork = await host.command({ action: 'review', expectedVersion: 8, status: 'needs_work', note: 'Synthetic follow-up remains' });
  assert.equal(needsWork.ledger.review.status, 'needs_work');
  assert.equal(needsWork.ledger.review.version, 8);
  t.diagnostic('persistence: disposed/reopened real JSON storage retains exact edited ledger and supports the second user-review state');
});
