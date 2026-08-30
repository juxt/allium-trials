# What value does a specification add to an existing codebase? (autonomous research programme)

Target: the full Apache Fineract repo (`../fineract/checkout`, ~985k LOC Java, genuinely beyond any
context window). Real code, real cross-module invariants, an oracle we already have (double-entry,
150-schedule monitor). The question is deep, not rhetorical: a spec surely provides SOMETHING an LLM
lacks — but what, and which benefit is largest?

## The discipline (unchanged from the prior loop)

Intellectually honest, emotionally steady. Every claim verified against saved artefacts, not judge
surface numbers (remember the t3-NPE and the judge-inflation traps). Negatives are first-class: if a
candidate benefit does not materialise, that is a finding. Guard against leading the witness, vacuous
specs, errors-counted-as-catches, judge inflation. Each evaluated agent runs COLD and ISOLATED; the
answer key never enters an arm's context; judges are blind to arm.

## The frame that decides everything

An LLM already has: the code (via retrieval), broad domain knowledge, strong reasoning. Repeatedly,
that has been enough — accuracy and single-shot navigation SATURATE even at 985k LOC. So a spec's
real value must be something the LLM does NOT have. Candidates:

1. **Original human intent the code under-determines** — code says WHAT it does, never what it SHOULD.
2. **Persistent memory across cold sessions** — a durable reference; the LLM starts cold every time.
3. **A deterministic, auditable checker** — reproducible verdicts with named reasons; the LLM is
   non-deterministic and unauditable.

Every experiment below is built to isolate one of these against the null hypothesis "the model does
it just as well without the spec."

## Candidate benefits and their discriminating experiments

### B1 — Intent the code under-determines (bug PREVENTION via encoded intent)  [expected: highest]
Hypothesis: a plausible, code-consistent change can silently break intended behaviour; a spec that
encodes the intent flags it, the code alone does not.
Experiment: present a subtle refactor of a real Fineract invariant (double-entry / interest-on-
declining-balance / a rounding rule) that reads as correct and passes casual inspection but breaks the
invariant. Arms: nospec (code only) vs spec (intent encoded). Metric: does spec-arm REJECT/flag the
change while nospec ACCEPTS it? Effect = (nospec accept rate − spec accept rate). This is the sharpest
unique-value test: the code cannot tell you it is wrong, only the intent can.

### B2 — Durable navigation reference (token amortisation across cold tasks)  [running]
Hypothesis: one expensive exploration crystallised into a 30-line spec is read cheaply by every later
cold session, so cumulative token cost falls below re-exploring.
Experiment: `eval-amortise.mjs` — 5 related cold tasks, spec vs nospec, cumulative $ + correctness.
Metric: does cumulative spec $ cross below nospec $ while holding correctness? Pilot (single lookup)
already showed NO single-shot saving and a token penalty; amortisation is the steelman.

### B3 — Deterministic gap / ambiguity detection (checkable representation)
Hypothesis: `allium analyse` finds under-specification / contradiction / vacuity with a REPRODUCIBLE,
named verdict; a model reviewing the same content is non-deterministic and unauditable.
Experiment: seed Fineract-derived specs with subtle defects (unreachable guard, infeasible
requirement, cross-currency category error). analyse (deterministic) vs model-review (N reps, measure
variance). Metric: not catch-rate (saturates) but VARIANCE and auditability — analyse 100% identical
with a named construct; model catch-rate mean ± spread. Value = reproducibility for audit/regulation.

### B4 — Eliciting clarity from the human, on a BROWNFIELD change (surfacing)
Hypothesis: changing existing code still hides human decisions the code cannot answer; the spec
process surfaces them instead of guessing.
Experiment: a Fineract change request that is underspecified (as real ones are). Arms: nospec/prose/
spec-process. Metric: surfaced-vs-guessed on the planted decisions (reuse the judge-robust surfacing
methodology). Greenfield surfacing is already proven; this tests the brownfield analog.

### B5 — Drift / regression gate over a sequence of edits (the standing check)
Hypothesis: across many edits a spec-monitor catches the one that drifts from intended behaviour,
deterministically, where cumulative model review would miss or vary.
Experiment: apply a sequence of edits to a Fineract path; the spec-monitor (150-schedule / double-
entry oracle) flags the breaking one. Metric: does the deterministic gate catch it every run with a
named invariant, and what would a model-review baseline do across the same sequence?

## Cross-cutting metrics on EVERY experiment
- **Correctness** (vs a hidden oracle / answer key) — the accuracy axis.
- **Cost** — `total_cost_usd`, tokens, turns per arm — the cost axis (may only pay off over turns).
- **Determinism / variance** — spread across reps — the audit axis.
- **Uniqueness** — does the spec provide what the model provably lacks (intent / memory / a checker)?

## Loop protocol (every wake)
1. Collect any finished background experiment; read the ACTUAL outputs, verify genuineness, log to
   RESEARCH-LOG.md HONESTLY (good or bad). Update RANKING.md.
2. Advance the programme: run the next experiment stage (design → launch → collect). Order by value ×
   cheapness: B2 (running) → B1 → B3 → B4 → B5. Deepen any that gives a live signal before moving on.
3. Commit across repos. ScheduleWakeup with the same research prompt.
4. TERMINATION: when every candidate B1..B5 has >=1 verified result AND the ranking is defensible,
   write `## SYNTHESIS` to RANKING.md — the largest benefit, the ranked rest with effect sizes and
   significance, and what remains uncertain — then STOP and surface to the human. Do not stop earlier
   for input; do not grind past a defensible answer.
