import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const cli = new URL('./check-release.mjs', import.meta.url);
async function filesFor(name) {
  const base = new URL(`packages/${name}/`, root);
  const files = new Map();
  async function visit(dir = '') {
    for (const entry of await readdir(new URL(dir, base), { withFileTypes: true })) {
      const relative = dir + entry.name;
      if (entry.isDirectory()) {
        if (['src', 'locale', 'examples'].includes(relative)) await visit(relative + '/');
      } else if (!relative.startsWith('test/') && /^(index\.js|client\.js|package\.json|cordis\.patch\.yml|LICENSE|README(?:\.zh)?\.md|(?:src|locale|examples)\/)/.test(relative)) {
        files.set('package/' + relative, await readFile(new URL(relative, base)));
      }
    }
  }
  await visit();
  return files;
}
function archive(files, type = '0') {
  const parts = [];
  for (const [name, content] of files) {
    const bytes = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write(type, 156);
    header.write('ustar\0', 257);
    const sum = header.reduce((a, b) => a + b, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    parts.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]));
}
async function check(t, files, type) {
  const dir = await mkdtemp(join(tmpdir(), 'workproof-release-check-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'fixture.tgz');
  await writeFile(file, archive(files, type));
  return spawnSync(process.execPath, [fileURLToPath(cli), file], { encoding: 'utf8' });
}
for (const [name, count] of [['dsh-delivery-receipts', 15], ['dsh-evidence-ledger', 12]]) {
  test(`accepts the ${name} release allowlist without echoing paths`, async t => {
    const result = await check(t, await filesFor(name));
    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(`^sha256=[a-f0-9]{64} files=${count}\\n$`));
    assert.equal(result.stderr, '');
  });
}
for (const [label, change] of [
  ['extra file', files => files.set('package/.env', Buffer.from('synthetic'))],
  ['missing file', files => files.delete('package/LICENSE')],
  ['private path', files => files.set('package/README.md', Buffer.from('/Users/synthetic-private/project'))],
  ['credential', files => files.set('package/README.md', Buffer.from('ghp_' + 'a'.repeat(40)))],
  ['install script', files => { const p = JSON.parse(files.get('package/package.json')); p.scripts = { postinstall: 'echo unsafe' }; files.set('package/package.json', Buffer.from(JSON.stringify(p))); }],
  ['wrong peer', files => { const p = JSON.parse(files.get('package/package.json')); p.peerDependencies['@deepseek-ai/dsh-tools'] = '*'; files.set('package/package.json', Buffer.from(JSON.stringify(p))); }],
  ['traversal', files => files.set('package/../escape', Buffer.from('synthetic'))],
  ['module mismatch', files => files.set('package/client.js', Buffer.from('__ModuleLoader__.define("another-plugin", [], () => {});'))],
]) {
  test(`rejects ${label} without echoing archive contents`, async t => {
    const files = await filesFor('dsh-delivery-receipts');
    change(files);
    const result = await check(t, files);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Release check failed.\n');
  });
}
test('rejects nonregular TAR entries', async t => {
  const result = await check(t, await filesFor('dsh-delivery-receipts'), '2');
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'Release check failed.\n');
});
