# ArguMentor 论证工坊 v4.0

An **English argumentative-writing coach** for Chinese university English majors. Learners build an argument in English, **answer the agents' questions**, revise it themselves, and the system then checks what a reader can actually see in the revision. Four DeepSeek agents divide the feedback work, and every output passes a **software integrity guard**.

> 中文版本：[README.md](README.md)
> Step-by-step publishing guide: [DEPLOY.md](DEPLOY.md)

---

## 1. In one minute

```
Frame → Map → Question → Revise → Reflect
```

Three things that differ from a typical "AI marking" tool:

1. **Learners must answer.** Step 3 is not reading feedback; it is a multi-turn dialogue with the Socratic questioner. The learner states the conclusion; the system only asks.
2. **The AI never writes the learner's sentences.** Rewritten sentences, invented references, statistics and links are blocked in code, and every quote of "your words" is matched word by word against the learner's text — unmatched quotes are not shown.
3. **The loop closes.** The revision is reviewed again: each priority is marked *visible / partly visible / not yet visible / declined by the learner*, and the next round knows what the learner declined.

---

## 2. Running it

Requires **Node.js 20.3+**. No dependencies, no `npm install`.

| Platform | Action |
|---|---|
| macOS | double-click `启动论证工坊.command` |
| Windows | double-click `启动论证工坊.bat` |
| Any | `npm run setup`, then `npm start` |

Open `http://localhost:4186`.

```bash
npm run check          # free self-test: verifies the key and model via GET /models (no tokens)
npm run start:offline  # offline template mode: no DeepSeek calls; the UI says "not AI feedback"
```

### The key lives outside the project folder

| Platform | Location |
|---|---|
| macOS / Linux | `~/.config/argumentor/env` |
| Windows | `%APPDATA%\ArguMentor\env` |

So copying, zipping or sharing the project folder **cannot leak the key**. A legacy `.env` left inside the folder triggers a startup warning; `npm run setup` moves it.

---

## 3. The five steps

**1 Frame** — question, audience, claim and **qualifier** (conditions and scope). A teacher task can lock the question and audience.

**2 Map** — each reason carries its own evidence, **evidence type** (collected / teacher source / personal / planned / hypothetical), source, and a **two-link warrant** (evidence→reason, reason→claim). An objection can target the claim or one reason and needs a response strategy (rebut / concede / weigh / qualify). Quoted material from a teacher source is **checked word by word** against that source.

**3 Question** — before running, the learner **self-assesses** the weakest element; the analyst responds to that judgement first. Then:

```
Argument analyst ──→ Socratic questioner ┐
      (A)          ╲                      ├─→ Revision coordinator (R) ──→ Integrity guard
                    ╲→ Language coach (L) ┘
```

The learner answers up to three turns per question. The coach may probe, press, acknowledge or close — but **never answers for the learner**. Any feedback item can be queried with "What does this mean?".

**4 Revise** — feedback and "what you worked out in dialogue" sit in the left rail; the editor is on the right. Every priority needs a decision: **accept / adapt / reject / not sure what it means**, and a rejection needs a reason too. A word-level diff shows what changed.

**5 Reflect** — the revision check describes only what a reader can now see; it **does not score**. The learner then records a transferable strategy (recalled at the start of the next task), confirms the AI-use statement, and exports the record.

---

## 4. The integrity guard (code, not a prompt promise)

Every model output passes through `guard.mjs` before a learner sees it:

| Check | Action |
|---|---|
| Quotes of "your words" | located word by word in the learner's text; unverifiable quotes are hidden and logged |
| References, URLs, DOIs, years, percentages, statistics | not present in the learner's text → treated as invented → repair call |
| Rewritten sentences (pasteable sentences, long near-copies of the learner's own) | treated as ghost-writing → repair call |
| Question form | leading, compound or imperative-disguised questions → repair call |
| Sentence frames | capped fixed words and slots; removed on any 4-gram overlap with the learner's text |
| Non-English output | a violation unless it quotes the learner |

If the repair also fails, **only the offending items are dropped** and the rest of the round is kept. Empty replies are regenerated and are never "repaired" into invented feedback. The *Integrity guard and run record* panel shows what was checked, the model, the prompt version and token counts.

---

## 5. Teacher tools

The Teacher page runs entirely in the browser:

- **Task designer** — question and audience (lockable), structural requirements, length, focus criteria, weekly language focus, AI-use rule, topic vocabulary, and up to six sources. Exports a JSON task file that learners load in Step 1.
- **Class overview** — import learners' exported JSON to see dialogue replies, decision distributions, revision-check outcomes, and the class's questions and insights; export a summary CSV. Checksum mismatches are flagged.

For a classroom LAN, set `HOST`, `ALLOWED_HOSTS` and `ACCESS_CODE`; the server has a FIFO queue plus daily call and token ceilings. See `.env.example`.

---

## 6. Data and privacy

- Records stay in the current browser; export, clear, and a **public-computer mode** (cleared when the browser closes) are available.
- A **versioned data notice** (currently `2026-10-v1`) must be accepted before any run; the consent record goes into the export.
- Emails, phone numbers, ID numbers and long digit strings are detected before sending, with one-click redaction.
- **No AI-text detector is used.** The AI-use statement is drafted from the process record and confirmed by the learner.
- Exports carry a SHA-256 checksum, which reveals edits made after export (it cannot prove the absence of deliberate tampering).

---

## 7. Tests and evaluation

```bash
npm test                 # 67 automated tests, fully offline, no quota used
npm run eval:offline     # evaluation harness self-check (template provider)
npm run eval             # live evaluation (~24 calls, billed to the key owner)
npm run package          # builds dist/ArguMentor-v4.0.0.zip (allow-list, with a key scan)
```

The harness measures guard interception, quote-verification rate, **viewpoint-flip symmetry** (identical weaknesses, opposite stances), prompt-injection resistance, seeded-defect detection, and a single-call vs multi-agent ablation. Results land in `eval/results/`.

Most recent live run (DeepSeek `deepseek-flash`, prompt version `38bd27ec863f`): 100% of feedback items carried a verified quote, 12/12 seeded-defect and injection expectations met, 0 evaluative stance markers. See [docs/evaluation-report.md](docs/evaluation-report.md).

---

## 8. Files

| File | Purpose |
|---|---|
| `core.mjs` | shared data model, validation, English and privacy rules, v3→v4 migration |
| `prompts.mjs` | every prompt; `PROMPT_VERSION` is their hash |
| `guard.mjs` | the integrity guard |
| `orchestrator.mjs` | three pipelines: multi / multi-nocoord / single |
| `server.mjs` | local server, streaming endpoints, queue and budgets |
| `app.mjs` | learner interface |
| `teacher.mjs` | teacher tools |
| `report.mjs` | learning record, checksum, printable report |
| `eval/` | evaluation harness and synthetic fixtures (no student data) |
| `demo/` | replayable demo and a sample teacher task |
| `docs/` | submission and design notes |

---

## 9. Known limitations

- One provider (DeepSeek) and one model; agreement between roles is **not** independent fact-checking.
- The guard is regex and word-sequence matching, not semantic understanding: thoroughly paraphrased ghost-writing can slip through, and an occasional legitimate phrase may be removed (removals are logged).
- The revision check describes visible textual change, not argument quality.
- Learning gains have not been tested in a real classroom; the research designs in `docs/` are written for that.
