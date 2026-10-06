// check.mjs — free connection self-test (npm run check).
// Verifies the saved key and the configured model through GET /models, which uses no tokens.
// It prints model names only; the key is never shown.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, readConfig } from './env.mjs';
import { createDeepSeekProvider } from './provider.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const report = await loadEnv(root);
const config = readConfig();
if (report.legacyFile) console.log('⚠ 密钥文件位于项目文件夹内（.env）。运行 npm run setup 可迁移到私有位置。\n⚠ The key file (.env) is inside the project folder. Run npm run setup to move it.');

if (!config.key) {
  console.log('未找到 DeepSeek API 密钥，请先运行 npm run setup。\nNo DeepSeek API key found. Run npm run setup first.');
  process.exit(1);
}

const provider = createDeepSeekProvider(config);
try {
  const models = await provider.listModels({ signal: AbortSignal.timeout(15000) });
  const available = models.includes(config.model);
  console.log(`密钥有效 / Key accepted.\n账户可用模型 / Models available: ${models.join(', ') || '(none listed)'}`);
  console.log(`当前配置模型 / Configured model: ${config.model} — ${available ? '可用 / available' : '不在列表中 / NOT in the list'}`);
  if (!available) {
    console.log('请运行 npm run setup 选择上面列出的模型名称。\nRun npm run setup and choose one of the listed model names.');
    process.exitCode = 2;
  }
} catch (error) {
  const messages = {
    KEY_REJECTED: 'DeepSeek 未接受当前密钥。 / DeepSeek rejected the key.',
    PROVIDER_LIMIT: 'DeepSeek 暂时限流，请稍后再试。 / DeepSeek is rate limiting; try again later.'
  };
  console.log(messages[error.message] || `连接失败 / Connection failed: ${error.message || error.name}`);
  process.exitCode = 1;
}
