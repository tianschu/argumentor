// teacher.mjs — teacher tools, all local in the browser:
//   1. Task designer: writes task files (question, audience, requirements, criteria focus, language focus,
//      AI-use rule, vocabulary, up to six sources) that learners load in Step 1.
//   2. Class overview: reads learners' exported JSON records, checks their checksums, and summarises
//      dialogue, decisions, revision checks and the class's questions and insights. Nothing is uploaded.
import { CONTENT_CRITERIA, LANGUAGE_CRITERIA, CRITERIA, AI_USE_LEVELS, LEVELS, QUESTION_TYPES, DECISIONS, CHECK_STATUS, MAX_SOURCES, validateTask } from './core.mjs';
import { html, raw } from './html.mjs';
import { t, tx } from './i18n.mjs';
import { verifyRecord, recordStats, reportBody } from './report.mjs';

const DRAFT_KEY = 'argumentor-teacher-draft';
const blankTask = () => ({ kind: 'argumentor-task', version: 1, title: '', topic: '', audience: '', lockTopic: false, instructions: '', requirements: ['', ''], wordMin: 250, wordMax: 400, level: '', focus: [], languageFocus: '', minDialogue: 1, aiUse: 'argumentor-only', reflectionLanguage: 'either', vocabulary: [], sources: [{ title: '', kind: '', text: '' }], teacherNote: '' });

function loadDraft() {
  try { const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return saved && saved.kind === 'argumentor-task' ? { ...blankTask(), ...saved } : blankTask(); } catch { return blankTask(); }
}
const teacher = { tab: 'task', task: loadDraft(), records: [], selected: -1, message: '' };
const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(teacher.task)); } catch { /* optional */ } };

const tbutton = (action, zh, en, cls = 'btn secondary small', attrs = '') => html`<button type="button" class="${cls}" data-act="${action}" ${raw(attrs)}>${t(zh, en)}</button>`;
function input(path, labelText, { textarea = false, rows = 3, type = 'text', placeholder = '', lang = '' } = {}) {
  const value = path.split('.').reduce((object, key) => object?.[key], teacher.task) ?? '';
  const id = `t-${path.replace(/\./g, '-')}`;
  return html`<div class="field"><label for="${id}">${labelText}</label>${textarea
    ? html`<textarea id="${id}" data-tpath="${path}" rows="${rows}" placeholder="${placeholder}" ${lang ? raw(`lang="${lang}"`) : ''}>${value}</textarea>`
    : html`<input id="${id}" data-tpath="${path}" type="${type}" value="${value}" placeholder="${placeholder}" ${lang ? raw(`lang="${lang}"`) : ''}>`}</div>`;
}
function choice(path, labelText, options) {
  const value = teacher.task[path];
  const id = `t-${path}`;
  return html`<div class="field"><label for="${id}">${labelText}</label><select id="${id}" data-tpath="${path}">${options.map(([key, text]) => html`<option value="${key}" ${String(key) === String(value) ? raw('selected') : ''}>${text}</option>`)}</select></div>`;
}

function taskDesigner() {
  const task = teacher.task;
  const vocabularyText = (task.vocabulary || []).map(item => item.join(' | ')).join('\n');
  return html`<div class="teacher-grid">
    <section>
      <h3>${t('任务', 'Task')}</h3>
      ${input('title', t('任务标题', 'Task title'), { placeholder: 'Unit 3 · AI monitoring at work' })}
      ${input('topic', t('写作议题（英语）', 'Writing question (English)'), { lang: 'en', placeholder: 'Should employers be allowed to use AI systems to monitor employees\' work?' })}
      ${input('audience', t('目标读者（英语）', 'Audience (English)'), { lang: 'en', placeholder: 'Managers and staff representatives at a mid-sized company' })}
      <label class="check-row"><input type="checkbox" data-tpath="lockTopic" ${task.lockTopic ? raw('checked') : ''}> ${t('锁定议题与读者（学生不可修改）', 'Lock the question and audience (learners cannot change them)')}</label>
      ${input('instructions', t('任务说明', 'Instructions'), { textarea: true, rows: 3 })}
      <div class="field"><label>${t('结构要求（每行一条）', 'Structural requirements (one per line)')}</label><textarea data-tpath="requirementsText" rows="3" lang="en">${(task.requirements || []).filter(Boolean).join('\n')}</textarea></div>
      <div class="row">${input('wordMin', t('最少词数', 'Minimum words'), { type: 'number' })}${input('wordMax', t('最多词数', 'Maximum words'), { type: 'number' })}</div>
      <div class="row">${choice('level', t('建议支持等级', 'Suggested support level'), [['', t('由学生选择', 'Learner chooses')], ...LEVELS.map(level => [level, level])])}${choice('minDialogue', t('至少回答的追问数', 'Questions to answer (minimum)'), [0, 1, 2, 3].map(number => [number, String(number)]))}</div>
      <div class="field"><span class="label">${t('本次关注的论证标准（最多 4 项）', 'Argument criteria to focus on (up to 4)')}</span><div class="checks">${CONTENT_CRITERIA.map(key => html`<label class="check-row"><input type="checkbox" data-tfocus="${key}" ${task.focus.includes(key) ? raw('checked') : ''}> ${tx(CRITERIA[key].label)}</label>`)}</div></div>
      <div class="row">${choice('languageFocus', t('本周语言重点', 'Language focus this week'), [['', t('不指定', 'None')], ...LANGUAGE_CRITERIA.map(key => [key, tx(CRITERIA[key].label)])])}${choice('aiUse', t('AI 使用规则', 'AI-use rule'), Object.entries(AI_USE_LEVELS).map(([key, value]) => [key, tx(value)]))}</div>
      ${choice('reflectionLanguage', t('反思可用语言', 'Reflection language'), [['either', t('中文或英语', 'Chinese or English')], ['english', t('仅英语', 'English only')]])}
      <div class="field"><label for="t-vocab">${t('议题词汇（每行：英文 | 中文 | 说明）', 'Topic vocabulary (per line: English | Chinese | note)')}</label><textarea id="t-vocab" data-tpath="vocabularyText" rows="4">${vocabularyText}</textarea></div>
      ${input('teacherNote', t('给学生的提示（选填）', 'Note to learners (optional)'), { textarea: true, rows: 2 })}
    </section>
    <section>
      <h3>${t('材料包（学生可引用为 S1–S6）', 'Source pack (learners cite S1–S6)')}</h3>
      <p class="fine">${t('学生在证据中加引号引用原文时，系统会逐词核对引文是否出自所注明的材料。请注明材料性质（如“教师编写的虚构案例”）。', 'When learners quote a source in their evidence, the tool checks word by word that the quote is really in the cited source. State what kind of material it is (for example "teacher-written fictional case").')}</p>
      ${task.sources.map((source, index) => html`<div class="source-editor"><div class="priority-head"><span class="pid">S${index + 1}</span>${task.sources.length > 1 ? tbutton(`t-remove-source-${index}`, '移除', 'Remove', 'link-button danger') : ''}</div>
        ${input(`sources.${index}.title`, t('标题', 'Title'))}${input(`sources.${index}.kind`, t('材料性质', 'Kind of material'), { placeholder: 'Teacher-written fictional case' })}${input(`sources.${index}.text`, t('文本（最多 2500 字符）', 'Text (up to 2,500 characters)'), { textarea: true, rows: 5 })}</div>`)}
      ${task.sources.length < MAX_SOURCES ? tbutton('t-add-source', '＋ 添加材料', '＋ Add a source') : ''}
      <div class="actions tight">${tbutton('t-starter', '载入示例任务（职场 AI 监控）', 'Load the sample task (AI monitoring at work)')}${tbutton('t-import', '导入任务文件', 'Import a task file')}<input type="file" id="t-task-file" accept=".json,application/json" hidden></div>
      <div class="actions tight">${tbutton('t-export', '导出任务文件', 'Export the task file', 'btn')}${tbutton('t-use', '在本机学习区试用', 'Try it in the studio here', 'btn secondary')}${tbutton('t-reset', '清空表单', 'Clear the form', 'link-button danger')}</div>
      ${teacher.message ? html`<p class="fine" role="status">${teacher.message}</p>` : ''}
    </section>
  </div>`;
}

function bar(label, value, max) {
  const width = max ? Math.round((value / max) * 100) : 0;
  return html`<div class="bar-row"><span>${label}</span><span class="bar"><i style="width:${width}%"></i></span><b>${value}</b></div>`;
}

function classOverview() {
  const records = teacher.records;
  const valid = records.filter(item => item.record);
  const totals = valid.reduce((sum, item) => {
    const stats = item.stats;
    sum.rounds += stats.rounds; sum.replies += stats.replies; sum.threads += stats.threads; sum.clarifications += stats.clarifications;
    for (const key of Object.keys(sum.decisions)) sum.decisions[key] += stats.decisions[key];
    for (const key of Object.keys(sum.checks)) sum.checks[key] += stats.checks[key];
    for (const [key, count] of Object.entries(stats.criteria)) sum.criteria[key] = (sum.criteria[key] || 0) + count;
    for (const [key, count] of Object.entries(stats.questionTypes)) sum.questionTypes[key] = (sum.questionTypes[key] || 0) + count;
    for (const value of stats.selfAgreement) sum.agreement[value] = (sum.agreement[value] || 0) + 1;
    return sum;
  }, { rounds: 0, replies: 0, threads: 0, clarifications: 0, decisions: { accept: 0, adapt: 0, reject: 0, unclear: 0 }, checks: { visible: 0, partly: 0, 'not-yet': 0, declined: 0 }, criteria: {}, questionTypes: {}, agreement: {} });
  const maxCriteria = Math.max(1, ...Object.values(totals.criteria));
  const insights = valid.flatMap(item => item.stats.insights.map(entry => ({ ...entry, code: item.record.learnerCode || '—' })));
  const selected = teacher.selected >= 0 ? records[teacher.selected] : null;
  return html`<div class="class-view">
    <div class="toolbar">${tbutton('t-import-records', '导入学生导出的 JSON 记录（可多选）', 'Import learners\' JSON records (select several)', 'btn')}<input type="file" id="t-record-files" accept=".json,application/json" multiple hidden>${records.length ? tbutton('t-export-csv', '导出全班汇总 CSV', 'Export class summary (CSV)') : ''}${records.length ? tbutton('t-clear-records', '清除已导入记录', 'Clear imported records', 'link-button danger') : ''}</div>
    <p class="fine">${t('记录只在本页面内存中处理，不会上传，刷新页面即清除。', 'Records are processed in this page\'s memory only; nothing is uploaded, and a reload clears them.')}</p>
    ${!records.length ? html`<div class="empty">${t('导入学生在第 5 步导出的 JSON 文件后，这里会显示全班的追问回答、修订决定与修订检查情况。', 'Import the JSON files learners export in Step 5 to see the class\'s dialogue, decisions and revision checks here.')}</div>` : html`
      <div class="mini-stats four">
        <div class="mini-stat"><b>${valid.length}</b><span>${t('份记录', 'records')}</span></div>
        <div class="mini-stat"><b>${valid.filter(item => item.ok).length}/${valid.length}</b><span>${t('校验码一致', 'checksums match')}</span></div>
        <div class="mini-stat"><b>${valid.length ? (totals.replies / valid.length).toFixed(1) : 0}</b><span>${t('人均追问回答', 'dialogue replies per learner')}</span></div>
        <div class="mini-stat"><b>${valid.length ? (totals.rounds / valid.length).toFixed(1) : 0}</b><span>${t('人均反馈轮次', 'rounds per learner')}</span></div>
      </div>
      <div class="teacher-grid">
        <section><h3>${t('分析角色最常指出的问题', 'Issues the analyst raised most often')}</h3>${Object.entries(totals.criteria).sort((a, b) => b[1] - a[1]).map(([key, count]) => bar(tx(CRITERIA[key]?.label || { zh: key, en: key }), count, maxCriteria))}</section>
        <section><h3>${t('修订决定与修订检查', 'Decisions and revision checks')}</h3>
          ${Object.entries(totals.decisions).map(([key, count]) => bar(tx(DECISIONS[key]), count, Math.max(1, ...Object.values(totals.decisions))))}
          ${Object.entries(totals.checks).map(([key, count]) => bar(tx(CHECK_STATUS[key]), count, Math.max(1, ...Object.values(totals.checks))))}
          <p class="fine">${t('自评与分析一致', 'Self-assessment vs analyst')}: ${Object.entries(totals.agreement).map(([key, count]) => `${key} ${count}`).join(' · ') || '—'} · ${t('询问反馈含义', 'asked what feedback meant')}: ${totals.clarifications}</p></section>
      </div>
      <table class="class-table"><thead><tr><th>${t('学习者', 'Learner')}</th><th>${t('任务', 'Task')}</th><th>${t('轮次', 'Rounds')}</th><th>${t('追问回答', 'Replies')}</th><th>${t('决定 采/调/拒/不懂', 'Decisions A/Ad/R/?')}</th><th>${t('检查 体现/部分/未/拒', 'Check V/P/N/D')}</th><th>${t('词数 初→终', 'Words first→final')}</th><th>${t('粘贴', 'Pastes')}</th><th>${t('AI 说明', 'AI statement')}</th><th>${t('校验', 'Checksum')}</th><th></th></tr></thead>
        <tbody>${records.map((item, index) => item.record ? html`<tr class="${item.record.demo ? 'demo-row' : ''}"><td>${item.record.learnerCode || '—'}${item.record.demo ? html` <span class="tag">demo</span>` : ''}</td><td>${item.record.task?.title || item.record.data?.topic || ''}</td><td>${item.stats.rounds}</td><td>${item.stats.replies}</td><td>${item.stats.decisions.accept}/${item.stats.decisions.adapt}/${item.stats.decisions.reject}/${item.stats.decisions.unclear}</td><td>${item.stats.checks.visible}/${item.stats.checks.partly}/${item.stats.checks['not-yet']}/${item.stats.checks.declined}</td><td>${item.stats.firstWords}→${item.stats.finalWords}</td><td>${item.stats.pastes ? `${item.stats.pastes} (${item.stats.pastedChars})` : '0'}</td><td>${item.stats.statement ? '✓' : '—'}</td><td>${item.ok ? '✓' : html`<span class="warn-text">${t('不一致', 'mismatch')}</span>`}</td><td>${tbutton(`t-view-${index}`, '查看', 'View', 'link-button')}</td></tr>` : html`<tr><td colspan="11">${item.name}: ${t('无法读取', 'could not be read')}</td></tr>`)}</tbody></table>
      <p class="fine">${t('“粘贴”只记录次数和字符数，不记录内容；它不能证明文本来源，只是课堂讨论的线索。校验不一致说明文件导出后被修改过（或损坏）。', '"Pastes" logs only counts and lengths, never content; it proves nothing about authorship and is only a prompt for conversation. A checksum mismatch means the file was edited (or damaged) after export.')}</p>
      <section><h3>${t('全班的追问与学生发现（可用于课堂讨论，已隐去姓名）', 'The class\'s questions and learners\' insights (for class discussion; names omitted)')}</h3>
        ${insights.length ? insights.slice(0, 40).map(entry => html`<div class="rail-item"><small lang="en">${entry.question}</small><q lang="en">${entry.insight}</q></div>`) : html`<p class="fine">${t('暂无。', 'None yet.')}</p>`}</section>
      ${selected?.record ? html`<section class="record-viewer"><div class="priority-head"><h3>${t('学习记录', 'Learning record')} · ${selected.record.learnerCode || ''}</h3>${tbutton('t-close-view', '关闭', 'Close', 'link-button')}</div><div class="report-embed">${reportBody(selected.record, tx({ zh: 'zh', en: 'en' }))}</div></section>` : ''}`}
  </div>`;
}

export function teacherPage() {
  return html`<div data-teacher>
    <div class="section-head"><div><div class="eyebrow">${t('教师工具', 'TEACHER TOOLS')}</div><h2>${t('设计任务，查看全班学习过程', 'Design tasks and see the class\'s learning process')}</h2><p>${t('全部在本机浏览器中完成：任务文件发给学生载入；学生导出的记录在这里汇总。', 'Everything runs in this browser: send task files to learners, and summarise their exported records here.')}</p></div></div>
    <div class="round-tabs" role="tablist">
      <button type="button" role="tab" data-act="t-tab-task" aria-selected="${String(teacher.tab === 'task')}">${t('任务设计', 'Task designer')}</button>
      <button type="button" role="tab" data-act="t-tab-class" aria-selected="${String(teacher.tab === 'class')}">${t('全班概览', 'Class overview')}${teacher.records.length ? ` (${teacher.records.length})` : ''}</button>
    </div>
    ${teacher.tab === 'task' ? taskDesigner() : classOverview()}
  </div>`;
}

function setTaskPath(path, value) {
  const task = teacher.task;
  if (path === 'requirementsText') task.requirements = value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 8);
  else if (path === 'vocabularyText') task.vocabulary = value.split('\n').map(line => line.split('|').map(part => part.trim())).filter(parts => parts[0]).slice(0, 15).map(parts => [parts[0], parts[1] || '', parts[2] || '']);
  else if (path === 'lockTopic') task.lockTopic = Boolean(value);
  else if (path === 'wordMin' || path === 'wordMax' || path === 'minDialogue') task[path] = Number(value) || 0;
  else {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((object, key) => object[key], task);
    target[last] = value;
  }
  saveDraft();
}

export function teacherInput(event) {
  const element = event.target;
  if (element.dataset.tpath) setTaskPath(element.dataset.tpath, element.type === 'checkbox' ? element.checked : element.value);
}

export async function teacherChange(event, ctx) {
  const element = event.target;
  if (element.dataset.tfocus) {
    const key = element.dataset.tfocus;
    const focus = new Set(teacher.task.focus);
    if (element.checked) focus.add(key); else focus.delete(key);
    teacher.task.focus = [...focus].slice(0, 4);
    saveDraft();
    return ctx.render();
  }
  if (element.dataset.tpath && element.tagName === 'SELECT') { setTaskPath(element.dataset.tpath, element.value); return; }
  if (element.id === 't-task-file' && element.files?.[0]) {
    try { teacher.task = { ...blankTask(), ...validateTask(JSON.parse(await element.files[0].text())) }; saveDraft(); teacher.message = t('任务文件已导入。', 'Task file imported.'); } catch { teacher.message = t('无法读取该任务文件。', 'That task file could not be read.'); }
    element.value = '';
    return ctx.render();
  }
  if (element.id === 't-record-files' && element.files?.length) {
    for (const file of element.files) {
      try {
        const record = JSON.parse(await file.text());
        if (record?.kind !== 'argumentor-record') throw new Error('kind');
        teacher.records.push({ name: file.name, record, ok: await verifyRecord(record), stats: recordStats(record) });
      } catch {
        teacher.records.push({ name: file.name, record: null, ok: false, stats: null });
      }
    }
    element.value = '';
    return ctx.render();
  }
}

function csv(records) {
  const head = ['learnerCode', 'task', 'demo', 'rounds', 'dialogueReplies', 'threads', 'clarifications', 'accept', 'adapt', 'reject', 'unclear', 'visible', 'partly', 'notYet', 'declined', 'firstDraftWords', 'finalWords', 'pastes', 'pastedChars', 'minutes', 'aiStatement', 'researchConsent', 'checksumOK'];
  // A leading =, +, -, @ or control character makes spreadsheets evaluate the cell; prefix an apostrophe.
  const cell = value => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const rows = records.filter(item => item.record).map(({ record, stats, ok }) => [record.learnerCode, record.task?.title || record.data?.topic, record.demo, stats.rounds, stats.replies, stats.threads, stats.clarifications, stats.decisions.accept, stats.decisions.adapt, stats.decisions.reject, stats.decisions.unclear, stats.checks.visible, stats.checks.partly, stats.checks['not-yet'], stats.checks.declined, stats.firstWords, stats.finalWords, stats.pastes, stats.pastedChars, stats.minutes, stats.statement, record.researchConsent, ok].map(cell).join(','));
  return [head.join(','), ...rows].join('\n');
}

export function teacherClick(event, target, ctx) {
  const action = target.dataset.act;
  if (!action?.startsWith('t-')) return false;
  if (action === 't-tab-task' || action === 't-tab-class') { teacher.tab = action === 't-tab-task' ? 'task' : 'class'; ctx.render(); return true; }
  if (action === 't-add-source') { teacher.task.sources.push({ title: '', kind: '', text: '' }); saveDraft(); ctx.render(); return true; }
  if (action.startsWith('t-remove-source-')) { teacher.task.sources.splice(Number(action.split('-').at(-1)), 1); saveDraft(); ctx.render(); return true; }
  if (action === 't-reset') { teacher.task = blankTask(); saveDraft(); teacher.message = ''; ctx.render(); return true; }
  if (action === 't-import') { document.getElementById('t-task-file')?.click(); return true; }
  if (action === 't-import-records') { document.getElementById('t-record-files')?.click(); return true; }
  if (action === 't-clear-records') { teacher.records = []; teacher.selected = -1; ctx.render(); return true; }
  if (action === 't-close-view') { teacher.selected = -1; ctx.render(); return true; }
  if (action.startsWith('t-view-')) { teacher.selected = Number(action.split('-').at(-1)); ctx.render(); document.querySelector('.record-viewer')?.scrollIntoView({ behavior: 'smooth' }); return true; }
  if (action === 't-starter') {
    fetch('/demo/task-workplace-ai.json').then(response => response.json()).then(task => { teacher.task = { ...blankTask(), ...validateTask(task) }; saveDraft(); teacher.message = t('已载入示例任务，可直接修改。', 'Sample task loaded; edit it as you like.'); ctx.render(); }).catch(() => { teacher.message = t('示例任务无法载入。', 'The sample task could not be loaded.'); ctx.render(); });
    return true;
  }
  if (action === 't-export' || action === 't-use') {
    let task;
    try { task = validateTask(teacher.task); } catch { teacher.message = t('请至少填写任务标题和写作议题。', 'Fill in at least the task title and the writing question.'); ctx.render(); return true; }
    if (action === 't-export') {
      const name = `argumentor-task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task'}.json`;
      ctx.download(name, JSON.stringify(task, null, 2), 'application/json;charset=utf-8');
      teacher.message = t('任务文件已导出，可发给学生在第 1 步载入。', 'Task file exported; learners load it in Step 1.');
    } else {
      ctx.state.task = task;
      ctx.state.data.topic = task.topic;
      if (task.audience) ctx.state.data.audience = task.audience;
      if (task.level) ctx.state.data.level = task.level;
      ctx.state.page = 'frame';
      ctx.save?.();
      ctx.notify('任务已载入学习区。', 'Task loaded into the studio.');
    }
    ctx.render();
    return true;
  }
  if (action === 't-export-csv') { ctx.download(`argumentor-class-summary-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${csv(teacher.records)}`, 'text/csv;charset=utf-8'); return true; }
  return false;
}

export { QUESTION_TYPES };
