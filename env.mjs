// env.mjs — configuration loading shared by server.mjs, setup.mjs, check.mjs and the eval scripts.
// The API key lives OUTSIDE the project folder (so copying or zipping the folder can never leak it):
//   macOS/Linux: ~/.config/argumentor/env      Windows: %APPDATA%\ArguMentor\env
//   (override with ARGUMENTOR_CONFIG_DIR). A legacy project-folder .env is still read, with a warning.
// Precedence: real environment variables > private config file > legacy project .env. Values are never printed.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_MODEL = 'deepseek-flash';

export function configDir(env = process.env) {
  if (env.ARGUMENTOR_CONFIG_DIR) return env.ARGUMENTOR_CONFIG_DIR;
  if (process.platform === 'win32') return join(env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'ArguMentor');
  return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'argumentor');
}

// Tolerant parser: ignores blank lines and # comments (also trailing comments), strips quotes and a BOM.
export function parseEnv(text) {
  const values = {};
  const warnings = [];
  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#]*?))\s*(?:#.*)?$/);
    if (!match) { warnings.push(index + 1); return; }
    values[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  });
  return { values, warnings };
}

async function readEnvFile(path) {
  try {
    return parseEnv(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Loads both files into process.env (without overriding real environment variables).
export async function loadEnv(root) {
  const report = { privateFile: false, legacyFile: false, warnings: [] };
  const sources = [[join(configDir(), 'env'), 'privateFile'], [join(root, '.env'), 'legacyFile']];
  for (const [path, flag] of sources) {
    const parsed = await readEnvFile(path);
    if (!parsed) continue;
    report[flag] = true;
    report.warnings.push(...parsed.warnings.map(line => `${flag === 'privateFile' ? 'config' : '.env'}:${line}`));
    for (const [key, value] of Object.entries(parsed.values)) if (process.env[key] === undefined) process.env[key] = value;
  }
  return report;
}

const integer = (value, fallback, min, max) => {
  const number = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function readConfig(env = process.env) {
  const provider = String(env.PROVIDER || 'deepseek').toLowerCase() === 'mock' ? 'mock' : 'deepseek';
  const thinking = ['disabled', 'enabled', 'omit'].includes(env.DEEPSEEK_THINKING) ? env.DEEPSEEK_THINKING : 'disabled';
  const mode = String(env.REVIEW_MODE || 'multi').toLowerCase();
  return {
    provider,
    key: env.DEEPSEEK_API_KEY || '',
    model: /^[A-Za-z0-9_.:-]{1,80}$/.test(env.DEEPSEEK_MODEL || '') ? env.DEEPSEEK_MODEL : DEFAULT_MODEL,
    baseUrl: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    thinking,
    reviewMode: ['multi', 'multi-nocoord', 'single'].includes(mode) ? mode : 'multi',
    host: env.HOST || '127.0.0.1',
    port: integer(env.PORT, 4186, 1, 65535),
    allowedHosts: String(env.ALLOWED_HOSTS || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean),
    accessCode: env.ACCESS_CODE || '',
    // Daily ceilings; they persist across restarts in the private config folder (usage.json).
    // The floors are the largest per-request reservation (12 calls) and token headroom (20000); below
    // them the server would admit no reviews at all, which looks like a broken install rather than a cap.
    budget: integer(env.MAX_PROVIDER_CALLS, 300, 12, 1000000),
    tokenBudget: integer(env.MAX_DAILY_TOKENS, 2000000, 20000, 1000000000),
    maxConcurrent: integer(env.MAX_CONCURRENT, 2, 1, 32),
    maxQueue: integer(env.MAX_QUEUE, 40, 0, 500)
  };
}
