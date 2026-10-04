import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const HASH_CAP = 64 * 1024 * 1024;
const PREVIEW_CAP = 64 * 1024;
const CHUNK_BYTES = 64 * 1024;

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    && !/^[\/\\]|^[a-z]:/i.test(value) && !/[\\\u0000-\u001f\u007f-\u009f]/.test(value)
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function limitFor(options, maximum) {
  const maxBytes = options?.maxBytes ?? maximum;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > maximum) throw new TypeError(`maxBytes must be between 1 and ${maximum}`);
  return maxBytes;
}

const result = (path, status, reason, extra = {}) => ({ path: typeof path === 'string' ? path : '', status, ...(reason ? { reason } : {}), ...extra });
const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino && a.mode === b.mode;
const sameFile = (a, b) => sameIdentity(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;

function failure(path, error) {
  if (error?.code === 'ENOENT') return result(path, 'missing', 'file_missing');
  if (error?.code === 'ELOOP') return result(path, 'invalid_path', 'symlink_rejected');
  if (error?.code === 'ENOTDIR' || error?.code === 'EISDIR') return result(path, 'not_file', 'regular_file_required');
  return result(path, 'unreadable', error?.code === 'EACCES' || error?.code === 'EPERM' ? 'permission_denied' : 'read_failed');
}

async function inspectPath(root, relativePath) {
  if (!safePath(relativePath)) return { error: result(relativePath, 'invalid_path', 'safe_relative_path_required') };
  if (typeof root !== 'string' || !isAbsolute(root)) return { error: result(relativePath, 'unreadable', 'trusted_absolute_root_required') };
  const resolvedRoot = await realpath(root);
  const rootStat = await lstat(resolvedRoot, { bigint: true });
  if (!rootStat.isDirectory()) return { error: result(relativePath, 'not_file', 'workspace_directory_required') };
  const chain = [{ path: resolvedRoot, stat: rootStat }];
  const parts = relativePath.split('/');
  let target = resolvedRoot;
  for (let i = 0; i < parts.length; i += 1) {
    target = join(target, parts[i]);
    const stat = await lstat(target, { bigint: true });
    if (stat.isSymbolicLink()) return { error: result(relativePath, 'invalid_path', 'symlink_rejected') };
    if (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) return { error: result(relativePath, 'not_file', 'regular_file_required') };
    chain.push({ path: target, stat });
  }
  return { target, chain, stat: chain.at(-1).stat };
}

async function unchangedChain(chain) {
  try {
    for (let i = 0; i < chain.length; i += 1) {
      const current = await lstat(chain[i].path, { bigint: true });
      if (current.isSymbolicLink() || !(i === chain.length - 1 ? sameFile(chain[i].stat, current) : sameIdentity(chain[i].stat, current))) return false;
    }
    return true;
  } catch { return false; }
}

async function readArtifact(root, relativePath, maxBytes, preview) {
  let handle;
  try {
    const guard = await inspectPath(root, relativePath);
    if (guard.error) return guard.error;
    if (!preview && guard.stat.size > BigInt(maxBytes)) return result(relativePath, 'too_large', 'hash_limit_exceeded', { size: Number(guard.stat.size) });
    // Fail closed on a platform that cannot provide the non-following,
    // non-blocking open required to reject a path swapped to a link or FIFO.
    if (constants.O_NOFOLLOW === undefined || constants.O_NONBLOCK === undefined) return result(relativePath, 'unreadable', 'safe_open_unavailable');
    handle = await open(guard.target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) return result(relativePath, 'not_file', 'regular_file_required');
    if (!sameFile(guard.stat, before) || !await unchangedChain(guard.chain)) return result(relativePath, 'changed', 'file_changed_during_read');
    const length = Number(before.size > BigInt(maxBytes) ? BigInt(maxBytes) : before.size);
    const hash = preview ? null : createHash('sha256');
    const chunks = [];
    let offset = 0;
    while (offset < length) {
      const buffer = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, length - offset));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) return result(relativePath, 'changed', 'file_changed_during_read');
      const bytes = buffer.subarray(0, bytesRead);
      if (preview) chunks.push(bytes);
      else hash.update(bytes);
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (!sameFile(before, after) || !await unchangedChain(guard.chain)) return result(relativePath, 'changed', 'file_changed_during_read');
    if (!preview) return { path: relativePath, status: 'ok', size: Number(before.size), sha256: hash.digest('hex') };
    const truncated = before.size > BigInt(maxBytes);
    let text;
    try {
      // stream:true retains an incomplete trailing UTF-8 sequence, so a
      // truncated preview never invents a replacement character.
      text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks), { stream: truncated });
    } catch { return result(relativePath, 'unsupported', 'binary_or_invalid_utf8'); }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text)) return result(relativePath, 'unsupported', 'binary_or_invalid_utf8');
    return { path: relativePath, status: 'ok', text, truncated };
  } catch (error) { return failure(relativePath, error); }
  finally { if (handle) await handle.close().catch(() => {}); }
}

export async function probeArtifact(root, relativePath, options = {}) {
  return readArtifact(root, relativePath, limitFor(options, HASH_CAP), false);
}

export async function previewArtifact(root, relativePath, options = {}) {
  return readArtifact(root, relativePath, limitFor(options, PREVIEW_CAP), true);
}
