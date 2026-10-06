// report.mjs — learning records: the exported JSON record (with a checksum), the printable HTML report,
// and per-record statistics for the teacher dashboard. DOM-free, so it is unit-tested in Node.
import { APP_VERSION, ROLES, CRITERIA, QUESTION_TYPES, SCHEMES, DECISIONS, CHECK_STATUS, MOVES, EVIDENCE_TYPES, STRATEGIES, AI_USE_LEVELS, countWords, isObject } from './core.mjs';
import { html, raw, esc } from './html.mjs';
import { wordDiff } from './diff.mjs';
import { sha256Hex } from './sha256.mjs';

// ---------- record and checksum ----------
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

async function sha256(text) {
  if (!globalThis.crypto?.subtle) return sha256Hex(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildRecord(state, { service = {}, demo = false, example = false, goal = '' } = {}) {
  const record = {
    kind: 'argumentor-record',
    format: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    lang: state.lang,
    learnerCode: state.learnerCode || '',
    demo: Boolean(demo),
    example: Boolean(example),
    selfReported: true,
    task: state.task,
    data: state.data,
    rounds: state.rounds,
    goal,
    goalCheck: state.goalCheck,
    transfer: state.transfer,
    aiUse: state.aiUse,
    disclosure: state.disclosure,
    researchConsent: Boolean(state.researchConsent),
    events: state.events,
    service: { provider: service.provider || '', model: service.model || '', live: service.live !== false, mode: service.mode || '' }
  };
  record.checksum = `sha256:${await sha256(stableStringify(record))}`;
  return record;
}

export async function verifyRecord(record) {
  if (!isObject(record) || record.kind !== 'argumentor-record' || typeof record.checksum !== 'string') return false;
  const { checksum, ...rest } = record;
  return checksum === `sha256:${await sha256(stableStringify(rest))}`;
}

const slug = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'argument';
export function fileName(record, extension) {
  const date = (record.exportedAt || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
  const name = [`ArguMentor`, slug(record.task?.title || record.data?.topic), record.learnerCode ? slug(record.learnerCode) : 'learner', date].join('_');
  return `${record.demo ? 'DEMO_' : ''}${name}.${extension}`;
}

// ---------- statistics for the teacher dashboard ----------
export function recordStats(record) {
  const rounds = Array.isArray(record.rounds) ? record.rounds : [];
  const stats = {
    rounds: rounds.length, replies: 0, threads: 0, clarifications: 0,
    decisions: { accept: 0, adapt: 0, reject: 0, unclear: 0 },
    checks: { visible: 0, partly: 0, 'not-yet': 0, declined: 0 },
    criteria: {}, questionTypes: {}, selfAgreement: [], pastes: 0, pastedChars: 0,
    firstWords: countWords(rounds[0]?.input?.draft || ''), finalWords: countWords(rounds.at(-1)?.revised || ''),
    minutes: 0, statement: Boolean(String(record.disclosure || '').trim()), insights: []
  };
  for (const round of rounds) {
    for (const [id, thread] of Object.entries(round.dialogue || {})) {
      const learnerTurns = (thread.turns || []).filter(turn => turn.from === 'learner').length;
      stats.replies += learnerTurns;
      if (learnerTurns) {
        if (thread.kind === 'feedback') stats.clarifications += 1;
        else {
          stats.threads += 1;
          const question = round.results?.socratic?.questions?.find(item => item.id === id);
          if (question) stats.questionTypes[question.type] = (stats.questionTypes[question.type] || 0) + 1;
        }
      }
      for (const turn of thread.turns || []) if (turn.insight) stats.insights.push({ question: round.results?.socratic?.questions?.find(item => item.id === id)?.text || '', insight: turn.insight });
      if (thread.takeaway) stats.insights.push({ question: round.results?.socratic?.questions?.find(item => item.id === id)?.text || '', insight: thread.takeaway });
    }
    for (const decision of Object.values(round.decisions || {})) if (stats.decisions[decision.decision] !== undefined) stats.decisions[decision.decision] += 1;
    for (const item of round.check?.result?.checks || []) if (stats.checks[item.status] !== undefined) stats.checks[item.status] += 1;
    for (const item of round.results?.analyst?.items || []) stats.criteria[item.criterion] = (stats.criteria[item.criterion] || 0) + 1;
    if (round.results?.analyst?.selfAssessment) stats.selfAgreement.push(round.results.analyst.selfAssessment.agreement);
  }
  for (const event of record.events || []) {
    if (event.type === 'paste') { stats.pastes += 1; stats.pastedChars += Number(String(event.detail).match(/(\d+) chars/)?.[1] || 0); }
  }
  const times = (record.events || []).map(event => Date.parse(event.t)).filter(Number.isFinite);
  if (times.length > 1) stats.minutes = Math.round((Math.max(...times) - Math.min(...times)) / 60000);
  return stats;
}

// ---------- printable HTML report ----------
const STYLE = `body{max-width:880px;margin:32px auto;padding:0 22px;font:15px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f332d;background:#fff}
h1,h2,h3{color:#164c45;line-height:1.35}h1{font-size:1.7rem;margin-bottom:4px}h2{border-bottom:1px solid #d6e0d4;padding-bottom:6px;margin-top:34px}h3{margin:20px 0 6px;font-size:1.02rem}
.meta,.note{background:#eef4ea;padding:12px 14px;border-radius:8px;font-size:.86rem}.flag{display:inline-block;background:#fdf1dc;color:#7a5520;border-radius:6px;padding:1px 8px;margin-right:6px;font-size:.8rem}
.box{border:1px solid #dbe3d8;border-radius:10px;padding:12px 15px;margin:10px 0}.quote{border-left:3px solid #9bb98e;background:#f6f8f1;padding:4px 10px;margin:6px 0;font-style:italic}
.tag{display:inline-block;font-size:.74rem;border:1px solid #cad8c6;border-radius:999px;padding:0 8px;margin-right:5px;color:#35574a}
.turn{margin:6px 0;padding:6px 10px;border-radius:8px}.learner{background:#f3f6fa}.coach{background:#f4f8ef}
ins{background:#dff3e2;text-decoration:none}del{background:#fbe3e0;color:#7c2f25}table{border-collapse:collapse;width:100%;font-size:.86rem}td,th{border:1px solid #dbe3d8;padding:5px 7px;text-align:left;vertical-align:top}
.small{font-size:.8rem;color:#5d6f68}section{break-inside:avoid}@media print{body{margin:0}h2{break-after:avoid}}`;

const tr = lang => (zh, en) => (lang === 'en' ? en : zh);
const label = (value, lang) => (value ? value[lang === 'en' ? 'en' : 'zh'] : '');
const para = text => (text ? html`<p>${raw(esc(text).replace(/\n/g, '<br>'))}</p>` : '');

function diffMarkup(before, after) {
  const parts = wordDiff(before, after);
  if (!parts) return '';
  return html`<p>${parts.map(part => (part.type === 'same' ? part.text : part.type === 'add' ? html`<ins>${part.text}</ins>` : html`<del>${part.text}</del>`))}</p>`;
}

function mapMarkup(data, T, lang) {
  if (!data) return '';
  return html`
    <p><b>${T('议题', 'Question')}:</b> ${data.topic}</p>
    <p><b>${T('读者', 'Audience')}:</b> ${data.audience || '—'} · <b>${T('支持等级', 'Support level')}:</b> ${data.level}</p>
    <p><b>${T('主张', 'Claim')}:</b> ${data.claim}</p>
    ${data.qualifier ? html`<p><b>${T('限定', 'Qualifier')}:</b> ${data.qualifier}</p>` : ''}
    ${(data.arguments || []).map((unit, index) => html`<div class="box"><b>${T('理由', 'Reason')} ${index + 1}:</b> ${unit.reason || '—'}
      <br><b>${T('证据', 'Evidence')}</b> ${unit.evidenceType ? html`<span class="tag">${label(EVIDENCE_TYPES[unit.evidenceType], lang)}</span>` : ''}: ${unit.evidence || '—'}
      <br><b>${T('来源', 'Source')}:</b> ${unit.source || '—'}<br><b>${T('推理联系', 'Warrant')}:</b> ${unit.warrant || '—'}</div>`)}
    ${(data.counters || []).filter(unit => unit.counter || unit.response).map((unit, index) => html`<div class="box"><b>${T('异议', 'Counterargument')} ${index + 1}</b> (${unit.target}): ${unit.counter || '—'}
      <br><b>${T('回应', 'Response')}</b> ${unit.strategy ? html`<span class="tag">${label(STRATEGIES[unit.strategy], lang)}</span>` : ''}: ${unit.response || '—'}</div>`)}
    ${data.draft ? html`<h3>${T('初稿', 'Draft')}</h3>${para(data.draft)}` : ''}`;
}

function roundMarkup(round, record, T, lang) {
  const results = round.results || {};
  const meta = round.meta || {};
  const coordinator = results.coordinator;
  const analyst = results.analyst;
  const socratic = results.socratic;
  const language = results.language;
  const decisionOf = id => round.decisions?.[id];
  return html`<section>
    <h2>${T('第', 'Round ')}${round.id}${T(' 轮', '')}</h2>
    <p class="meta">${T('时间', 'Time')}: ${meta.at || round.startedAt || '—'} · ${T('模型', 'Model')}: ${meta.model || '—'}${meta.servedModel && meta.servedModel !== meta.model ? ` (served: ${meta.servedModel})` : ''} · ${meta.live === false ? T('离线模板', 'offline template') : meta.provider || ''} · ${T('提示词版本', 'Prompt version')}: ${meta.promptVersion || '—'} · ${T('模式', 'Mode')}: ${meta.mode || '—'} · ${T('调用', 'Calls')}: ${meta.calls ?? '—'} · tokens: ${meta.tokens ?? '—'}${meta.repairs ? ` · ${T('修复', 'repairs')}: ${meta.repairs}` : ''}${meta.consent ? ` · ${T('同意书版本', 'Consent')}: ${meta.consent.version}` : ''} · ${T('状态', 'Status')}: ${round.status}</p>
    <h3>${T('本轮分析的论证', 'Argument as reviewed')}</h3>
    ${mapMarkup(round.input, T, lang)}
    ${round.self ? html`<h3>${T('学习者自评', 'Learner self-assessment')}</h3><p><b>${round.self.label}</b>: ${round.self.reason}${round.self.question ? html`<br>${T('提问', 'Question')}: ${round.self.question}` : ''}</p>
      ${analyst?.selfAssessment ? html`<p class="small">${T('分析回应', 'Analyst response')} (${analyst.selfAssessment.agreement}): ${analyst.selfAssessment.note}</p>` : ''}` : ''}
    ${coordinator ? html`<h3>${T('修订重点', 'Revision priorities')}</h3>${(coordinator.priorities || []).map(item => html`<div class="box"><b>${item.id}</b> <span class="tag">${item.target}</span>${item.fallback ? html`<span class="tag">${T('程序汇总', 'assembled')}</span>` : ''} ${item.text}
      ${item.successCheck ? html`<br><span class="small">${T('自查', 'Check')}: ${item.successCheck}</span>` : ''}
      ${decisionOf(item.id) ? html`<br><b>${T('学习者决定', 'Learner decision')}:</b> ${label(DECISIONS[decisionOf(item.id).decision], lang)}${decisionOf(item.id).reason ? ` — ${decisionOf(item.id).reason}` : ''}` : ''}</div>`)}` : ''}
    ${analyst ? html`<h3>${T('论证分析', 'Argument analysis')}</h3>
      ${analyst.strength ? html`<p><b>${T('值得保留', 'Keep')}:</b> ${analyst.strength.text}${analyst.strength.anchor ? html`<span class="quote">${analyst.strength.anchor}</span>` : ''}</p>` : ''}
      ${(analyst.items || []).map(item => html`<div class="box"><b>${item.id}</b> <span class="tag">${label(CRITERIA[item.criterion]?.label, lang)}</span><span class="tag">${item.target}</span>${item.anchor ? html`<div class="quote">${item.anchor}</div>` : ''}${item.text}${decisionOf(item.id) ? html`<br><span class="small">${T('决定', 'Decision')}: ${label(DECISIONS[decisionOf(item.id).decision], lang)}</span>` : ''}</div>`)}
      ${analyst.schemes?.length ? html`<p class="small">${T('论证类型', 'Schemes')}: ${analyst.schemes.map(item => `${item.target}: ${label(SCHEMES[item.scheme]?.label, lang)}`).join(' · ')}</p>` : ''}` : ''}
    ${socratic ? html`<h3>${T('苏格拉底式追问与对话', 'Socratic questions and dialogue')}</h3>${(socratic.questions || []).map(item => {
      const thread = round.dialogue?.[item.id];
      return html`<div class="box"><b>${item.id}</b> <span class="tag">${label(QUESTION_TYPES[item.type], lang)}</span>${item.text}
        ${(thread?.turns || []).map(turn => html`<div class="turn ${turn.from}"><b>${turn.from === 'learner' ? T('学习者', 'Learner') : `${T('教练', 'Coach')}${turn.move ? ` · ${label(MOVES[turn.move], lang)}` : ''}`}:</b> ${turn.text}</div>`)}
        ${thread?.takeaway ? html`<p class="small">${T('学习者小结', 'Learner takeaway')}: ${thread.takeaway}</p>` : ''}</div>`;
    })}` : ''}
    ${Object.entries(round.dialogue || {}).filter(([, thread]) => thread.kind === 'feedback').map(([id, thread]) => html`<div class="box"><b>${T('询问反馈', 'Asked about feedback')} ${id}</b>${(thread.turns || []).map(turn => html`<div class="turn ${turn.from}"><b>${turn.from === 'learner' ? T('学习者', 'Learner') : T('教练', 'Coach')}:</b> ${turn.text}</div>`)}</div>`)}
    ${language ? html`<h3>${T('语言反馈', 'Language feedback')}</h3>${(language.items || []).map(item => html`<div class="box"><b>${item.id}</b> <span class="tag">${label(CRITERIA[item.criterion]?.label, lang)}</span>${item.anchor ? html`<div class="quote">${item.anchor}</div>` : ''}${item.text}</div>`)}
      ${(language.frames || []).map(frame => html`<p class="small">${frame.move ? `${frame.move}: ` : ''}${frame.text}</p>`)}` : ''}
    ${round.revised ? html`<h3>${T('修订稿', 'Revised text')}</h3>${para(round.revised)}
      ${round.input?.draft ? html`<h3>${T('初稿 → 修订稿（差异）', 'Draft → revision (differences)')}</h3>${diffMarkup(round.input.draft, round.revised)}` : ''}` : ''}
    ${round.note ? html`<p><b>${T('修订说明', 'Revision note')}:</b> ${round.note}</p>` : ''}
    ${round.check?.result ? html`<h3>${T('修订检查', 'Revision check')}</h3><p>${round.check.result.focus}</p>${(round.check.result.checks || []).map(item => html`<div class="box"><b>${item.priorityId}</b> <span class="tag">${label(CHECK_STATUS[item.status], lang)}</span>${item.anchor ? html`<div class="quote">${item.anchor}</div>` : ''}${item.note}</div>`)}${round.check.result.question ? html`<p class="small">${round.check.result.question}</p>` : ''}` : ''}
  </section>`;
}

export function reportBody(record, lang = 'zh') {
  const T = tr(lang);
  const task = record.task;
  return html`
    <h1>${T('论证工坊 · 学习过程记录', 'ArguMentor · Learning record')}</h1>
    <p>${record.demo ? html`<span class="flag">${T('演示记录（模拟学习者）', 'Demo record (simulated learner)')}</span>` : ''}${record.example ? html`<span class="flag">${T('含教学示例数据', 'Contains example data')}</span>` : ''}<span class="flag">${T('学习者自报记录', 'Self-reported record')}</span></p>
    <p class="meta">${T('学习者代码', 'Learner code')}: ${record.learnerCode || '—'} · ${T('导出时间', 'Exported')}: ${record.exportedAt} · ArguMentor ${record.appVersion} · ${T('校验码', 'Checksum')}: <code>${String(record.checksum || '').slice(0, 23)}…</code></p>
    ${task ? html`<h2>${T('教师任务', 'Teacher task')}</h2><p><b>${task.title}</b></p>${para(task.instructions)}${task.requirements?.length ? html`<ul>${task.requirements.map(item => html`<li>${item}</li>`)}</ul>` : ''}<p class="small">${T('AI 使用规则', 'AI-use rule')}: ${label(AI_USE_LEVELS[task.aiUse], lang)}${task.sources?.length ? ` · ${T('材料', 'Sources')}: ${task.sources.map(item => `${item.id} ${item.title}`).join('; ')}` : ''}</p>` : ''}
    <h2>${T('当前论证地图', 'Current argument map')}</h2>
    ${mapMarkup(record.data, T, lang)}
    ${(record.rounds || []).map(round => roundMarkup(round, record, T, lang))}
    <h2>${T('反思与 AI 使用说明', 'Reflection and AI-use statement')}</h2>
    ${record.goal ? html`<p><b>${T('上次设定的目标', 'Goal from last task')}:</b> ${record.goal}</p>${record.goalCheck ? html`<p><b>${T('自我检查', 'Self-check')}:</b> ${record.goalCheck}</p>` : ''}` : ''}
    <p><b>${T('下一次写作的策略', 'Strategy for next essay')}:</b> ${record.transfer || '—'}</p>
    <p><b>${T('AI 使用说明', 'AI-use statement')}:</b> ${record.disclosure || '—'}</p>
    <p class="small">${T('研究使用同意', 'Research-use consent')}: ${record.researchConsent ? T('同意（去标识化）', 'yes (de-identified)') : T('未同意', 'no')}</p>
    <p class="note">${T('本记录由学习者在本机生成并自行导出。校验码可发现意外或随意的修改，但不能证明记录未被刻意篡改。论证工坊不使用 AI 文本检测器。', 'This record was generated on the learner\'s device and exported by the learner. The checksum reveals accidental or casual edits but cannot prove the absence of deliberate tampering. ArguMentor does not use AI-text detectors.')}</p>`;
}

export function reportHTML(record, lang = 'zh') {
  return `<!doctype html><html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fileName(record, 'html'))}</title><style>${STYLE}</style></head><body>${reportBody(record, lang)}</body></html>`;
}

export { ROLES };
export { sha256Hex as sha256Fallback }; // the name the existing regression test imports
