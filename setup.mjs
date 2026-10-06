// setup.mjs — interactive local configuration (npm run setup).
// Saves the DeepSeek key in a private config folder OUTSIDE the project (never in the project folder),
// verifies it for free through GET /models, and lets the user pick one of the account's models.
// The key is never echoed: only its length and last four characters are shown for checking.
import { createInterface } from 'node:readline/promises';
import { createInterface as rawLines } from 'node:readline';
import { Writable } from 'node:stream';
import { access, writeFile, chmod, mkdir, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDir, parseEnv, DEFAULT_MODEL } from './env.mjs';
import { createDeepSeekProvider } from './provider.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dir = configDir();
const target = join(dir, 'env');
const legacy = join(root, '.env');
const exists = async path => { try { await access(path); return true; } catch { return false; } };

if (!process.stdin.isTTY) {
  console.error('请在自己的终端运行本设置程序 / Run this setup in your own terminal.');
  process.exit(1);
}
console.log(`论证工坊：本机 DeepSeek 配置 / Local DeepSeek setup\n密钥将保存在项目文件夹之外的私有位置 / The key is stored outside the project folder:\n  ${target}\n密钥不会显示，也不会进入网页、学习报告或发布包。/ The key is never shown and never enters pages, reports or release packages.\n`);

const ask = createInterface({ input: process.stdin, output: process.stdout });
const yes = async question => (await ask.question(question)).trim().toLowerCase() === 'y';

// Move a legacy project-folder .env to the private location without displaying it.
if (await exists(legacy)) {
  if (await yes('发现项目文件夹内的 .env（复制或压缩文件夹会泄露密钥）。迁移到私有位置？/ Found a .env inside the project folder. Move it to the private location? [y/N] ')) {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if (await exists(target)) {
      console.log('私有位置已有配置；项目内 .env 已重命名为 .env.old，请检查后删除。/ A private config already exists; the project .env was renamed to .env.old. Delete it after checking.');
      await rename(legacy, join(root, '.env.old'));
    } else {
      await rename(legacy, target);
      await chmod(target, 0o600);
      console.log('已迁移。/ Moved.');
    }
  }
}

if (await exists(target) && !(await yes('已有本机配置。替换？/ Existing configuration: replace it? [y/N] '))) {
  ask.close();
  process.exit(0);
}
ask.close();

// A muted output stream prevents terminal echo of the key.
const muted = new Writable({ write(chunk, encoding, callback) { callback(); } });
const secret = rawLines({ input: process.stdin, output: muted, terminal: true });
process.stdout.write('粘贴 DeepSeek API key（输入不显示）/ Paste your DeepSeek API key (hidden): ');
secret.on('SIGINT', () => { secret.close(); process.stdout.write('\n已取消。/ Cancelled.\n'); process.exit(0); });
const key = await new Promise(resolve => secret.question('', answer => resolve(answer.trim())));
secret.close();
process.stdout.write('\n');
if (!/^[A-Za-z0-9_.-]{10,}$/.test(key)) {
  console.error('密钥格式不正确，未保存。/ The key format looks wrong; nothing was saved.');
  process.exit(1);
}
console.log(`已读取密钥 / Key read: ${key.slice(0, 3)}${'•'.repeat(8)}${key.slice(-4)} (${key.length} 个字符 / characters)`);

// Free verification: GET /models uses no tokens.
let models = [];
try {
  models = await createDeepSeekProvider({ key, model: DEFAULT_MODEL }).listModels({ signal: AbortSignal.timeout(15000) });
  console.log(`密钥有效。账户可用模型 / Key accepted. Models: ${models.join(', ')}`);
} catch (error) {
  console.log(error.message === 'KEY_REJECTED' ? 'DeepSeek 未接受该密钥。/ DeepSeek rejected this key.' : `暂时无法验证（${error.message}），仍可保存。/ Could not verify now (${error.message}); you can still save.`);
}

const confirm = createInterface({ input: process.stdin, output: process.stdout });
const suggested = models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : (models[0] || DEFAULT_MODEL);
const chosen = (await confirm.question(`模型名称 / Model [${suggested}]: `)).trim() || suggested;
if (!/^[A-Za-z0-9_.:-]+$/.test(chosen)) {
  console.error('模型名称格式不正确。/ Invalid model name.');
  confirm.close();
  process.exit(1);
}
if (models.length && !models.includes(chosen)) console.log('⚠ 该模型不在账户列表中。/ This model is not in the account list.');
const accepted = (await confirm.question('请对照 DeepSeek 平台核对末四位。确认保存？/ Check the last four characters on the DeepSeek platform. Save? [y/N] ')).trim().toLowerCase();
confirm.close();
if (accepted !== 'y') {
  console.log('已取消，原有配置未更改。/ Cancelled; nothing changed.');
  process.exit(0);
}

let extra = '';
if (await exists(target)) {
  // Keep the user's other settings (port, budgets, classroom options) when replacing the key.
  const { values } = parseEnv(await readFile(target, 'utf8'));
  extra = Object.entries(values).filter(([name]) => !['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'].includes(name)).map(([name, value]) => `${name}=${value}`).join('\n');
}
await mkdir(dir, { recursive: true, mode: 0o700 });
await writeFile(target, `DEEPSEEK_API_KEY=${key}\nDEEPSEEK_MODEL=${chosen}\n${extra ? `${extra}\n` : 'PORT=4186\nMAX_PROVIDER_CALLS=300\nMAX_DAILY_TOKENS=2000000\n'}`, { mode: 0o600 });
await chmod(target, 0o600);
console.log('本机配置已保存。运行 npm start 后在浏览器打开 http://localhost:4186。\nSaved. Run npm start, then open http://localhost:4186.');
