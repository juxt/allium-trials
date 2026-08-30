# Programme 4 — data-driven value proposition (10h). EXECUTABLE ORACLES ONLY. No LLM judge.

Budget: START 1788117992, END 1788153992 (~Mon 06:26). Goal: a coherent, data-backed value proposition
for Allium v4 with CLEAR AIR over v3 / prose specs / no spec, on BOTH the elicit and distill directions.
Every metric mechanical: executable test/oracle pass-fail, trace-diff, token/cost, monitor holds/fails.
NO model-as-judge (it misfired repeatedly; the human forbade it). We may change syntax + skills.

## The prizes (the human's words)
1. BUILD-TO-ORACLE CORRECTNESS — does a spec make the BUILT ARTEFACT more correct (executable oracle)?
2. TOKEN EFFICIENCY at scale / beyond context.
Plus: the overarching goal — show WHY v4 is a better behavioural spec language, at scale, with data.
Luxury: pivot toward features we can deliver, away from ones we can't.

## Executable-oracle design (how we avoid a judge)
Substrate: real Fineract behaviours with mechanical oracles we already have —
- 150 real loan-schedule traces (traces_baseline + manifest) = ground truth for a reimplementation.
- double-entry leg traces + monitor = ground truth for accounting.
Correctness = the model's OUTPUT (code or spec-derived artefact) run against these, diffed mechanically.
Surfacing/transmission becomes executable: the oracle encodes the intended CONVENTIONS (declining
balance, last-period rounding residual, DAYS_360/30, HALF_EVEN 2dp); an arm that doesn't get them
(no-spec guesses; prose/v3/v4 transmit them) FAILS the trace diff. No judgement needed.

## Phase A — build-to-oracle (the prize). Arms: no-spec / prose / v3 / v4.
A1. REIMPLEMENT-FROM-SPEC: model writes a Python `schedule(disbursed, annual_rate_pct, months)` from its
    arm's spec only. Oracle = per-period trace-diff vs the 150 real Fineract schedules (tol). Metric:
    schedules matched / 150, invariant pass, tokens. CLEAR AIR = v4 (and v3) > prose > no-spec on match.
    FIRST run a saturation check on the simplest case; if the model nails it unaided, ESCALATE
    complexity (conventions it can't guess, more periods, edge cases) until there is room, then measure
    whether the spec closes the gap. Honest either way.
A2. Escalate / vary domain (payment allocation, rounding) as A1 dictates.

## Phase B — distill direction (executable).
B1. Distill a spec from a reference implementation (v4 vs prose vs v3), then a FRESH model reimplements
    from the distilled artefact; oracle-grade. Does v4-distill preserve behaviour better than prose-
    distill? Also: distillation token cost. Clear air = v4-distill reimplementation matches oracle more.

## Phase C — token efficiency at scale.
C1. Amortisation done right: many cold tasks over the full ~985k-LOC repo, cumulative tokens, bigger n.
C2. Beyond-context: spec-as-map vs blind retrieval where the repo can't be held.

## Phase D — agile (discoveries). Pivot as data dictates. Candidates: new v4 constructs that measurably
lift oracle pass-rate; skill wrapper changes; the shipped temporal/reference-oracle features proving
their worth on an executable oracle.

## Loop discipline
Cold isolated arms (disallow Task,Agent — sub-agent delegation contaminates cost). Oracle NEVER in an
arm's context. Verify by reading real outputs + re-running. Log to RESEARCH-LOG.md; commit each step.
Report effect sizes with counts + the mechanical metric. Negatives first-class. Pivot toward deliverable
value. Reconvene when the value proposition is coherent and data-backed across elicit + distill.
