import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLedger, validateLedger, inspectLedger, saveSource, saveClaim, saveQuestion, reviewLedger, exportLedger } from './domain.js';

const FIELDS = {
  inspect: ['action'],
  save_source: ['action', 'expectedVersion', 'id', 'title', 'sourceKind', 'reference', 'locator', 'excerpt'],
  save_claim: ['action', 'expectedVersion', 'id', 'text', 'claimKind', 'links'],
  save_question: ['action', 'expectedVersion', 'id', 'question', 'claimId', 'status', 'resolution'],
  review: ['action', 'expectedVersion', 'status', 'note'],
  export: ['action', 'claimIds'],
};
const EXPORT_OPTIONS = ['includeExcerpts', 'includeReviewNotes', 'includeLocalReferences'];

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${label} must be an object`);
}

function ownerOf(value) {
  object(value, 'owner');
  if (typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 200
    || /[\u0000-\u001f\u007f-\u009f]/.test(value.sessionId) || typeof value.cwd !== 'string' || value.cwd.length > 4096) throw new TypeError('A valid local workspace session is required');
  let cwd = value.cwd;
  if (cwd.startsWith('file:')) cwd = fileURLToPath(cwd);
  if (!isAbsolute(cwd) || /[\u0000-\u001f\u007f-\u009f]/.test(cwd)) throw new TypeError('Only local workspace sessions are supported');
  return { sessionId: value.sessionId, cwd: normalize(cwd) };
}

function rowId(owner) {
  return `ledger_${createHash('sha256').update(JSON.stringify([owner.sessionId, owner.cwd])).digest('hex')}`;
}

export function validateStoredRow(value) {
  object(value, 'stored row');
  for (const key of Reflect.ownKeys(value)) if (!['id', 'sessionId', 'workspace', 'ledger'].includes(key)) throw new TypeError('Unknown stored row field');
  const owner = ownerOf({ sessionId: value.sessionId, cwd: value.workspace });
  if (value.workspace !== owner.cwd || value.id !== rowId(owner)) throw new TypeError('Invalid stored row owner or ID');
  return { id: value.id, sessionId: owner.sessionId, workspace: owner.cwd, ledger: validateLedger(value.ledger) };
}

function actionInput(value, user) {
  object(value, 'action');
  if (value.action === 'review' && !user) throw new Error('User-only review action');
  const fields = FIELDS[value.action];
  if (!fields) throw new TypeError('Unknown action');
  const allowed = value.action === 'export' && user ? [...fields, ...EXPORT_OPTIONS] : fields;
  for (const key of Reflect.ownKeys(value)) if (!allowed.includes(key)) throw new TypeError(`Unexpected field: ${String(key)}`);
  return structuredClone(value);
}

/** Host supplies the session/workspace; callers can only operate that owner's ledger. */
export function createService({ table, id = randomUUID, now = () => new Date().toISOString() }) {
  const queues = new Map();
  async function operate(owner, args, signal) {
    signal?.throwIfAborted();
    const key = rowId(owner);
    const row = await table.get(key);
    signal?.throwIfAborted();
    let ledger;
    if (row === undefined || row === null) ledger = createLedger(now());
    else {
      const stored = validateStoredRow(row);
      if (stored.id !== key || stored.sessionId !== owner.sessionId || stored.workspace !== owner.cwd) throw new Error('Stored row belongs to a different owner/session');
      ledger = stored.ledger;
    }
    if (args.action === 'inspect') return inspectLedger(ledger);
    const { action, ...input } = args;
    if (action === 'export') return { ...inspectLedger(ledger), markdown: exportLedger(ledger, input) };
    const options = { now: now(), ...(input.id === undefined && action !== 'review' ? { id: id() } : {}) };
    if (action === 'save_source') ledger = saveSource(ledger, input, options);
    if (action === 'save_claim') ledger = saveClaim(ledger, input, options);
    if (action === 'save_question') ledger = saveQuestion(ledger, input, options);
    if (action === 'review') ledger = reviewLedger(ledger, input, options.now);
    const next = validateStoredRow({ id: key, sessionId: owner.sessionId, workspace: owner.cwd, ledger });
    signal?.throwIfAborted();
    await table.put(key, next);
    return inspectLedger(next.ledger);
  }
  function execute(value, input, signal, user) {
    let owner;
    let args;
    try {
      owner = ownerOf(value);
      args = actionInput(input, user);
    } catch (error) { return Promise.reject(error); }
    const key = rowId(owner);
    const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => operate(owner, args, signal));
    queues.set(key, task);
    const clear = () => { if (queues.get(key) === task) queues.delete(key); };
    task.then(clear, clear);
    return task;
  }
  return {
    tool: (owner, input, signal) => execute(owner, input, signal, false),
    command: (owner, input, signal) => execute(owner, input, signal, true),
  };
}
