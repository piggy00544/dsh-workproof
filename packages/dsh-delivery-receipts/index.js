import { z } from 'zod';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { createService } from './src/service.js';

export const name = 'workproof-delivery-receipts';
export const inject = ['tools', 'commands', 'storageDomain'];

const date = z.string().datetime();
const safeId = z.string().regex(/^[\w-]{1,80}$/);
const observation = z.object({
  path: z.string().min(1).max(4096),
  status: z.enum(['ok', 'missing', 'unreadable', 'too_large', 'not_file', 'invalid_path', 'changed']),
  size: z.number().int().nonnegative().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  reason: z.string().max(500).optional(),
}).strict();
const decision = z.object({
  decision: z.enum(['accepted', 'changes_requested']), note: z.string().max(2000),
  at: date, version: z.number().int().positive(),
}).strict();
const receipt = z.object({
  id: safeId, title: z.string().min(1).max(200), paths: z.array(z.string()).min(1).max(20),
  checks: z.array(z.string().max(500)).max(20), claimsSource: z.literal('agent'),
  version: z.number().int().positive(), createdAt: date, updatedAt: date,
  baseline: z.array(observation).min(1).max(20), decision: decision.nullable(),
  history: z.array(z.object({
    type: z.enum(['created', 'refreshed', 'decided']), at: date, version: z.number().int().positive(),
    decision: z.enum(['accepted', 'changes_requested']).optional(), note: z.string().max(2000).optional(),
  }).strict()).max(100),
}).strict();
const storedRow = z.object({
  id: safeId, sessionId: z.string().min(1).max(200), workspace: z.string().min(1).max(4096),
  receipt, lastCheckedAt: date,
}).strict();
const domainSpec = defineDomain({ name: 'workproof_delivery_receipts', version: 1, tables: { receipts: domainTable(storedRow) } });

function owner(agent) {
  if (!agent?.id || !agent.session?.header?.cwd) throw new Error('A local workspace session is required / 需要本地工作区会话');
  return { sessionId: String(agent.id), cwd: agent.session.header.cwd };
}

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(domainSpec);
  ctx.effect(() => () => domain.close());
  const table = domain.table('receipts');
  const service = createService({ table: {
    get: id => table.get(id), entries: () => table.entries(),
    // rc.2's storage layer validates on read, not on every write.
    put: (id, row) => table.put(id, storedRow.parse(row)),
  } });

  ctx.tools.register(defineTool({
    name: 'delivery_receipt',
    description: 'Create and inspect receipts for explicitly selected local workspace artifacts. Record paths, title and your declared checks; the host observes file hashes. Use inspect before handoff. Refresh creates a new baseline and clears previous acceptance. Checks remain agent claims, hashes do not prove content quality, and this tool cannot accept on the user’s behalf or claim external delivery.',
    parameters: {
      action: { type: 'string', required: true, enum: ['record', 'list', 'inspect', 'refresh', 'preview', 'export'] },
      title: { type: 'string', description: 'Short deliverable title, at most 200 characters.' },
      paths: { type: 'array', items: { type: 'string' }, description: '1–20 relative regular-file paths beneath this session workspace, no symlinks.' },
      checks: { type: 'array', items: { type: 'string' }, description: 'Up to 20 declared checks. These are not independent verification.' },
      id: { type: 'string', description: 'Receipt ID returned by record/list.' },
      expectedVersion: { type: 'integer', description: 'Required by refresh; the version you inspected.' },
      path: { type: 'string', description: 'For preview: one path already included in this receipt.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          view: { type: 'object', additionalProperties: true }, checkedAt: { type: 'string' },
          receipts: { type: 'array', items: { type: 'object', additionalProperties: true } },
          preview: { type: 'object', additionalProperties: true }, markdown: { type: 'string' },
        },
      },
      render: (_args, result) => [{ type: 'text', text: JSON.stringify(result) }],
    },
    execute: (args, execution) => service.tool(owner(execution.agent), args, execution.signal),
  }));

  ctx.commands.register({
    name: 'delivery_receipts', description: 'Manage artifact receipts and record a user decision / 管理交付回执',
    input: { hint: '<JSON action>' },
    async handler({ agent, rawInput, signal }) {
      try {
        if (rawInput.length > 32768) throw new Error('Request too large / 请求过长');
        const input = JSON.parse(rawInput.trim() || '{"action":"list"}');
        const value = await service.command(owner(agent), input, signal);
        return { kind: 'success', text: JSON.stringify(value) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : 'Receipt operation failed' };
      }
    },
  });
}
