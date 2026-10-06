// package.mjs — builds dist/ArguMentor-v<version>.zip from a fixed allow-list (npm run package).
// It never includes .env files, browser records or anything outside the list, and it refuses to build
// if any packaged text file looks like it contains an API key. Pure Node: no third-party dependencies.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP_VERSION } from './core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILES = [
  'README.md', 'README.en.md', 'package.json', '.env.example', '启动论证工坊.command', '启动论证工坊.bat',
  'index.html', 'styles.css', 'favicon.svg',
  'app.mjs', 'core.mjs', 'html.mjs', 'i18n.mjs', 'api.mjs', 'diff.mjs', 'report.mjs', 'teacher.mjs',
  'engine.mjs', 'sha256.mjs',
  'server.mjs', 'env.mjs', 'provider.mjs', 'mock.mjs', 'orchestrator.mjs', 'prompts.mjs', 'guard.mjs',
  'setup.mjs', 'check.mjs', 'package.mjs', 'build-site.mjs', '.gitignore'
];
const DIRECTORIES = ['tests', 'demo', 'eval', 'docs', 'release', 'screenshots', 'worker'];
const ALLOWED_EXTENSIONS = /\.(mjs|js|json|md|txt|html|css|svg|png|jpg|csv|toml)$/i;
// .env.example is documentation and is explicitly allowed; every other .env form is excluded.
const FORBIDDEN = /(^|[\\/])(\.env(?!\.example$)(\..*)?|node_modules|dist|\.DS_Store)$|backup/i;
const SECRET = /\bsk-[A-Za-z0-9]{20,}\b/;

async function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = await readdir(join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (FORBIDDEN.test(path) || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (ALLOWED_EXTENSIONS.test(entry.name)) out.push(path);
  }
  return out;
}

export async function collectFiles() {
  const list = [];
  for (const file of FILES) { try { await stat(join(ROOT, file)); list.push(file); } catch { /* optional file */ } }
  for (const dir of DIRECTORIES) list.push(...await walk(dir));
  return list.map(path => path.split(sep).join('/')).filter(path => !FORBIDDEN.test(path)).sort();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(name.endsWith('.command') ? (0o100755 << 16) >>> 0 : 0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export async function buildPackage(outDir = join(ROOT, 'dist')) {
  const files = await collectFiles();
  const folder = `ArguMentor-v${APP_VERSION}`;
  const entries = [];
  for (const file of files) {
    const data = await readFile(join(ROOT, file));
    if (/\.(mjs|js|json|md|txt|html|css|csv|svg)$/i.test(file) && SECRET.test(data.toString('utf8'))) throw new Error(`Possible API key found in ${file}; packaging stopped.`);
    entries.push({ name: `${folder}/${file}`, data });
  }
  await mkdir(outDir, { recursive: true });
  const target = join(outDir, `${folder}.zip`);
  await writeFile(target, zip(entries));
  return { target, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { target, files } = await buildPackage();
  console.log(`已生成 / Built ${relative(ROOT, target)} (${files.length} files). 不含 .env 或密钥 / No .env or keys included.`);
}
