import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const files = await import('../src/artifacts.js').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
async function fixture(t) {
  assert.equal(typeof files.probeArtifact, 'function', 'probeArtifact must be implemented');
  const root = await mkdtemp(join(tmpdir(), 'dsh-receipt-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('hashes the exact bytes of explicit regular files', async (t) => {
  const root = await fixture(t);
  const bytes = Buffer.from([0, 255, 1, 13, 10]);
  await writeFile(join(root, 'binary.dat'), bytes);
  assert.deepEqual(await files.probeArtifact(root, 'binary.dat'), { path: 'binary.dat', status: 'ok', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
});

test('rejects traversal, absolute paths, Windows paths, and control characters', async (t) => {
  const root = await fixture(t);
  for (const path of ['../secret', '/etc/passwd', 'C:\\temp\\file', 'C:relative', '\\\\host\\share', 'a/../b', './a', 'a//b', 'a\0b', 'a\nb', 'a\\b', '']) {
    const result = await files.probeArtifact(root, path);
    assert.equal(result.status, 'invalid_path', path);
    assert.equal((await files.previewArtifact(root, path)).status, 'invalid_path', path);
    assert.equal(result.sha256, undefined);
  }
});

test('rejects direct and ancestor symlinks, including links that point inside the root', async (t) => {
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'dsh-outside-test-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'secret.txt'), 'must not read');
  await mkdir(join(root, 'inside'));
  await writeFile(join(root, 'inside', 'file.txt'), 'inside');
  await symlink(join(outside, 'secret.txt'), join(root, 'file-link'));
  await symlink(outside, join(root, 'directory-link'));
  await symlink(join(root, 'inside'), join(root, 'internal-link'));
  for (const path of ['file-link', 'directory-link/secret.txt', 'internal-link/file.txt']) {
    assert.equal((await files.probeArtifact(root, path)).status, 'invalid_path');
    assert.equal((await files.previewArtifact(root, path)).status, 'invalid_path');
  }
});

test('missing files, directories and FIFOs return structured results without blocking', { timeout: 5000 }, async (t) => {
  const root = await fixture(t);
  assert.equal((await files.probeArtifact(root, 'missing.txt')).status, 'missing');
  await mkdir(join(root, 'directory'));
  assert.equal((await files.probeArtifact(root, 'directory')).status, 'not_file');
  if (process.platform !== 'win32') {
    await promisify(execFile)('mkfifo', [join(root, 'pipe')]);
    assert.equal((await files.probeArtifact(root, 'pipe')).status, 'not_file');
    assert.equal((await files.previewArtifact(root, 'pipe')).status, 'not_file');
  }
});

test('hash cap rejects large files before returning a digest', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'large.txt'), 'abcdefghij');
  const result = await files.probeArtifact(root, 'large.txt', { maxBytes: 5 });
  assert.equal(result.status, 'too_large');
  assert.equal(result.size, 10);
  assert.equal(result.sha256, undefined);
  await assert.rejects(files.probeArtifact(root, 'large.txt', { maxBytes: -1 }), /maxBytes/i);
});

test('preview returns UTF-8 as inert text and truncates only at a full character', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'preview.html'), '<script>never execute</script>');
  assert.deepEqual(await files.previewArtifact(root, 'preview.html'), { path: 'preview.html', status: 'ok', text: '<script>never execute</script>', truncated: false });
  await writeFile(join(root, 'unicode.txt'), '你好世界');
  const result = await files.previewArtifact(root, 'unicode.txt', { maxBytes: 5 });
  assert.deepEqual(result, { path: 'unicode.txt', status: 'ok', text: '你', truncated: true });
});

test('binary and invalid UTF-8 previews are unsupported and contain no partial content', async (t) => {
  const root = await fixture(t);
  for (const bytes of [Buffer.from([0, 1, 2]), Buffer.from([0xff, 0xfe]), Buffer.from('text\u001b[31m')]) {
    await writeFile(join(root, 'binary.bin'), bytes);
    const result = await files.previewArtifact(root, 'binary.bin');
    assert.equal(result.status, 'unsupported');
    assert.equal(result.text, undefined);
  }
});

test('a file that changes during hashing never returns an ok digest', { timeout: 10000 }, async (t) => {
  const root = await fixture(t);
  const target = join(root, 'changing.bin');
  await writeFile(target, Buffer.alloc(8 * 1024 * 1024, 65));
  let keepWriting = true;
  const writer = (async () => {
    while (keepWriting) {
      await new Promise((resolve) => setImmediate(resolve));
      if (keepWriting) await appendFile(target, 'x');
    }
  })();
  let result;
  try { result = await files.probeArtifact(root, 'changing.bin', { maxBytes: 16 * 1024 * 1024 }); }
  finally { keepWriting = false; await writer; }
  assert.equal(result.status, 'changed');
  assert.equal(result.sha256, undefined);
});
