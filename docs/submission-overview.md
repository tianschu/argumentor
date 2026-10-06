# ArguMentor 论证工坊 — competition submission

**What it is.** A local, dependency-free web app that coaches Chinese university English majors through English argumentative writing. Four DeepSeek agents give feedback; the learner answers their questions, makes a decision on every suggestion, and rewrites the text themselves. Teachers design the task and see the class's process.

**Category.** Educational agent · second-language writing · multi-agent system with a software integrity layer.

---

## The problem it was built for

AI writing feedback has a measurable failure mode that is easy to miss in a demo: **the learner reads it and nothing changes**. The author's own prior study found that EFL learners who *read* AI-generated argumentative debates did not write better arguments than learners who read ordinary pro/con texts. Exposure is not participation.

Three further problems show up in deployed tools:

1. **Unanchored feedback.** "Your warrant could be clearer" refers to nothing the learner can point at, and a hallucinated quotation is indistinguishable from a real one to a B1 reader.
2. **Quiet ghost-writing.** A tool that says "here is a stronger version" has written the essay. Policy statements in a system prompt do not prevent this; only code does.
3. **No loop.** The revision is never read, so neither learner nor teacher knows whether the advice was acted on.

---

## What this agent does differently

### 1. The learner has to answer

Step 3 is a dialogue, not a report. The Socratic questioner asks 2–3 questions keyed to the **argumentation scheme** the analyst identified (argument from example, expert opinion, cause, consequence, analogy, data, values, practical reasoning — each with its own critical questions, after Walton, Reed & Macagno). The learner replies in English; the coach probes, presses, acknowledges or closes, for up to three turns — and never answers for them.

In the recorded demo, the learner starts with *"Employers should not use AI systems to monitor their employees"*. Three turns later they write, unprompted:

> "Maybe the real problem is using AI scores without a human check, not monitoring itself."

That sentence is the learner's. The system only kept asking. It then becomes their revised claim.

### 2. The integrity layer is code, not a promise

Every model response passes `guard.mjs` before any learner sees it:

- quotes of the learner's words are **located word by word**; unverifiable ones are hidden and logged;
- references, URLs, DOIs, years, percentages and statistics absent from the learner's text are treated as invented;
- pasteable rewritten sentences — and long near-copies of the learner's own sentences — are treated as ghost-writing;
- leading, compound or imperative-disguised questions are rejected;
- sentence frames are capped in fixed words and deleted on any 4-gram overlap with the learner's text.

A violation triggers one repair call that **sees the learner's text**. If that also fails, only the offending items are dropped and the usable feedback is kept. Empty replies are regenerated, never "repaired" into invented feedback. Learners can open the guard log and see what was checked, which model served the round, and the prompt version.

Measured on the live evaluation: **100% of feedback items carried a verified quote; 0 evaluative stance markers; 12/12 seeded-defect and injection expectations met.**

### 3. The loop closes, and the learner stays in charge

Every revision priority needs a decision — **accept, adapt, reject, or "not sure what it means"** — and a rejection needs a reason. After the rewrite, the revision check marks each priority *visible / partly visible / not yet visible / declined*, describing only what a reader can now see. **It does not score.** The next round receives the previous round's decisions, so declined advice is not pushed again, and "not sure what it means" is a first-class option rather than silent non-uptake.

### 4. Viewpoint neutrality is tested, not asserted

The evaluation harness runs **flip pairs**: the same argument weaknesses on opposite stances. Analyst diagnostic agreement was 100% and 75% across the two pairs, with near-identical feedback volume and zero evaluative markers on either side. The remaining disagreements are traceable to genuine wording differences between the two drafts.

---

## For teachers

A task designer (question, audience, requirements, focus criteria, weekly language focus, AI-use rule, topic vocabulary, up to six sources) exports a JSON file that learners load. Quoted evidence from those sources is checked word by word — so "check your sources" becomes a deterministic test rather than advice.

The class overview imports learners' exported records and shows dialogue counts, decision distributions, revision-check outcomes, and the class's questions and insights, with a CSV export. Everything runs in the browser; nothing is uploaded.

---

## Engineering

- **Zero dependencies.** Node ≥ 20.3, ~5,000 lines. `npm start` is the whole deployment.
- **60 automated tests**, fully offline.
- **The API key lives outside the project folder**, so zipping or sharing the folder cannot leak it. The packager refuses to build if any packaged file looks like it contains a key.
- **Provenance on every round**: run ID, requested and served model, prompt-version hash, mode, decoding parameters, call and token counts, repair counts, and the consent version — written into the exported record. This exists because the author previously found a provider alias silently remapped to a new model version mid-study.
- **Classroom mode**: configurable bind host, class access code, FIFO queue with position reporting, daily call and token ceilings that survive restarts.
- **Accessibility and privacy**: focus and scroll are preserved across re-renders, errors point at the offending field, PII is detected before sending with one-click redaction, and a public-computer mode clears the record when the browser closes.

---

## Honest limitations

- **No learning-outcome evidence yet.** Everything measured so far is about the agent's behaviour, not about whether learners improve. A classroom study with a control condition is the next step.
- **The multi-agent architecture has not earned its cost on current evidence.** A single-call ablation matched the four-call pipeline on defect detection at 47% of the tokens. `REVIEW_MODE` keeps this an empirical question rather than a design assumption; the honest contribution of the role split today is separation of concerns for the guard and per-item uptake tracking.
- **The guard is syntactic**, so thorough paraphrase can slip past it, and it occasionally removes a legitimate phrase (removals are logged).
- **One provider, one model.** Agreement between the four roles is not independent verification — they share a model.

---

## Try it in two minutes

```bash
npm run start:offline     # no API key needed; feedback comes from clearly-labelled templates
```
Then open `http://localhost:4186/?demo=1` for the **recorded demo**: a complete two-round session on "Should employers be allowed to use AI to monitor employees' work?", with the agent outputs captured from real DeepSeek runs and a narration panel explaining each step.

With a key: `npm run setup` → `npm run check` (free) → `npm start`.

| Document | |
|---|---|
| [design-rationale.md](design-rationale.md) | why each component is built this way, with the research plan |
| [demo-walkthrough.md](demo-walkthrough.md) | annotated walkthrough of the recorded session |
| [evaluation-report.md](evaluation-report.md) | full measurements and what they do not show |
| [../README.en.md](../README.en.md) | installation and operation |
