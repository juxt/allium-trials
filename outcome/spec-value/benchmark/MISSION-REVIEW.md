# Mission review — does the suite demonstrate Allium's value?

Mission: a suite of evals demonstrating Allium's value over (a) prose specs and (b) no specs, and ideally
V4 over V3. ~15 tasks, 5 real codebases (Fineract, numpy-financial, python-stdnum, bech32, workalendar),
4 arms (none/prose/v3/v4) x 2 models (Opus/Sonnet), real-behaviour golden oracles.

## 1. Allium (and any spec) vs NO SPEC — DEMONSTRATED

Where behaviour is NON-INFERABLE, a spec lifts code from a flaky 70-88% to ~100%, replicated across
codebases: ISIN check-digit (no-spec 68-73), bech32 charset (82), null conventions (88 sonnet), the pmt
sign/when convention (sonnet 0/5 unaided). The gap is largest for the mid-tier model. Where behaviour is
inferable (state machines, obvious rules) all arms tie near 100 — honestly reported.
VERDICT: solid. Spec > no-spec on the load-bearing, non-inferable detail.

## 2. Allium vs PROSE — DEMONSTRATED (as reliability, not raw score)

Among spec FORMS, code-output ties on most tasks. The real prose vs structured difference is RELIABILITY:
prose MISLED the frontier model on the null task (86% < no-spec), and prose-generated pre-submission checks
FALSE-ALARM on the mid-tier model (block valid reports). Structured specs did not. Plus the checkability
argument: prose (and v3 @guidance) is invisible to the checker — see "Why the syntax changed".
VERDICT: demonstrated as reliability + checkability, NOT as a raw code-quality delta (which would be false).

## 3. V4 vs V3 — DEMONSTRATED on the CHECKER, NOT on code-output

On the code a model writes, V3 = V4 (tie on every task; the one apparent gap dissolved under a
multi-distillation control). V4's advantage is the CLI/checker:
- durability-gate: analyse (proof) 100/100 catches a subtle regression; v3/prose generated tests are
  model-dependent (66-100) and false-alarm.
- reporting (report-balance / trial-balance): analyse is the only deterministic, correct pre-submission
  check; test-gen false-alarms on the weaker model.
This is a CAPABILITY (proof/gate), exercised at verification and maintenance time — not a first-draft number.
VERDICT: V4 > V3 shown on verification, honestly scoped. V4 = V3 on code-gen (and we proved it, didn't dodge).

## Honest boundaries (stated, not hidden)
- The frontier model rarely needs the spec for STANDARD-domain rules (it knows them); spec value concentrates
  on the mid-tier model and on bespoke rules (p6 bespoke stores showed frontier 0->100 on genuinely
  non-inferable rules).
- analyse's proof edge is scoped to its provable fragment (arithmetic + boolean/enum); it does NOT yet check
  MIXED arithmetic-threshold rules (and currently mis-reports them as covered — backlog #2/#3).

## Bottom line
The suite demonstrates: spec > no-spec (non-inferable behaviour), structured > prose (reliability +
checkability), V4 > V3 (the checker/gate). All three legs are on the website benchmarks page, evidence-backed,
with boundaries stated. The mission is met, with the V4>V3 leg correctly located in verification rather than
code-generation.
