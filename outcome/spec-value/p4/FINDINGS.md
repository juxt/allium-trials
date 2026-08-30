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
- COMPLEX product (declining + flat service fee + fiddly splits), naive distill (fixed harness), 4 reps:
  **v4 150/150, prose 150/150** — BOTH reliable. The earlier flat "v4 drift to 54/150" was a harness
  artefact (max-turns empties), NOT real v4 unreliability. With a working harness + strong model,
  distillation SATURATES: v4 == prose on rebuild correctness (prose slightly cheaper, $0.13 vs $0.19).
  Validation rarely fires because there is no drift to catch. So distill correctness = no clear air.

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

## FINDING 4 — TOKEN EFFICIENCY: honest negative for v4 (correctness, not cost, is the axis)
Cost measured mechanically (total_cost_usd) alongside oracle correctness. Flat product:
- build:  nospec $0.079 -> 54/150 (cheap but WRONG); prose $0.082 -> 150/150; v4 $0.108 -> 150/150.
- elicit: nospec $0.082 -> 54/150; prose $0.38, v3 $0.36, v4 $0.40 -> all 150/150.
- validated distill: v4 $0.57 (flat) / $1.29 (complex) -> 150/150 (extra check+fix calls).
- => no-spec is NOT cheaper in any useful sense: it produces a WRONG build, so correct-output-per-dollar
  is low. The efficient path to a CORRECT build is a spec. BUT among spec forms v4 is NOT more token-
  efficient than prose — it costs a small premium (reading a formal spec; validation adds more). v4's
  value is correctness/trust, NOT token savings. We should NOT pitch token efficiency for v4.
- Untested angle (candidate, not claimed): no-spec cannot converge on a system-specific convention by
  trial-and-error without being told it, so a spec may save large iteration cost in a build-test-fix
  loop. Not measured here; flagged.

## FINDING 5 — the CATEGORICAL v4 win: an Allium spec is an EXECUTABLE STANDING GATE; prose is inert
The one place v4 clearly beats prose is not a correctness RATE (saturated) but a CAPABILITY prose
lacks: a v4 spec can be mechanically checked, monitored, and run as a regression gate. Demonstrated
(no model calls, deterministic):
- Two-layer checkability on the complex product: `check` catches syntax errors; `monitor` catches
  SEMANTIC drift — a spec with the wrong service fee (0.5% vs 0.25%) fails `interest_line` at residual
  12.5, a faithful spec holds.
- Regression gate: take a correct implementation, apply developer edits that break a convention, run
  the v4 spec-monitor on the resulting trace:
    baseline (correct)                 -> passes
    fee 0.25% -> 0.30%                  -> CAUGHT (interest_line)
    dropped the service fee             -> CAUGHT (interest_line)
    flat instead of declining interest -> CAUGHT (interest_line)
    benign refactor (no behaviour change) -> passes (no false positive)
  3/3 convention-breaking edits caught, deterministically, with the named invariant; 0 false positives.
- Prose can do NONE of this (it is not executable). This is categorical, not a matter of degree.

## COHERENT VALUE PROPOSITION (data-backed, honest)
1. A SPEC IS NECESSARY (any form) for correct builds of non-textbook behaviour and underspecified
   requests: no-spec ships the plausible default / silent guess and is wrong ~64% of schedules; a
   spec/elicitation -> 100%. Huge, executable clear air over no-spec. (Findings 1-2.)
2. On one-shot build / elicit / distill CORRECTNESS and on TOKENS, v4 ~= prose ~= v3. A frontier model
   makes NOTATION irrelevant when the spec content is right; distillation and transmission SATURATE.
   Do NOT pitch v4 as more correct or cheaper than a prose spec — the data says it is not. (F1-4.)
3. v4's UNIQUE, deliverable value is that the spec is EXECUTABLE: machine-checkable (syntax + semantic
   faithfulness vs the code's traces) and a STANDING DETERMINISTIC REGRESSION GATE that catches
   convention-breaking drift a prose spec cannot. This is where v4 has clear air over prose — in
   VERIFIABILITY and GATING, not in build-correctness rate. In a regulated setting (audit, no silent
   drift) that is the whole game. (F5.)
4. Enablers shipped this programme so v4 can express real financial specs: DIVISION operator, 0-ary
   reference constants (given k means <arith>), plus temporal ordering + reference-oracle (prior).

## HONEST LIMITS / NON-CLAIMS
- No clear air for v4 over prose on build/elicit/distill correctness or tokens (saturation). 
- The regression-gate win requires the spec's invariants to be monitorable (reference inputs emitted in
  traces) — a real setup cost.
- All on one behaviour family (loan schedules) + a strong model. See the weak-model probe next.

## FINDING 6 — the shipped DIVISION feature closed a real value-blindness gap, at scale (144 real traces)
P3 established the "desync law": a relational spec catches structure-breaking bugs but is BLIND to
value bugs that keep the structure consistent (P3 E2: real-code arithmetic mutants 0/20 caught). Root
cause: relational specs lack ABSOLUTE invariants tying an output to a reference input — and v4 could not
even express one because it had no DIVISION operator (`interest = rate/1200 * balance` was inexpressible).
This session shipped division (+ reference constants). Re-test on 144 REAL Fineract schedule traces:
- value-consistent wrong-interest mutant (interest+emi bumped together; ALL relational invariants —
  principal_split, balance_rolls, conservation, closes_to_zero — still hold):
    RELATIONAL-only spec (P3-style)                     -> caught 0/144
    IMPROVED spec (+ absolute `interest = rate_factor*outstanding`) -> caught 144/144
- => a concrete, executable, at-scale demonstration that a LANGUAGE feature shipped this session
  (division) delivered a MEASURABLE gate capability: value-drift catch on real code went 0 -> 144/144.
  This is the P3 value-blindness gap CLOSED. (Faithfulness caveat: the absolute invariant holds on
  144/150 real traces at tol 0.02; 6 miss due to Fineract's exact day-count vs the rate/1200
  approximation — a real limit fixed by emitting Fineract's exact per-period rate factor.)
