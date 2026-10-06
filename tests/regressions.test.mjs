// Regression tests for bugs found in the 3 Oct 2026 code review. Each test fails on the pre-fix code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePriorRounds, dropIfPII } from '../core.mjs';
import { readConfig } from '../env.mjs';
import { recordStats, reportHTML } from '../report.mjs';
import { collectFiles } from '../package.mjs';
import { runReview } from '../orchestrator.mjs';
import { createMockProvider } from '../mock.mjs';
import { input } from './helpers.mjs';

test('carried-forward learner text is screened for personal information before it can reach the model', () => {
  const [round] = validatePriorRounds([{
    round: 1,
    priorities: [{ id: 'R1', target: 'Claim', text: 'Narrow the claim.', decision: 'reject', reason: 'Ask me at li.ming@example.com', status: 'declined' }],
    insights: ['Reach me on 13912345678', 'Scores need a human check'],
    questionsAsked: ['What would a manager need?']
  }]);
  assert.equal(round.priorities[0].reason, '', 'a decision reason containing an email is dropped');
  assert.deepEqual(round.insights, ['Scores need a human check'], 'an insight containing a phone number is dropped');
  assert.equal(round.priorities[0].text, 'Narrow the claim.', 'the priority itself is untouched');
  assert.equal(dropIfPII('plain takeaway text', 400), 'plain takeaway text');
  assert.equal(dropIfPII('mail me at a@b.com', 400), '');
});

test('a timeout in a specialist still yields usable priorities instead of a dead-end round', async () => {
  const mock = createMockProvider();
  const callModel = async args => {
    if (args.role === 'socratic') throw new Error('TIMEOUT');
    return mock.complete(args);
  };
  const out = await runReview({ input: input(), callModel });
  assert.equal(out.errors.socratic, 'TIMEOUT');
  assert.ok(out.results.analyst, 'the analyst result is kept');
  assert.ok(out.results.coordinator.priorities.length >= 1, 'the learner still gets a revision priority');
  assert.equal(out.complete, false);
});

test('a timeout in the coordinator falls back to deterministic priorities before failing', async () => {
  const mock = createMockProvider();
  const callModel = async args => {
    if (args.role === 'coordinator') throw new Error('TIMEOUT');
    return mock.complete(args);
  };
  const emitted = [];
  await assert.rejects(runReview({ input: input(), callModel, emit: event => emitted.push(event) }), /TIMEOUT/);
  const coordinator = emitted.findLast(event => event.type === 'result' && event.role === 'coordinator');
  assert.ok(coordinator, 'the client is sent assembled priorities before the error');
  assert.equal(coordinator.result.priorities[0].fallback, true);
});

test('the paste counter reads the character count, not the field index', () => {
  const record = {
    kind: 'argumentor-record', rounds: [],
    events: [
      { t: '2026-10-02T10:00:00Z', type: 'paste', round: 1, detail: 'arguments.0.evidence 300 chars' },
      { t: '2026-10-02T10:01:00Z', type: 'paste', round: 1, detail: 'draft 245 chars' },
      { t: '2026-10-02T10:02:00Z', type: 'paste', round: 1, detail: 'counters.2.response 300 chars' }
    ]
  };
  const stats = recordStats(record);
  assert.equal(stats.pastes, 3);
  assert.equal(stats.pastedChars, 845);
});

test('the printable report survives a hand-edited record instead of throwing', () => {
  const record = {
    kind: 'argumentor-record', exportedAt: '2026-10-03T00:00:00Z', appVersion: '4.0.0', learnerCode: 'X',
    data: { topic: 't', claim: 'c', arguments: [], counters: [] },
    rounds: [{ id: 1, input: null, meta: {}, dialogue: {}, decisions: {}, revisions: [],
      results: { coordinator: { focus: 'f' }, analyst: { focus: 'a' }, socratic: { focus: 's' }, language: { focus: 'l' } },
      check: { result: { focus: 'x' } } }]
  };
  assert.ok(reportHTML(record, 'en').length > 100);
});

test('budget floors cannot be set below the per-request reservation', () => {
  const config = readConfig({ MAX_PROVIDER_CALLS: '4', MAX_DAILY_TOKENS: '100' });
  assert.ok(config.budget >= 12, 'a budget under one review would reject every request');
  assert.ok(config.tokenBudget >= 20000);
});

test('the release package ships .env.example but no real key file', async () => {
  const files = await collectFiles();
  assert.ok(files.includes('.env.example'), 'the README points learners at this file');
  assert.ok(!files.some(file => /(^|\/)\.env$/.test(file)));
  assert.ok(!files.some(file => /\.env\.old$|backup/.test(file)));
});
