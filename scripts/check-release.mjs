// Bounded, read-only check for these two v0.1.0 npm-pack archives, not a malware
// scanner or general TAR implementation. Nothing is extracted or executed.
import { open } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const common = ['LICENSE', 'README.md', 'README.zh.md', 'client.js', 'cordis.patch.yml', 'index.js', 'locale/en.json', 'locale/zh.json', 'package.json', 'src/domain.js', 'src/service.js'];
const specific = {
  'dsh-delivery-receipts': ['src/artifacts.js', 'examples/article.md', 'examples/release-notes.md', 'examples/report.csv'],
  'dsh-evidence-ledger': ['examples/walkthroughs.md'],
};
const ensure = condition => { if (!condition) throw new Error('invalid'); };
const field = bytes => bytes.toString('utf8').replace(/\0.*$/s, '');
const octal = bytes => {
  const value = field(bytes).trim();
  ensure(/^[0-7]+$/.test(value));
  return parseInt(value, 8);
};

async function check(file) {
  ensure(typeof file === 'string' && file.endsWith('.tgz'));
  const handle = await open(file, 'r');
  let compressed;
  try {
    const before = await handle.stat();
    ensure(before.isFile() && before.size > 0 && before.size <= 4 * 1024 * 1024);
    compressed = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < compressed.length) {
      const { bytesRead } = await handle.read(compressed, offset, compressed.length - offset, offset);
      ensure(bytesRead > 0);
      offset += bytesRead;
    }
    const after = await handle.stat();
    ensure(before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs);
  } finally { await handle.close(); }
  const tar = gunzipSync(compressed, { maxOutputLength: 16 * 1024 * 1024 });
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= tar.length && tar.subarray(offset, offset + 512).some(byte => byte !== 0)) {
    const header = tar.subarray(offset, offset + 512);
    ensure(header[156] === 0 || header[156] === 48); // regular files only
    ensure(header.subarray(345, 500).every(byte => byte === 0)); // no prefix/PAX variants
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    ensure(checksum === octal(header.subarray(148, 156)));
    const name = field(header.subarray(0, 100));
    ensure(/^package\/[A-Za-z0-9._/-]+$/.test(name) && !name.split('/').some(part => part === '..' || part === '.' || !part));
    ensure(!files.has(name));
    const size = octal(header.subarray(124, 136));
    ensure(size <= 1024 * 1024 && offset + 512 + size <= tar.length);
    const body = tar.subarray(offset + 512, offset + 512 + size);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    // Heuristics only: a clean scan does not prove the absence of secrets.
    ensure(!/(?:\/(?:Users|home)\/[^\s/]+|[A-Za-z]:\\(?:Users|Documents and Settings)\\|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,})/.test(text));
    files.set(name, text);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  ensure(tar.length - offset >= 1024 && tar.subarray(offset).every(byte => byte === 0));
  const pkg = JSON.parse(files.get('package/package.json'));
  ensure(Object.hasOwn(specific, pkg.name) && pkg.version === '0.1.0');
  const allowed = new Set([...common, ...specific[pkg.name]].map(name => 'package/' + name));
  ensure(files.size === allowed.size && [...files.keys()].every(name => allowed.has(name)));
  ensure(pkg.scripts === undefined || Object.keys(pkg.scripts).length === 0);
  ensure(pkg.type === 'module' && pkg.license === 'MIT' && pkg.engines?.node === '>=22');
  ensure(pkg.repository?.url === 'https://github.com/piggy00544/dsh-workproof.git' && pkg.repository?.directory === `packages/${pkg.name}`);
  ensure(JSON.stringify(pkg.dependencies) === JSON.stringify({ zod: '4.6.5' }));
  const peers = ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-storage-domain', '@deepseek-ai/dsh-commands'];
  ensure(Object.keys(pkg.peerDependencies ?? {}).length === peers.length && peers.every(name => pkg.peerDependencies[name] === '0.2.0-rc.2'));
  ensure(pkg.dsh?.manifestVersion === 1 && pkg.dsh.bundle?.patch === './cordis.patch.yml' && pkg.dsh.client?.platform === 'web');
  ensure(pkg.exports?.['.'] === './index.js' && pkg.exports?.['./client'] === './client.js');
  const id = pkg.name.replace(/^dsh-/, 'workproof-');
  ensure(files.get('package/cordis.patch.yml').trim() === `- insert:\n    - id: ${id}\n      name: ${pkg.name}`);
  ensure(new RegExp(`id:\\s*['"]${pkg.name}['"]`).test(files.get('package/client.js')));
  return `sha256=${createHash('sha256').update(compressed).digest('hex')} files=${files.size}`;
}

try {
  ensure(process.argv.length >= 3);
  const results = [];
  for (const file of process.argv.slice(2)) results.push(await check(file));
  process.stdout.write(results.join('\n') + '\n');
} catch {
  process.stderr.write('Release check failed.\n');
  process.exitCode = 1;
}
