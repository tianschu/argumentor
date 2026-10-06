import test from 'node:test';
import assert from 'node:assert/strict';
import { englishIssue, validateInput, validateLearnerText, findSpan, locateAnchor, learnerFields, checkSourceQuotes, migrateState, validateTask, changedFields, sameInput, languageSignals, redactPII, screenPII, mapSummary, validateSelfAssessment, selfAssessmentOptions, normalizeRoleResult, EXAMPLE, InputError } from '../core.mjs';
import { MAP, SOURCES, input } from './helpers.mjs';

const fails = (fn, code, field) => {
  try { fn(); } catch (error) {
    assert.equal(error.message, code);
    if (field !== undefined) assert.equal(error.field, field);
    return error;
  }
  assert.fail(`expected ${code}`);
};

test('English rule allows short Chinese glosses but not Chinese sentences', () => {
  assert.equal(englishIssue('Kunqu (昆曲) is a traditional opera form that students could study.'), null);
  assert.equal(englishIssue('Many workers dislike the 996 schedule (996工作制) and long hours.'), null);
  assert.equal(englishIssue('我认为 AI monitoring is bad'), 'ENGLISH_REQUIRED');
  assert.equal(englishIssue('AI monitoring is bad (我认为这是一个非常严重的问题，必须马上解决)'), 'ENGLISH_REQUIRED');
  assert.equal(englishIssue('这是中文。'), 'ENGLISH_REQUIRED');
  assert.equal(englishIssue('Plain English only.'), null);
});

test('validateInput accepts a Chinese source title and names the failing field', () => {
  const data = structuredClone(MAP);
  data.arguments[0].source = '王明（2020）《昆曲传承研究》, CNKI';
  assert.equal(validateInput(data).arguments[0].source, '王明（2020）《昆曲传承研究》, CNKI');
  data.arguments[1].reason = '因为人工智能经常出错，所以不应该使用。';
  fails(() => validateInput(data), 'ENGLISH_REQUIRED', 'arguments.1.reason');
});

test('validateInput blocks personal information with its type', () => {
  const data = structuredClone(MAP);
  data.draft += ' Contact me at li.wei@example.com.';
  const error = fails(() => validateInput(data), 'PII_DETECTED', 'draft');
  assert.equal(error.detail, 'email');
  assert.equal(screenPII('Call 13812345678'), 'phone');
  assert.equal(screenPII('ID 11010519491231002X'), 'id-number');
  assert.equal(screenPII('https://example.com/a/2023121200012', { source: true }), null);
  assert.match(redactPII('mail li.wei@example.com or 13812345678'), /\[email\].*\[phone\]/);
});

test('validateInput requires topic, claim and one reason, and normalises enums', () => {
  fails(() => validateInput({ ...MAP, claim: '' }), 'MISSING_INPUT', 'claim');
  fails(() => validateInput({ ...MAP, arguments: [{ reason: '' }] }), 'MISSING_REASON', 'arguments.0.reason');
  const data = validateInput({ ...MAP, counters: [{ target: 'Reason 9', counter: 'x y z', strategy: 'shout', response: '' }] });
  assert.deepEqual(data.counters[0], { target: 'Claim', counter: 'x y z', strategy: '', response: '' });
  assert.equal(validateInput({ ...MAP, counters: undefined }).counters.length, 1);
  assert.equal(validateInput({ ...MAP, arguments: [{ ...MAP.arguments[0], evidenceType: 'nonsense' }] }).arguments[0].evidenceType, '');
});

test('anchors match the learner text regardless of case and punctuation, returning the original span', () => {
  assert.equal(findSpan('constant monitoring makes workers feel stressed', 'Constant monitoring makes workers feel stressed and distrusted.'), 'Constant monitoring makes workers feel stressed');
  assert.equal(findSpan('AI systems can misjudge normal behavior', 'AI systems can misjudge normal behaviour as laziness.'), null);
  const hit = locateAnchor('the tracking app … makes everyone nervous', learnerFields(input()));
  assert.equal(hit.path, 'arguments.0.evidence');
});

test('source quotes are checked against the cited teacher source', () => {
  assert.equal(checkSourceQuotes(input(), SOURCES)[0].status, 'found');
  const data = input();
  data.arguments[1].evidence = 'The case reports that "the system punished workers who helped colleagues".';
  assert.equal(checkSourceQuotes(data, SOURCES)[0].status, 'not-found');
  data.arguments[1].source = 'S4';
  assert.equal(checkSourceQuotes(data, SOURCES)[0].status, 'unknown-source');
});

test('self-assessment must name a real element and give an English reason', () => {
  const data = input();
  assert.ok(selfAssessmentOptions(data).some(([value]) => value === 'arguments.1.warrant'));
  fails(() => validateSelfAssessment({ element: 'arguments.7.reason', reason: 'I am not sure about it.' }, data), 'SELF_ASSESSMENT_REQUIRED', 'self.element');
  fails(() => validateSelfAssessment({ element: 'claim', reason: 'weak' }, data), 'TOO_SHORT');
  assert.equal(validateSelfAssessment({ element: 'claim', reason: 'My claim may be too strong.' }, data).label, 'Claim');
});

test('reflection fields may allow Chinese when the task permits it', () => {
  assert.equal(validateLearnerText('下次我会先检查每个理由的证据。', 'transfer', { allowChinese: true }), '下次我会先检查每个理由的证据。');
  fails(() => validateLearnerText('下次我会先检查每个理由的证据。', 'transfer'), 'ENGLISH_REQUIRED');
});

test('language signals and map summary are deterministic', () => {
  const signals = languageSignals(input());
  assert.ok(signals.some(item => item.signal === 'booster' && /totally/.test(item.match)));
  const summary = mapSummary(input());
  assert.ok(summary.notYetWritten.includes('Reason 1: warrant not written yet'));
  assert.ok(summary.notYetWritten.includes('Qualifier: not written yet'));
});

test('changedFields lists edited paths', () => {
  const before = input();
  const after = structuredClone(before);
  after.qualifier = 'Only for continuous keystroke monitoring.';
  after.arguments[0].warrant = 'Stress lowers performance.';
  assert.deepEqual(changedFields(before, after), ['qualifier', 'arguments.0.warrant']);
  assert.ok(sameInput(before, structuredClone(before)));
});

test('task files are validated and source ids renumbered', () => {
  assert.throws(() => validateTask({ kind: 'argumentor-task', title: '' }), InputError);
  const task = validateTask({ kind: 'argumentor-task', title: 'T', topic: 'Q?', sources: [{ title: '', text: '' }, { title: 'B', text: 'b' }], focus: ['evidence', 'stance'], aiUse: 'nope' });
  assert.equal(task.sources[0].id, 'S1');
  assert.deepEqual(task.focus, ['evidence']);
  assert.equal(task.aiUse, 'argumentor-only');
});

test('v3 records migrate to v4 without losing learner writing', () => {
  const v3 = {
    version: 3, lang: 'en', page: 'reflect',
    data: { topic: 'T?', audience: 'A', level: 'B1', claim: 'C.', arguments: [{ reason: 'R.', evidence: '', source: '', warrant: '' }], counter: 'Old counter.', response: 'Old response.', draft: 'Draft.' },
    results: { analyst: { focus: 'F', observations: ['Obs one.'], questions: ['Q?'] }, coordinator: { focus: 'G', observations: ['Do this.'], questions: [] } },
    analysisInput: { topic: 'T?', claim: 'C.', arguments: [{ reason: 'R.' }], counter: 'Old counter.' },
    revised: 'My revision.', decision: 'I accepted it.', transfer: 'Check warrants.', versions: [{ at: '2026-09-01', revised: 'v1 text' }]
  };
  const { state, dropped } = migrateState(v3);
  assert.equal(state.data.counters[0].counter, 'Old counter.');
  assert.equal(state.data.counters[0].response, 'Old response.');
  assert.equal(state.rounds.length, 1);
  assert.equal(state.rounds[0].revised, 'My revision.');
  assert.equal(state.rounds[0].note, 'I accepted it.');
  assert.equal(state.rounds[0].results.coordinator.priorities[0].text, 'Do this.');
  assert.equal(state.transfer, 'Check warrants.');
  assert.equal(state.page, 'revise');
  assert.deepEqual(dropped, []);
});

test('a damaged part of a v4 record is dropped and reported, the rest survives', () => {
  const good = { role: 'analyst', focus: 'F', items: [{ id: 'A1', criterion: 'warrant', text: 'T' }] };
  const saved = { version: 4, lang: 'zh', data: MAP, rounds: [{ id: 1, input: MAP, results: { analyst: good, socratic: { focus: '' } }, revised: 'Kept revision.' }], transfer: 'Keep me.' };
  const { state, dropped } = migrateState(saved);
  assert.equal(state.rounds[0].revised, 'Kept revision.');
  assert.ok(state.rounds[0].results.analyst);
  assert.ok(!state.rounds[0].results.socratic);
  assert.ok(dropped.some(item => item.includes('socratic')));
  assert.equal(state.transfer, 'Keep me.');
});

test('normalizeRoleResult keeps only known enums', () => {
  const result = normalizeRoleResult({ focus: 'F', checks: { claim: { scope: 'huge', answersTopic: 'yes' }, reasons: [{ target: 'Reason 1', evidenceStatus: 'personal', evidenceLink: 'partly', claimLink: 'bad' }] }, frames: ['It is likely that …'] }, 'analyst');
  assert.equal(result.checks.claim.scope, '');
  assert.equal(result.checks.reasons[0].claimLink, '');
  assert.deepEqual(result.frames[0], { move: '', text: 'It is likely that …' });
});

test('the built-in example is valid input', () => {
  assert.ok(validateInput(EXAMPLE));
});
