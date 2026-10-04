import { z } from 'zod';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { createService, validateStoredRow } from './src/service.js';

export const name = 'workproof-evidence-ledger';
export const inject = ['tools', 'commands', 'storageDomain'];

const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const date = z.string().datetime();
const reviewStatus = z.enum(['reviewed', 'needs_work']);
const review = z.object({ status: reviewStatus, note: z.string().max(2000), at: date, version: z.number().int().nonnegative() }).strict();
const ledger = z.object({
  version: z.number().int().nonnegative(), createdAt: date, updatedAt: date,
  sources: z.array(z.object({
    id: safeId, title: z.string().min(1).max(200), sourceKind: z.enum(['public_url', 'local_reference']),
    reference: z.string().min(1).max(2000), locator: z.string().max(300), excerpt: z.string().max(500),
  }).strict()).max(100),
  claims: z.array(z.object({
    id: safeId, text: z.string().min(1).max(2000), claimKind: z.enum(['fact_assertion', 'inference', 'proposal']),
    links: z.array(z.object({ sourceId: safeId, relation: z.enum(['supports', 'contradicts', 'context']) }).strict()).max(20),
  }).strict()).max(100),
  questions: z.array(z.object({
    id: safeId, question: z.string().min(1).max(1000), claimId: safeId.optional(),
    status: z.enum(['open', 'resolved']), resolution: z.string().max(1000),
  }).strict()).max(50),
  review: review.nullable(),
  history: z.array(z.union([
    z.object({ type: z.enum(['save_source', 'save_claim', 'save_question']), id: safeId, at: date, version: z.number().int().positive() }).strict(),
    review.extend({ type: z.literal('review') }).strict(),
  ])).max(100),
}).strict();
const storedRow = z.object({ id: safeId, sessionId: z.string().min(1).max(200), workspace: z.string().min(1).max(4096), ledger }).strict()
  .superRefine((value, context) => {
    try { validateStoredRow(value); }
    catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid ledger record' }); }
  });
const domainSpec = defineDomain({ name: 'workproof_evidence_ledger', version: 1, tables: { ledgers: domainTable(storedRow) } });

function owner(agent) {
  if (!agent?.id || !agent.session?.header?.cwd) throw new Error('A local workspace session is required / 需要本地工作区会话');
  return { sessionId: String(agent.id), cwd: agent.session.header.cwd };
}

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(domainSpec);
  ctx.effect(() => () => domain.close());
  const table = domain.table('ledgers');
  const service = createService({ table: {
    get: key => table.get(key),
    // rc.2 validates storage reads; explicitly validate every write as well.
    put: (key, row) => table.put(key, storedRow.parse(row)),
  } });
  ctx.tools.register(defineTool({
    name: 'evidence_ledger',
    description: 'Record a session-scoped research evidence ledger: source references, fact assertions, inferences, proposals and unresolved questions. Inspect before edits and use expectedVersion. Sources and relationships are recorder claims, not independently verified facts. No source is fetched or read. Any edit clears the prior user review. Export requires explicit claim IDs and omits optional private fields; only the user can review or opt them into export.',
    parameters: {
      action: { type: 'string', required: true, enum: ['inspect', 'save_source', 'save_claim', 'save_question', 'export'] },
      expectedVersion: { type: 'integer', description: 'Required for every save; ledger version returned by inspect.' },
      id: { type: 'string', description: 'Existing source, claim or question ID to update. Omit to create; IDs are host-generated.' },
      title: { type: 'string', description: 'Source title, at most 200 characters.' },
      sourceKind: { type: 'string', enum: ['public_url', 'local_reference'] },
      reference: { type: 'string', description: 'Credential-free HTTP(S) URL or safe relative local path, at most 2000 characters. Metadata only; never fetched or read.' },
      locator: { type: 'string', description: 'Source section/page/paragraph locator, at most 300 characters.' },
      excerpt: { type: 'string', description: 'Optional recorder-provided excerpt, at most 500 characters. Not independently verified; omitted from default exports.' },
      text: { type: 'string', description: 'Claim text, at most 2000 characters.' },
      claimKind: { type: 'string', enum: ['fact_assertion', 'inference', 'proposal'] },
      links: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { sourceId: { type: 'string', required: true }, relation: { type: 'string', required: true, enum: ['supports', 'contradicts', 'context'] } } }, description: 'At most 20 links to distinct existing source IDs. Relationship is the recorder’s classification.' },
      question: { type: 'string', description: 'Open or resolved question text, at most 1000 characters.' },
      claimId: { type: 'string', description: 'Optional existing claim ID for a question. Omit on update to remove the association.' },
      status: { type: 'string', enum: ['open', 'resolved'], description: 'Question status; defaults to open.' },
      resolution: { type: 'string', description: 'Required nonempty explanation for resolved questions, at most 1000 characters.' },
      claimIds: { type: 'array', items: { type: 'string' }, description: 'For export only: explicit nonempty unique selection of existing claim IDs.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ledger: { type: 'object', additionalProperties: true, required: true },
        issues: { type: 'array', items: { type: 'object', additionalProperties: true }, required: true }, markdown: { type: 'string' },
      } },
      render: (_args, result) => [{ type: 'text', text: JSON.stringify(result) }],
    },
    execute: (args, execution) => service.tool(owner(execution.agent), args, execution.signal),
  }));
  ctx.commands.register({
    name: 'evidence_ledger', description: 'Inspect research structure, record your review and export selected claims / 研究证据账本',
    input: { hint: '<JSON action>' },
    async handler({ agent, rawInput, signal }) {
      try {
        if (rawInput.length > 32768) throw new Error('Request too large / 请求过长');
        const input = JSON.parse(rawInput.trim() || '{"action":"inspect"}');
        const result = await service.command(owner(agent), input, signal);
        return { kind: 'success', text: JSON.stringify(result) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : 'Ledger operation failed' };
      }
    },
  });
}
