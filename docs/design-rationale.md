# Design rationale

Why each part of ArguMentor v4 is built the way it is, what evidence it rests on, and what remains untested.

---

## 1. The guiding constraint: participation, not exposure

The author's prior two-phase study produced three findings that shaped this design:

1. Learners who **read** AI-generated argumentative debates did not outperform learners who read ordinary pro/con texts. Reading AI output is not an intervention.
2. Giving LLM debaters **personas** had no reliable effect on output quality (|d| ≤ .16).
3. Genuine multi-agent debate did **not** beat strong single-agent baselines; chain-of-thought scored highest.

The design consequences are direct. Finding 1 says the learner must *do* something with the feedback, so the centre of the tool is a dialogue the learner has to answer and a decision they have to make on every suggestion. Findings 2 and 3 say a four-agent split cannot be justified by assertion, so roles are defined by **function and information**, not by persona labels, and `REVIEW_MODE` makes the architecture an empirical question (see §5).

---

## 2. The argument model

The map is a Toulmin-style structure with the pieces that matter for EFL argument instruction:

- **Claim + qualifier.** Overclaiming is the most common weakness in novice argumentative writing. Giving the qualifier its own field makes scope a visible, editable object rather than an afterthought.
- **Reason → evidence → evidence type → source → warrant.** The **evidence type** selector (collected / teacher source / personal / planned / hypothetical) forces the learner to label epistemic status. This is also what lets the analyst distinguish "a filled field" from "a supported reason" — a distinction the previous version could not make.
- **Two-link warrant.** The prompt asks explicitly about *evidence→reason* and *reason→claim*, because a learner can write a sound evidence link while the reason itself is irrelevant to the claim. The analyst reports both links separately.
- **Counterargument with a target and a strategy.** Objections can target the claim or a specific reason, and the learner picks rebut / concede / weigh / qualify. Myside bias is the most robust weakness in novice written argument; making the response *strategy* explicit turns "add a counterargument" into a reasoning choice. The analyst checks whether a concession is reflected in the claim's scope — the single most productive tension to surface.

**Argumentation schemes.** The analyst labels each reason with a scheme (example, expert opinion, cause, consequence, analogy, data, values, practical reasoning). The Socratic questioner then draws from that scheme's **critical questions** (paraphrased from Walton, Reed & Macagno, *Argumentation Schemes*, 2008). This is what stops questions drifting to generic stems like "Have you considered other perspectives?" — different inferences are defeated in different ways, and the learner sees the question type as a reusable tool.

---

## 3. The dialogue

Socratic tutoring requires the learner to commit to an answer that the tutor then probes. Four design rules:

- **Moves are typed**: probe, press, acknowledge, clarify, close. "Press" exists for replies that avoid the question — without it, a vague answer gets a polite follow-up that teaches nothing.
- **Turn cap of 3**, then a forced close that summarises what the learner worked out **in the learner's own words** (the quoted insight is verified against their replies, like any other anchor).
- **The coach never answers.** If the learner asks it to decide, it says the decision is theirs and narrows the question.
- **"What does this mean?"** opens a clarification thread on any feedback item. For B1 learners the bottleneck is often understanding the feedback, not the argument. The `clarify` move explains the term in plainer words, points at the learner's own text, and still ends with a question.

Insights the learner produces in dialogue are carried to the revision desk, so the rewrite starts from *their* conclusion rather than from the AI's advice.

---

## 4. The integrity guard

Policy in a system prompt is a request; the guard is an enforcement layer. It runs on every response.

**Anchoring.** Each item must quote 3–25 consecutive words of the learner's text. The guard tokenises both sides, matches the word sequence ignoring case and punctuation, and **replaces the model's quote with the learner's exact original span**. An unverifiable anchor is dropped and logged rather than displayed — a mis-anchored diagnosis is the worst failure in this pipeline, because the other roles build on the analyst's output and agreement between roles sharing one model looks like corroboration.

**Closed-world checks.** URLs, DOIs, author–year citations, "et al.", four-digit years, percentages and quantified statistics must appear in the learner's own text. Anything else is treated as invented. This is strict, and deliberately so: an EFL learner may paste a plausible-looking citation straight into their essay.

**Ghost-writing.** Three detectors: explicit phrases ("here is a revised version", "your claim could be:"), long quoted sentences that are not the learner's own, and unquoted sentences of ≥14 words sharing ≥50% of their 4-grams with the learner's text. The last one catches the common evasion of rewriting without announcing it. The near-copy check is **disabled for dialogue and revision-check roles**, where restating the learner's own words back to them is precisely the job.

**Question form.** Exactly one question mark; no leading stems ("Don't you think…"), no imperatives disguised as questions ("Why don't you add…"). A leading question hands over the conclusion and removes the reasoning step the dialogue exists for.

**Frames.** Capped at 14 fixed words and 1–3 slots, rejected on any 4-gram overlap with the learner's text. Without this, a "frame" can hand back the learner's own sentence with the slot pre-filled — ghost-writing through a side door.

**Failure handling.** Hard problems trigger one repair call that receives the learner's text. If it fails again, `salvage()` drops only the offending items and keeps a usable round. An **empty or truncated** reply is *regenerated*, never repaired — a blind repair with nothing to repair invents feedback, which was a real failure mode in the previous version. Refusals fail closed with a message that explicitly says it is not a judgement of the learner's argument.

---

## 5. The architecture, and why it stays falsifiable

```
analyst ──→ socratic ┐
   │        (scheme  ├──→ coordinator ──→ guard ──→ learner
   └──────→ language ┘  critical Qs)
```

Roles differ by **information and function**, not persona:

| Role | Sees | Produces | Does not |
|---|---|---|---|
| Analyst | map, draft, sources, quote-check results, self-assessment, prior rounds; **not the support level** | structured checks, scheme labels, 1–3 anchored observations, one strength | ask questions |
| Socratic | analyst handoff + scheme critical questions | 2–3 typed, anchored questions | diagnose, give facts |
| Language | learner's sentences + deterministic language signals | 1–2 anchored stance/cohesion/attribution/precision notes, optional frames | correct grammar, rewrite |
| Coordinator | all specialist items by ID | 1–2 priorities with `basedOn` IDs and a success check | raise new issues |

Two deliberate choices:

- **The analyst is level-blind.** B1/B2/C1 changes only the *wording* of feedback and the amount of scaffolding, never the diagnosis. Making the analyst literally unable to see the level means this holds by construction, not by hope.
- **The coordinator may only select**, never invent; its `basedOn` references are filtered against known item IDs, and invalid references are stripped and logged. If it fails, priorities are assembled deterministically from the analyst and labelled as such in the UI.

**Scaffold fading.** From round 2, frames are off by default (B1 keeps them; others can ask). From round 3 the questioner invites the learner to write their own critical question. Prior rounds' priorities, decisions and revision-check statuses are passed forward, so resolved issues are not re-raised and declined advice is not pushed again.

**The ablation is built in.** `REVIEW_MODE=single` runs the same four outputs from one call through the same guard; `multi-nocoord` drops the coordinator. The evaluation (see `evaluation-report.md`, §4) currently shows the single call matching the pipeline on defect detection at 47% of the tokens. That result is reported rather than hidden, because the author's own prior findings predicted it — and because an architecture that cannot be falsified is not a contribution.

---

## 6. Research the instrument is built to support

Each needs no new classroom data collection; all run on synthetic or public corpora.

**Study 1 — Does role decomposition pay for itself?**
Conditions: single call; single call with reasoning enabled; four-role pipeline; pipeline without coordinator; pipeline without handoff; and functional vs persona-labelled roles crossed with each. Materials: the fixture set extended to ~60 maps derived from public learner corpora (ICNALE, PELIC) and from Stab & Gurevych's annotated persuasive essays. Outcomes: seeded-defect detection, anchor verification rate, guard violation rate, policy-violation rate, token cost. Analysis: mixed models with item random effects, plus TOST equivalence bounds — the hypothesis to beat is *no difference*. Preregister before collection; the `REVIEW_MODE` switch and provenance logging already exist.

**Study 2 — Measurement invariance of LLM feedback.**
Does the same argument quality receive the same diagnosis across L1 background, proficiency band, topic and text length? The flip-pair design generalises: hold the argument's structure constant and vary a surface attribute. Outcome: agreement on structured analyst checks. This is a fairness question for any deployed assessment agent.

**Study 3 — Drift and a canary set.**
Provenance (requested model, served model, prompt-version hash, parameters, date) is recorded on every round precisely because the author previously found a provider alias silently remapped mid-study. A fixed canary set re-run at intervals turns drift from an invisible confound into a measurable quantity.

**Study 4 — Prompt-injection and policy-violation rates.**
The single injection fixture here is a smoke test. A proper red-team corpus (injections in each learner field, laundering through the repair path, cross-role propagation) would give attack-success rates by role and by attack type, and would let the multi-agent and single-call conditions be compared for amplification.

**Instrumentation already in place for all four:** per-round run IDs, served-model capture, prompt-version hashing, guard-note logging, repair and regeneration counts, item-level IDs, per-item learner decisions with reasons, revision-check statuses, and checksummed exports.

---

## 7. What is deliberately absent

- **No score, grade or proficiency estimate.** The revision check describes visible change. Scoring would turn a formative tool into an assessment one and invite exactly the over-reliance the design is built to avoid.
- **No AI-text detector.** They are unreliable and biased against L2 writers. The tool instead gives the learner a structured place to disclose AI use, drafted from their own process record.
- **No retrieval.** The agents are explicitly told they cannot check facts and must say what kind of check is needed rather than supplying an answer. Teacher-provided sources are the only checkable evidence, and quotes from them are verified in code.
- **No cloud account, no telemetry.** Everything runs locally; records stay in the learner's browser until they export them.

---

## References

- Walton, D., Reed, C., & Macagno, F. (2008). *Argumentation Schemes*. Cambridge University Press. — the scheme taxonomy and critical questions.
- Toulmin, S. E. (2003). *The Uses of Argument* (updated ed.). Cambridge University Press. — claim/data/warrant/qualifier/rebuttal.
- Stab, C., & Gurevych, I. (2017). Parsing argumentation structures in persuasive essays. *Computational Linguistics, 43*(3), 619–659. — annotated corpus proposed for Study 1.
