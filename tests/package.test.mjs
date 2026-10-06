import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { buildPackage, collectFiles, zip } from '../package.mjs';

function unzip(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const body = buffer.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    files.set(name, method === 8 ? inflateRawSync(body) : body);
    offset += 30 + nameLength + size;
  }
  return files;
}

test('the zip writer produces readable archives', () => {
  const archive = unzip(zip([{ name: 'a/论证.txt', data: Buffer.from('hello '.repeat(50)) }, { name: 'b.bin', data: Buffer.from([1, 2, 3]) }]));
  assert.equal(archive.get('a/论证.txt').toString(), 'hello '.repeat(50));
  assert.deepEqual([...archive.get('b.bin')], [1, 2, 3]);
});

test('the release package contains the app and never a key file', async () => {
  const files = await collectFiles();
  assert.ok(files.includes('server.mjs') && files.includes('app.mjs') && files.includes('index.html'));
  assert.ok(!files.some(file => /(^|\/)\.env$|\.env\.old$|backup/.test(file)));
  const dir = await mkdtemp(join(tmpdir(), 'argumentor-pkg-'));
  const { target } = await buildPackage(dir);
  const archive = unzip(await readFile(target));
  assert.ok([...archive.keys()].every(name => name.startsWith('ArguMentor-v')));
  assert.ok(![...archive.keys()].some(name => name.endsWith('/.env')));
});
