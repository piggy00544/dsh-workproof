import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReceipt, inspectReceipt, refreshReceipt, decideReceipt, receiptMarkdown } from './domain.js';
import { probeArtifact, previewArtifact } from './artifacts.js';

const FIELDS = {
  record: ['action', 'title', 'paths', 'checks'],
  list: ['action'],
  inspect: ['action', 'id'],
  refresh: ['action', 'id', 'expectedVersion'],
  decide: ['action', 'id', 'expectedVersion', 'decision', 'note'],
  preview: ['action', 'id', 'path'],
  export: ['action', 'id'],
};

function ownerOf(owner) {
  if (!owner || typeof owner.sessionId !== 'string' || !owner.sessionId || typeof owner.cwd !== 'string') {
    throw new Error('A workspace session is required / 需要工作区会话');
  }
  let cwd = owner.cwd;
  if (cwd.startsWith('file:')) cwd = fileURLToPath(cwd);
  if (!isAbsolute(cwd)) throw new Error('Only local workspaces are supported / 仅支持本地工作区');
  return { sessionId: owner.sessionId, cwd };
}

function validateInput(input, user) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an action object');
  if (input.action === 'decide' && !user) throw new Error('User-only action / 此操作仅供用户确认');
  const fields = FIELDS[input.action];
  if (!fields) throw new Error('Unknown action / 未知操作');
  for (const key of Object.keys(input)) if (!fields.includes(key)) throw new Error(`Unexpected field / 未知字段: ${key}`);
  if (!['record', 'list'].includes(input.action) && (typeof input.id !== 'string' || !/^[\w-]{1,80}$/.test(input.id))) {
    throw new Error('Invalid receipt ID');
  }
  if (['refresh', 'decide'].includes(input.action) && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) {
    throw new Error('Expected version is required / 需要明确的版本号');
  }
  return input;
}

/** Operations shared by real tools and UI commands. Callers supply trusted session identity. */
export function createService({ table, now = () => new Date().toISOString(), id = randomUUID, maxReceipts = 100 }) {
  const queues = new Map();
  function rows(owner) {
    return [...table.entries()].map(([, row]) => row)
      .filter(row => row.sessionId === owner.sessionId && row.workspace === owner.cwd);
  }
  function owned(owner, key) {
    const row = table.get(key);
    if (!row || row.sessionId !== owner.sessionId || row.workspace !== owner.cwd) {
      throw new Error('Receipt unavailable in this session / 当前会话没有这条回执');
    }
    return row;
  }
  async function observations(owner, paths, signal) {
    const result = [];
    for (const path of paths) {
      signal?.throwIfAborted();
      result.push(await probeArtifact(owner.cwd, path));
    }
    signal?.throwIfAborted();
    return result;
  }
  function expected(row, input) {
    if (row.receipt.version !== input.expectedVersion) throw new Error('Version changed; reload first / 版本已变化，请先刷新');
  }
  async function put(row, signal) {
    signal?.throwIfAborted();
    await table.put(row.id, row);
  }
  function result(row, seen) {
    return { view: inspectReceipt(row.receipt, seen), checkedAt: row.lastCheckedAt };
  }
  async function operate(owner, input, signal) {
    signal?.throwIfAborted();
    if (input.action === 'list') {
      return { receipts: rows(owner).sort((a, b) => b.receipt.updatedAt.localeCompare(a.receipt.updatedAt)).map(row => ({
        id: row.id, title: row.receipt.title, version: row.receipt.version,
        createdAt: row.receipt.createdAt, updatedAt: row.receipt.updatedAt,
        lastCheckedAt: row.lastCheckedAt, decision: row.receipt.decision,
        evidenceFreshness: 'recheck_required',
      })) };
    }
    if (input.action === 'record') {
      if (rows(owner).length >= maxReceipts) throw new Error('Receipt limit reached / 此会话回执数量已达上限');
      // Validate all untrusted paths/counts before any file reads.
      const timestamp = now();
      const key = id();
      const provisional = (input.paths || []).map(path => ({ path, status: 'missing' }));
      createReceipt({ id: key, title: input.title, paths: input.paths, checks: input.checks, now: timestamp }, provisional);
      const seen = await observations(owner, input.paths, signal);
      const receipt = createReceipt({ id: key, title: input.title, paths: input.paths, checks: input.checks, now: timestamp }, seen);
      if (table.get(key)) throw new Error('Receipt ID collision');
      const row = { id: key, sessionId: owner.sessionId, workspace: owner.cwd, receipt, lastCheckedAt: now() };
      await put(row, signal);
      return result(row, seen);
    }
    const row = owned(owner, input.id);
    if (input.action === 'preview') {
      if (!row.receipt.paths.includes(input.path)) throw new Error('File is not part of this receipt / 文件不在这条回执中');
      const preview = await previewArtifact(owner.cwd, input.path);
      signal?.throwIfAborted();
      return { preview };
    }
    if (['refresh', 'decide'].includes(input.action)) expected(row, input);
    const seen = await observations(owner, row.receipt.paths, signal);
    let receipt = row.receipt;
    if (input.action === 'refresh') receipt = refreshReceipt(receipt, seen, now());
    if (input.action === 'decide') receipt = decideReceipt(receipt, seen, { decision: input.decision, note: input.note, now: now() });
    const updated = { ...row, receipt, lastCheckedAt: now() };
    await put(updated, signal);
    const output = result(updated, seen);
    return input.action === 'export' ? { ...output, markdown: receiptMarkdown(output.view) } : output;
  }
  function execute(owner, input, signal, user) {
    return Promise.resolve().then(() => {
      const who = ownerOf(owner);
      const args = validateInput(input, user);
      const key = JSON.stringify([who.sessionId, who.cwd]);
      const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => operate(who, args, signal));
      queues.set(key, task);
      const clear = () => { if (queues.get(key) === task) queues.delete(key); };
      task.then(clear, clear);
      return task;
    });
  }
  return {
    tool: (owner, input, signal) => execute(owner, input, signal, false),
    command: (owner, input, signal) => execute(owner, input, signal, true),
  };
}
