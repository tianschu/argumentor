# ArguMentor 论证工坊 — Manual

**Version 4.0.0 · for teachers, researchers and developers**
中文版：[使用手册.md](使用手册.md)

---

## Contents

1. [What this is, and what it refuses to be](#1-what-this-is-and-what-it-refuses-to-be)
2. [The philosophy](#2-the-philosophy)
3. [Installing and running](#3-installing-and-running)
4. [The five steps, in detail](#4-the-five-steps-in-detail)
5. [How to talk to the agents](#5-how-to-talk-to-the-agents)
6. [What the four agents actually do](#6-what-the-four-agents-actually-do)
7. [The integrity guard](#7-the-integrity-guard)
8. [For teachers](#8-for-teachers)
9. [For researchers](#9-for-researchers)
10. [For developers](#10-for-developers)
11. [Privacy, cost and classroom deployment](#11-privacy-cost-and-classroom-deployment)
12. [Troubleshooting](#12-troubleshooting)
13. [Limitations, honestly](#13-limitations-honestly)

---

## 1. What this is, and what it refuses to be

ArguMentor is a **local, dependency-free web application** that coaches university English majors through
writing an argumentative essay in English. Four DeepSeek agents give feedback; the learner answers their
questions, decides what to do with every suggestion, and rewrites the text themselves.

**It refuses to:**

| It will not | Why |
|---|---|
| Write or rewrite a sentence for the learner | The learner's authorship is the point; this is enforced in code, not asked for in a prompt |
| Give a score, grade or proficiency estimate | Scoring turns formative feedback into assessment and invites over-reliance |
| Supply facts, statistics, references or URLs | It has no retrieval; anything it "cites" would be invented |
| Judge which side of an issue is right | Both stances get the same criteria at the same strictness, and this is tested |
| Use an AI-text detector | They are unreliable and biased against L2 writers |

If you want a tool that marks essays, this is the wrong tool.

---

## 2. The philosophy

### The finding that shaped it

In a two-phase study, learners who **read** AI-generated argumentative debates did **not** write better
arguments than learners who read ordinary pro/con texts. Two further results from the same programme:
giving LLM debaters **personas** had no reliable effect on output quality (|d| ≤ .16), and genuine
multi-agent debate did **not** beat strong single-agent baselines.

The conclusion: **exposure to AI reasoning is not an intervention. Participation might be.**

So the centre of this tool is not the feedback. It is the three places the learner is required to *act*:

```
         AI produces                      Learner must act
  ┌────────────────────────┐     ┌──────────────────────────────┐
  │ diagnosis + questions  │ ──▶ │ 1. ANSWER the questions      │  ← multi-turn, they can't skip to the end
  │ revision priorities    │ ──▶ │ 2. DECIDE on every item      │  ← accept / adapt / reject / not sure
  │ description of change  │ ──▶ │ 3. REWRITE it themselves     │  ← the editor is theirs alone
  └────────────────────────┘     └──────────────────────────────┘
```

### Four design commitments

**1. Everything is anchored to the learner's own words.**
Every observation and question must quote 3–25 consecutive words from what the learner wrote. The quote is
verified word-by-word in code and *replaced with the learner's exact original span* before display. An
unverifiable quote is hidden. Generic tutor-prose ("your warrant could be clearer") cannot survive this.

**2. Policy is code, not a prompt promise.**
"Do not write the essay" in a system prompt is a request. `guard.mjs` is an enforcement layer that runs on
every response and can delete content the model produced.

**3. The learner may say no.**
Rejecting a suggestion is a first-class action that requires a reason. "I'm not sure what this means" is a
fourth option, because unexamined non-understanding is the most common and least visible form of
non-uptake. Declined advice is not raised again in later rounds.

**4. The architecture must be falsifiable.**
Given finding (2) above, a four-agent split cannot be justified by assertion. `REVIEW_MODE` runs the same
work as one call or without the coordinator, so the question stays empirical. The current honest answer is
in §9 — and it does not flatter the architecture.

---

## 3. Installing and running

**Requirements:** Node.js 20.3 or newer. No `npm install` — there are no dependencies.

### Three ways to use it

| Mode | Command | Needs a key? | Feedback is |
|---|---|---|---|
| **Demo** | open the site, or `?demo=1` locally | No | A real recorded DeepSeek session, replayed read-only |
| **Offline** | `npm run start:offline` | No | Fixed templates, clearly labelled — for learning the workflow |
| **Live** | `npm run setup` then `npm start` | Yes | Real AI feedback |

### First live run

```bash
npm run setup     # asks for your model and API key; the key is never echoed
npm run check     # free verification — lists your account's models, costs no tokens
npm start         # then open http://localhost:4186
```

On macOS you can double-click `启动论证工坊.command`; on Windows, `启动论证工坊.bat`.

### Where your key is stored

| Platform | Location |
|---|---|
| macOS / Linux | `~/.config/argumentor/env` |
| Windows | `%APPDATA%\ArguMentor\env` |

**Outside the project folder, deliberately** — so zipping, copying or sharing the folder cannot leak it.
If a legacy `.env` is found inside the folder, the server warns at startup and `npm run setup` offers to
move it. The release packager refuses to build if any packaged file looks like it contains a key.

### Cost

One full review is **4 model calls**. Each dialogue reply is 1. Each revision check is 1. A typical
two-round session with dialogue is about 19 calls. On `deepseek-flash` that is a very small amount of
money, but it is *your* money: watch the DeepSeek usage page for the first few sessions.

---

## 4. The five steps, in detail

### Step 1 · Frame

Set the **question**, the **audience**, the **claim** and the **qualifier**.

The qualifier is not decoration. Overclaiming is the most common weakness in novice argumentative writing,
and giving scope its own field makes it an editable object rather than an afterthought. "Employers should
never monitor employees" and "Employers should not use AI to score individual productivity unless a human
reviews every score" are different arguments, and only the second is defensible with two case studies.

The **support level** (B1/B2/C1) changes only the *wording* of feedback and how much language scaffolding
is offered. It never changes the diagnosis — the analyst agent cannot see it at all (§6).

### Step 2 · Map

Each reason is a unit:

```
Reason ─── Evidence ─── Evidence type ─── Source
   │                    (collected / teacher source / personal /
   │                     planned / hypothetical)
   └─── Warrant: BOTH links
            evidence → reason   ("why does this show the reason is true?")
            reason   → claim    ("why should this audience accept the claim because of it?")
```

The **evidence type** selector forces an honest label on epistemic status, and it is what lets the analyst
distinguish "a filled-in field" from "a supported reason".

**Counterarguments** target either the claim or one specific reason, and need a **strategy**: rebut,
concede, weigh, or qualify. This turns "add a counterargument" into a reasoning choice. The analyst checks
whether a concession is reflected in the claim's scope — the single most productive tension to surface.

**Quoted evidence is verified.** If you quote a teacher-provided source in quotation marks, the tool checks
word-by-word whether those words really appear in that source — with no model call at all:

> ✗ Quote not found in S1 — "flagged workers who helped their colleagues as lazy"

This catches misremembered quotations before any feedback is requested.

### Step 3 · Question

**Self-assessment comes first.** Before running, the learner names the element they think is weakest and
why, in one English sentence. The analyst responds to that judgement before anything else — "You correctly
identified the missing warrant for Reason 2 as the most important issue" or "That is real, but something
else comes first, because…". This practises evaluative judgement rather than replacing it.

Then the pipeline runs (about 7 seconds, 4 calls):

```
Argument analyst ──→ Socratic questioner ┐
      (A)          ╲   (scheme-matched    ├──→ Revision coordinator (R) ──→ Integrity guard ──→ you
                    ╲   critical questions)│
                     ╲→ Language coach (L)┘
```

Then **the learner answers the questions**. This is the step the whole tool exists for. See §5.

### Step 4 · Revise

One screen: priorities and your own dialogue insights on the left, the editor on the right.

Every priority needs a **decision** — accept / adapt / reject / not sure what it means — and a one-line
reason. "Start from my draft" copies the reviewed draft into the editor; "Show changes" gives a word-level
diff. The AI never writes in this box.

### Step 5 · Reflect

The **revision check** describes what a reader can now see, per priority:

| Status | Means |
|---|---|
| Visible | The revision clearly addresses it, with a quote from your new text |
| Partly visible | Something changed; part of the gap remains, and it names what |
| Not yet visible | No visible change for this priority |
| Declined by learner | You rejected it; it records the consequence and does not argue |

Then: a **transferable strategy** for next time (you are reminded of it when you start a new task), a
**confirmed AI-use statement** drafted from your own process record, and **export** (HTML or JSON, with a
SHA-256 checksum).

---

## 5. How to talk to the agents

This is the part most users get wrong at first, because it does not behave like a chatbot.

### The rules of the dialogue

- You get **up to 3 replies per question**. Then the coach closes the thread with a summary of what *you*
  worked out.
- The coach will **never answer its own question**. If you ask it to decide, it will say the decision is
  yours and ask something narrower.
- Replies must be in **English** and at least a few words. (Short Chinese glosses in brackets are fine
  everywhere — "the 996 schedule (996工作制)" passes.)
- `Ctrl/⌘ + Enter` sends.

### What the coach does with your reply

| Move | When | What it looks like |
|---|---|---|
| **Probe** | Your reply is relevant | Goes one step deeper: evidence, assumption, scope, consequence |
| **Press** | Your reply avoids the question, repeats itself, or stays vague | Names the gap kindly, asks a narrower version |
| **Acknowledge** | Your reply contains a real insight | Quotes your words back and asks how it changes your claim |
| **Clarify** | Only for "What does this mean?" threads | Explains in plainer words, then still asks a question |
| **Close** | Turn 3, or you've resolved it | Summarises *your* conclusion; suggests carrying it into the revision |

### Replies that work

> "I think the manager would need to know how often the system makes this mistake. In Case A it happened in
> the first month, but I don't know if it continued after the company changed the rule."

Specific, admits uncertainty, engages the actual question. The coach can probe this.

> "Hmm, after the fix a supervisor checks the score before any action, so one wrong flag would not punish a
> worker directly. Maybe the real problem is using AI scores without a human check, not monitoring itself."

This is the shape of a productive turn: the learner changes their own mind mid-sentence. This exact reply,
from the recorded demo, became the learner's revised claim.

### Replies that waste a turn

| Reply | What happens |
|---|---|
| "Yes." / "I agree." | Press. Nothing to probe. |
| "What should I write?" | The coach says the decision is yours, and narrows the question. A turn is gone. |
| "Can you give me an example?" | It has no retrieval and will not invent one. |
| Rewriting your sentence and asking "is this better?" | It cannot evaluate a rewrite for you; it will ask what *you* think changed. |

### If you don't understand a piece of feedback

Click **"What does this mean?"** under any item. This opens a separate thread where the coach explains the
term in plainer words, points at your own text, and ends with a question. From the demo:

> **Learner:** "I am not sure what a hedge is here. Do you mean that I should not give my opinion so strongly?"
>
> **Coach:** "A hedge means softening a claim to fit your evidence. Your word 'totally' says AI is always
> unfair, but Case A is only one example. Hedging is not hiding your opinion; it keeps it believable. Which
> part of Reason 2 could you soften to match one example?"

Using this is not a failure. It is recorded as engagement, and "not sure what it means" is a valid decision.

### Writing a useful self-assessment

Name a *specific* element and a *specific* doubt.

- ✓ "I did not explain why one mistake in Case A means AI monitoring is unfair in general."
- ✓ "I am not sure the board will accept that two designers leaving a studio is a cost for a logistics company."
- ✗ "My essay is not good enough." — nothing for the analyst to confirm or refine.

### Across rounds

Round 2 is not a fresh start. The pipeline receives the previous round's priorities, your decisions and
reasons, and the revision-check statuses. Therefore:

- Issues marked **visible** are not raised again.
- Advice you **declined with a reason** is not pushed again. If your reason shows a misunderstanding, you
  may get a question about it instead.
- From round 2, **sentence frames are off by default** (B1 keeps them; others can tick a box). From round 3,
  you are invited to write your *own* critical question. Support fades on purpose.

---

## 6. What the four agents actually do

Roles differ by **function and information**, not by persona. (The persona null above is exactly why.)

### Argument analyst (A) — diagnoses; never asks questions

Produces structured diagnostic labels before any prose:

```json
{ "claim":  { "scope": "overbroad", "answersTopic": "yes" },
  "reasons": [{ "target": "Reason 1", "evidenceStatus": "source",
                "evidenceLink": "partly", "claimLink": "missing" }],
  "counterarguments": [{ "target": "Counterargument 1",
                         "fairness": "fair", "responseType": "rebut" }] }
```

These labels drive the table you see, and they are what makes large-scale evaluation possible (§9).
It also names one thing worth **keeping**, quoted from your text.

**It cannot see your support level.** Diagnosis is level-independent by construction, not by hope.

### Socratic questioner (S) — asks; never diagnoses

Takes the analyst's handoff plus the **critical questions** for the argumentation scheme the analyst
identified (argument from example, expert opinion, cause, consequence, analogy, data, values, practical
reasoning — after Walton, Reed & Macagno). Different inferences fail in different ways, so the question that
can actually defeat your reason depends on its type.

Each question is typed: clarification, assumption, evidence, alternative, implication, counterargument,
audience, **tension**, self-question. The `tension` move — putting two of your *own* statements side by side
— is the strongest move available to a tool with no retrieval, because it needs no outside facts.

Questions are validated for form: exactly one question mark, no leading stems ("Don't you think…"), no
imperatives disguised as questions ("Why don't you add…"). A leading question hands over the conclusion.

### Language coach (L) — points at your sentences; never corrects grammar generally

Works on four criteria only: **stance** (hedges/boosters matching your evidence), **cohesion**,
**attribution**, **precision**. Deterministic word-list signals are computed in code first and handed over
as hints the coach must verify against your text.

Sentence frames are capped at 14 fixed words with 1–3 slots and are **deleted if they share any 4-gram with
your text** — otherwise a "frame" could hand your own sentence back with the slot pre-filled.

### Revision coordinator (R) — selects; never invents

Chooses 1–2 priorities **from the other agents' items**, citing their IDs in `basedOn`. Invalid references
are stripped. Each priority carries a **success check** — a question you can ask of your own revision.
It names tensions between specialists rather than hiding them. If it fails, priorities are assembled
deterministically from the analyst and labelled "assembled by software" in the interface.

---

## 7. The integrity guard

Every response passes `guard.mjs` before any learner sees it.

| Check | What happens on a hit |
|---|---|
| Quote of your words | Located word-by-word; unverifiable quotes hidden and logged |
| URLs, DOIs, author–year citations, years, percentages, statistics not in your text | Treated as invented → repair call |
| Pasteable rewritten sentences; long near-copies of your sentences (≥50% 4-gram overlap) | Treated as ghost-writing → repair call |
| Leading, compound or imperative-disguised questions | Rejected → repair call |
| Unsafe sentence frames | Deleted |
| Non-English output | Violation unless quoting you |

**Failure handling.** A hard problem triggers **one** repair call that *sees your text*. If that also fails,
only the offending items are dropped and the rest of the round survives. An **empty or truncated** reply is
**regenerated, never repaired** — a blind repair with nothing to repair invents feedback, which was a real
failure mode in version 3. Provider refusals fail closed with a message that explicitly says it is not a
judgement of your argument.

Open **"Integrity guard and run record"** at the bottom of the feedback to see what was checked, which model
actually served the round, the prompt version, and token counts.

---

## 8. For teachers

### Designing a task

**Teacher** page → **Task designer**. You set the question and audience (lockable), structural requirements,
word range, which argument criteria to focus on, the week's language focus, the AI-use rule, topic
vocabulary, and up to six sources. Export the JSON and give it to learners, who load it in Step 1.

**The source pack is the highest-leverage field.** Because quoted evidence from your sources is verified
word-by-word in code, "check your sources" becomes a deterministic test. Write short, realistic cases and
label what they are — the sample task uses two teacher-written fictional cases and clearly says so.

Design sources so that **both sides can be argued well**. The sample pack deliberately contains a case
where monitoring reduced accidents *and* one where it drove staff away.

### Reading the class

**Teacher** page → **Class overview** → import learners' exported JSON. You get dialogue counts, decision
distributions, revision-check outcomes, the class's questions and insights for discussion, and a CSV export.
Everything runs in the browser; nothing is uploaded.

**What the numbers mean — and don't.**

- **Dialogue replies** is the best single indicator of engagement.
- **Decisions** show reasoning: a thoughtful *reject* with a good reason is better work than four passive accepts.
- **"Not sure what it means"** is a teaching signal, not a failing. Several learners marking the same item is a mini-lesson.
- **Pastes** records *counts and lengths only, never content*. It proves nothing about authorship. Treat it as a prompt for conversation, never as evidence.
- **Checksum mismatch** means the file was edited after export. It catches casual editing, not determined tampering.

### Using it in class

Three shapes that work:

1. **Before class:** learners build the map and run round 1 at home. You read the class's Socratic questions and open the lesson with the two or three that recur.
2. **In class:** learners answer the questions in pairs, arguing about the answers before typing them. The dialogue is a prompt for human discussion, not a replacement.
3. **After class:** learners revise, run the check, and write their transfer strategy. You read the process record, not just the final text.

Set **minimum dialogue replies** in the task (default 1; the sample uses 2). The tool warns learners who try
to skip ahead, and records the skip.

---

## 9. For researchers

### Provenance on every round

Each round records: run ID, **requested and actually-served model**, prompt-version hash, mode, decoding
parameters, call/token/repair counts, guard notes, and the consent version — all in the export. This exists
because a provider alias was once observed silently remapping to a new model version mid-study.

### Built-in evaluation

```bash
npm run eval:offline   # harness self-check, no API calls
npm run eval           # live, ~24 calls
npm run eval -- --mode single          # single-call ablation
npm run eval -- --rescore <file.json>  # recompute metrics offline from a saved run
```

Measures: guard interception, quote-verification rate, **viewpoint-flip symmetry** (identical weaknesses,
opposite stances), prompt-injection resistance, seeded-defect detection, tokens and latency.

### The ablation result, reported honestly

`REVIEW_MODE` = `multi` | `multi-nocoord` | `single`. On the current fixture set, **the single call matched
the four-call pipeline on defect detection at 47% of the tokens.** The pipeline's measured advantages were
narrower: perfect anchor verification, no unsafe frames, more stable criteria selection across stances.

On this evidence, four calls are not yet justified by output quality. The defensible contribution of the
role split today is **separation of concerns** — distinct item IDs per role, so decisions and uptake can be
recorded per item, and the guard can reason about role-specific rules. This is stated in the submission
documents rather than hidden, because an architecture that cannot be falsified is not a contribution.

### Four studies the instrument supports, none needing new classroom data

1. **Does role decomposition pay for itself?** Conditions crossed with functional vs persona-labelled roles, on ~60 maps derived from public learner corpora (ICNALE, PELIC) and Stab & Gurevych's annotated persuasive essays. Mixed models plus TOST equivalence bounds — the hypothesis to beat is *no difference*.
2. **Measurement invariance.** Does the same argument quality get the same diagnosis across L1, proficiency, topic and length? The flip-pair design generalises.
3. **Drift and a canary set.** Provenance plus a fixed fixture set re-run at intervals turns silent model drift into a measurable quantity.
4. **Prompt-injection and policy-violation rates.** The single injection fixture here is a smoke test; a full red-team corpus would give attack-success rates by role and by attack type.

---

## 10. For developers

### Module map

```
Browser-safe (no node: imports — these also run in the static site and the Worker)
  core.mjs          data model, validation, English/PII rules, v3→v4 migration
  prompts.mjs       every prompt; PROMPT_VERSION is their hash
  guard.mjs         the integrity guard
  orchestrator.mjs  the three pipelines
  mock.mjs          offline template provider
  sha256.mjs        dependency-free hashing
  html.mjs          auto-escaping templates
  i18n.mjs  diff.mjs  report.mjs  teacher.mjs  app.mjs  api.mjs  engine.mjs

Node-only (the key-aware parts)
  server.mjs  provider.mjs  env.mjs  setup.mjs  check.mjs  package.mjs  build-site.mjs

worker/   optional hosted back end (imports the browser-safe modules)
eval/     evaluation harness and synthetic fixtures
tests/    71 tests, fully offline
```

`html.mjs` escapes **every** interpolation unless it is explicitly `raw()`, so forgetting to escape cannot
create an XSS hole.

### Commands

```bash
npm start            npm run start:offline     npm run setup       npm run check
npm test             npm run eval              npm run eval:offline
npm run site         npm run package
```

### Deployments

| Deployment | Key lives | Feedback |
|---|---|---|
| Local (`npm start`) | `~/.config/argumentor/env` | Real |
| Static site (`npm run site`) | nowhere — none needed | Demo replay + offline templates |
| Static + Worker (`worker/`) | platform secret | Real |

`api.mjs` probes for a back end once and falls back to running the pipeline in the browser. The same front
end serves all three.

---

## 11. Privacy, cost and classroom deployment

- Records live **in the learner's browser only**. Export, clear, and a **public-computer mode** (cleared when the browser closes) are available.
- A **versioned data notice** must be accepted before any run; the consent version is recorded in the export.
- **PII screening** runs before anything is sent: emails, phone numbers, ID numbers, long digit strings — with one-click redaction. It also covers text carried between rounds (takeaways, decision reasons, goals).
- **No AI-text detector.** The AI-use statement is drafted from the process record and confirmed by the learner.
- **Classroom LAN:** set `HOST`, `ALLOWED_HOSTS` and `ACCESS_CODE`. The server has a FIFO queue with position reporting, plus daily call and token ceilings that survive restarts. See `.env.example`.
- **Hosted:** deploy `worker/`. Never put a key in a static page — DeepSeek has no per-key cap, so an exposed key means the whole prepaid balance.

---

## 12. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "DeepSeek not configured" | `npm run setup`, then restart. Verify free with `npm run check`. |
| "The configured model is not available" | `npm run check` lists your account's models; re-run setup and pick one. |
| "Nothing has changed since the last round" | By design — revise the map or draft before asking for new feedback. |
| "Please write this in English" | Short Chinese glosses in brackets are fine; Chinese sentences are not. The Source field accepts Chinese titles. |
| "Possible personal information" | Remove it or click Redact. The text is not sent until it is clean. |
| "The model output failed the integrity and format checks" | The guard removed unsafe content and could not salvage a usable round. Run again. |
| "The model declined this topic" | A provider refusal, not a judgement of the argument. Consider a different framing with your teacher. |
| Port 4186 in use | Change `PORT` in your config file. |
| A warning about `.env` in the project folder | A legacy key location. `npm run setup` moves it. |

---

## 13. Limitations, honestly

- **No learning-outcome evidence.** Everything measured so far is about the agent's behaviour, not about whether learners improve. That requires a classroom study with a control condition.
- **The multi-agent architecture has not earned its cost** on current evidence (§9).
- **The guard is syntactic.** It matches patterns and word sequences, not meaning. Thoroughly paraphrased ghost-writing can pass, and an occasional legitimate phrase is removed (removals are logged).
- **One provider, one model.** Agreement between the four roles is *not* independent verification — they share a model.
- **The revision check describes visible textual change**, not argument quality.
- **Single-institution design assumptions.** It was built for Chinese university English majors; the English-with-gloss rule and the bilingual interface reflect that.

---

## References

- Walton, D., Reed, C., & Macagno, F. (2008). *Argumentation Schemes*. Cambridge University Press.
- Toulmin, S. E. (2003). *The Uses of Argument* (updated ed.). Cambridge University Press.
- Stab, C., & Gurevych, I. (2017). Parsing argumentation structures in persuasive essays. *Computational Linguistics, 43*(3), 619–659.
