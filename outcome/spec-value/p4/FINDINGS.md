# Programme 4 findings — data-driven value proposition (executable oracles only, NO LLM judge)

Substrate: real Fineract behaviours reimplemented in Python, graded mechanically against oracle traces
(150 schedules). Metrics: schedules matched at tolerance, structural checks, tokens/$, monitor
holds/fails. Arms cold + isolated, no delegation. Every number below is executable and reproducible.

## FINDING 1 — a spec is NECESSARY for correct builds of system-specific behaviour (clear air over no-spec)
Build-to-oracle: model writes `schedule()` from its arm's input; graded vs the oracle.
- STANDARD amortising product: nospec = prose = v4 = 150/150. SATURATES — the model knows textbook
  behaviour cold; a spec adds nothing where the behaviour is guessable. (Honest: no room, no value.)
- FLAT / add-on-interest product (a real, non-default convention): **nospec 54/150** (silently builds
  the declining-balance default -> wrong), **prose 150/150, v4 150/150**. 3 reps each.
- => When the product has a system-specific convention the model can't guess, a spec is REQUIRED for a
  correct build; without it the model ships the plausible default and is wrong ~64% of the time. This is
  the headline correctness value, executable. prose == v4 on transmission (notation doesn't matter here).

## FINDING 2 — ELICITATION is necessary for correct builds of underspecified requests (clear air over no-spec)
Elicit->build: vague request; the process surfaces decisions; a simulated operator answers ONLY
surfaced decisions (deterministic keyword match); build graded vs flat oracle.
- FINAL (4 reps): **nospec 54/150** (0/4 ever surfaced the interest-basis decision). **prose 150/150**
  (3/4 surfaced), **v3elicit 150/150** (4/4), **v4elicit 150/150** (4/4). v3/v4 elicit surface the
  load-bearing decision slightly more reliably than free prose, but all reach a correct build.
- => Eliciting converts a vague request into a correct build by surfacing the load-bearing decision;
  skipping it -> silent wrong guess. v4 ~= v3 ~= prose (surfacing is the act of eliciting, not the
  notation). Caveat: my planted decisions leak into each other (answering "instalment" implies flat), so
  per-decision attribution is muddy; the ARM-LEVEL result (nospec 54 vs elicit 150) is clean.

## FINDING 3 — v4 checkability recovers distillation drift (distill direction)  [pending complex result]
Distill->rebuild: a distiller writes a spec from a reference impl; a fresh model rebuilds; graded.
- Naive distillation DRIFTS: v4-distill rebuilt 54/150 in 2 of 3 reps (the model is LESS FLUENT in v4
  than prose — emits invalid/empty specs); prose-distill 150/150 (3/3). So NAIVE v4-distill < prose.
- v4 is CHECKABLE: distill -> `allium check` + `monitor` vs reference traces -> fix loop. With that,
  v4-validated rebuilt **150/150** (recovered the drift; 2 validation rounds). Prose can't be
  mechanically validated (eyeball only).
- On the SIMPLE flat product both reach 150 -> parity (v4's check compensates for its fluency cost).
- COMPLEX product (declining + flat service fee + fiddly splits) result: <PENDING validated-complex> —
  the test of whether v4's mechanical check beats prose's eyeball when BOTH forms' distillation drifts.

## LANGUAGE / TOOL improvements shipped this programme (all tested)
- DIVISION operator `/` added end-to-end (was entirely missing; `x/1200` silently became `x`). Essential
  for financial specs. + 0-ary reference constants (`given k means <arith>`) now inline. 52 v4 tests.

## The coherent value proposition (so far, honest)
1. Specifying/eliciting is NECESSARY for correct builds of anything beyond textbook-guessable behaviour
   (Findings 1-2): the spec/elicitation transmits the system-specific conventions and decisions the
   model would otherwise guess wrong (~64% wrong here). Huge, executable clear air over no-spec.
2. On raw transmission, v4 ~= prose ~= v3 (notation doesn't beat prose when the spec is correct).
3. v4's DISTINCT, deliverable edge is CHECKABILITY: a v4 spec can be mechanically validated against the
   code/its traces (`check`+`monitor`) and drift/errors caught and fixed — making an LLM-authored spec
   TRUSTWORTHY without a human eyeballing it. Prose cannot be mechanically validated. [strength = the
   complex-product result]
