// demo/build-demo.mjs — wraps a recorded learner session (exported state JSON) into the replayable
// demo file that the app loads at /demo/workplace-ai-monitoring.json.
//   node demo/build-demo.mjs <recorded-state.json>
// Agent outputs inside the recording came from real DeepSeek runs; nothing here is re-generated.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateState, APP_VERSION } from '../core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const NARRATION = {
  frame: {
    zh: [
      '演示学习者是一名英语专业二年级学生（由 AI 助手扮演），B2 水平，正在完成教师布置的“职场 AI 监控”议论文。',
      '教师任务已锁定议题和读者，并附带三份可核查材料（S1–S3）。',
      '下面的智能体输出全部录制自真实的 DeepSeek 运行，不是预先写好的台词。'
    ],
    en: [
      'The demo learner is a second-year English major (role-played by an AI assistant) at B2 level, writing the assigned essay on AI monitoring at work.',
      'The teacher task locks the question and audience and supplies three checkable sources (S1–S3).',
      'Every agent output below was recorded from a real DeepSeek run, not scripted in advance.'
    ]
  },
  map: {
    zh: [
      '学生最初把 S1 的原文记错为“flagged workers who helped their colleagues as lazy”。',
      '程序逐词核对后标记为“引文未在材料中找到”，学生自行改正——这一步没有调用模型。'
    ],
    en: [
      'The learner first misquoted S1 as "flagged workers who helped their colleagues as lazy".',
      'The software checked it word by word, marked it "quote not found", and the learner fixed it — with no model call involved.'
    ]
  },
  coach: {
    zh: [
      '第 1 轮：学生先自评“理由 2 缺少推理联系”，分析角色确认了这一判断，并进一步指出主张过宽。',
      '对话是关键：在 S1 的三轮追问后，学生自己得出“真正的问题是没有人工复核的 AI 评分，而不是监控本身”。',
      '这句话是学生写的，不是 AI 写的；系统只是不断追问。',
      '切换到第 2 轮标签可以看到，新一轮反馈知道学生上一轮拒绝了哪条建议。'
    ],
    en: [
      'Round 1: the learner self-assessed "Reason 2 has no warrant"; the analyst agreed and added that the claim was overbroad.',
      'The dialogue is where the work happens: after three turns on S1, the learner reached their own conclusion — "the real problem is using AI scores without a human check, not monitoring itself".',
      'That sentence is the learner\'s, not the AI\'s. The system only kept asking.',
      'Switch to the Round 2 tab to see that the next round knows which advice the learner declined.'
    ]
  },
  revise: {
    zh: [
      '每条修订重点都必须作出决定：采纳、调整、不采纳，或“还没看懂”。拒绝也要写明理由。',
      '第 2 轮中学生拒绝了 R2，理由是限定句已经排除了安全提醒——系统尊重这个决定，不再重复劝说。',
      '修订稿由学生自己完成；差异视图显示新增 271 词、删除 114 词。'
    ],
    en: [
      'Every priority needs a decision: accept, adapt, reject, or "not sure what it means". A rejection needs a reason too.',
      'In round 2 the learner rejected R2, arguing the qualifier already excludes safety alerts — the system respects that and does not push again.',
      'The learner writes the revision themselves; the diff view shows 271 words added and 114 removed.'
    ]
  },
  reflect: {
    zh: [
      '修订检查只描述“读者现在能看到什么”，不打分：第 1 轮两条重点均“已体现”，第 2 轮一条“部分体现”、一条“学生决定不采纳”。',
      'AI 使用说明根据过程记录自动草拟，由学生确认后导出。',
      '导出的记录带有校验码，教师可在“教师”页面汇总全班情况。'
    ],
    en: [
      'The revision check only describes what a reader can now see; it does not score. Round 1: both priorities visible. Round 2: one partly visible, one declined by the learner.',
      'The AI-use statement is drafted from the process record and confirmed by the learner before export.',
      'The exported record carries a checksum; teachers aggregate the class on the Teacher page.'
    ]
  }
};

const [, , source] = process.argv;
if (!source) {
  console.error('Usage: node demo/build-demo.mjs <recorded-state.json>');
  process.exit(1);
}

const raw = JSON.parse(await readFile(source, 'utf8'));
// Accept either a raw localStorage state or an exported record (which nests the same fields).
const saved = raw.kind === 'argumentor-record' ? { version: 4, lang: raw.lang, page: 'coach', learnerCode: raw.learnerCode, task: raw.task, data: raw.data, rounds: raw.rounds, current: raw.rounds.length - 1, transfer: raw.transfer, goalCheck: raw.goalCheck, disclosure: raw.disclosure, aiUse: raw.aiUse, researchConsent: raw.researchConsent, events: raw.events } : raw;
const { state, dropped } = migrateState(saved);
if (dropped.length) console.warn('Dropped while validating:', dropped.join(', '));
if (!state.rounds.length) throw new Error('The recording contains no completed rounds.');

const meta = {
  topicZh: '职场 AI 监控',
  topicEn: 'AI monitoring at work',
  recordedAt: state.rounds[0].meta?.at?.slice(0, 10) || '',
  model: state.rounds[0].meta?.servedModel || state.rounds[0].meta?.model || '',
  promptVersion: state.rounds[0].meta?.promptVersion || '',
  appVersion: APP_VERSION,
  rounds: state.rounds.length,
  calls: state.rounds.reduce((sum, round) => sum + (round.meta?.calls || 0), 0),
  tokens: state.rounds.reduce((sum, round) => sum + (round.meta?.tokens || 0), 0),
  learnerNote: 'The learner is simulated (role-played by an AI assistant). All agent outputs are real DeepSeek responses recorded during the session.'
};

state.page = 'coach';
state.current = 0;
await writeFile(join(ROOT, 'demo', 'workplace-ai-monitoring.json'), `${JSON.stringify({ kind: 'argumentor-demo', version: 1, meta, narration: NARRATION, state }, null, 1)}\n`);
console.log(`Wrote demo/workplace-ai-monitoring.json — ${meta.rounds} rounds, ${meta.calls} model calls, ${meta.tokens} tokens, model ${meta.model}.`);
