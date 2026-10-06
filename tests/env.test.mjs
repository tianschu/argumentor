import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv, readConfig } from '../env.mjs';
import { APP_VERSION } from '../core.mjs';

test('the config parser tolerates comments, quotes and a BOM', () => {
  const { values, warnings } = parseEnv('﻿# comment\nDEEPSEEK_MODEL=deepseek-flash   # trailing comment\nPORT="4190"\nACCESS_CODE=\'a b\'\nbad line\n\nMAX_PROVIDER_CALLS=120 # per day');
  assert.equal(values.DEEPSEEK_MODEL, 'deepseek-flash');
  assert.equal(values.PORT, '4190');
  assert.equal(values.ACCESS_CODE, 'a b');
  assert.equal(values.MAX_PROVIDER_CALLS, '120');
  assert.deepEqual(warnings, [5]);
});

test('invalid numbers fall back to safe defaults instead of disabling the budget', () => {
  const config = readConfig({ MAX_PROVIDER_CALLS: 'lots', PORT: 'x', REVIEW_MODE: 'weird', DEEPSEEK_MODEL: 'bad model name!' });
  assert.equal(config.budget, 300);
  assert.equal(config.port, 4186);
  assert.equal(config.reviewMode, 'multi');
  assert.equal(config.model, 'deepseek-flash');
  assert.equal(readConfig({ REVIEW_MODE: 'single' }).reviewMode, 'single');
});

test('package.json version matches the app version', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, APP_VERSION);
});
