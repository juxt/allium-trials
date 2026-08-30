# Programme 4 findings — data-driven value proposition (executable oracles only, NO LLM judge)

## EXECUTIVE SUMMARY (the coherent value proposition, backed by executable data)
Every number below is mechanical: a Python build graded against real Fineract traces, or the v4
monitor's holds/fails. No model judged anything.

1. A SPEC IS NECESSARY, and it is the biggest win. For behaviour the model can't guess (a system-
   specific convention) or an underspecified request, NO-SPEC ships the plausible default and is wrong
   ~64% of the time; ANY spec/elicitation -> 100% correct. Clear air over no-spec, both the build and
   elicit directions. (F1, F2)
2. NOTATION AND MODEL DON'T MOVE CORRECTNESS. Given the spec content, v4 == prose == v3, and opus ==
   haiku, on build/distill correctness and on tokens. One-shot correctness SATURATES; do not pitch v4
   as more correct or cheaper than a prose spec. (F3, F4, F6-control)
3. v4's REAL, UNIQUE, DELIVERABLE EDGE is that the spec is EXECUTABLE. A v4 spec is machine-checkable
   (syntax + semantic faithfulness vs the code's own traces) and a STANDING DETERMINISTIC REGRESSION
   GATE. It caught 3/3 convention-breaking developer edits with 0 false positives; prose can do none of
   this. This is clear air over prose AND v3 — in VERIFIABILITY and GATING, not in correctness rate. (F5)
4. THE LANGUAGE FEATURES SHIPPED THIS SESSION each closed a distinct real bug-class gap the gate can now
   catch: DIVISION -> value bugs (a wrong interest rate: relational-only spec 0/144, +absolute-invariant
   spec 144/144, on real Fineract traces); TEMPORAL ORDERING -> sequencing bugs (12/12 caught). The
   "why v4 is better" is an expanding set of bug classes it can mechanically gate against. (F6, F7)

Bottom line: sell v4 as the spec that is NECESSARY for correctness (over no-spec) and that STAYS TRUE
and CATCHES DRIFT because it is executable (over prose/v3). Do not sell it on one-shot correctness or
tokens vs prose — the data says those saturate.

## DATA AT A GLANCE (all executable; match = schedules matching the oracle at 0.50 tol, /150)
| experiment                              | no-spec | prose | v3 | v4 |
|---|---|---|---|---|
| build, standard product (F1)            | 150 | 150 | -  | 150 |  (saturates: guessable)
| build, flat/non-default product (F1)    |  54 | 150 | -  | 150 |  (spec necessary)
| elicit->build, underspecified (F2)      |  54 | 150 | 150| 150 |  (elicitation necessary)
| distill->rebuild, complex (F3)          |  -  | 150 | -  | 150 |  (saturates; even haiku 150)
| regression gate: convention edits (F5)  |  -  | inert (not executable) | - | 3/3 caught, 0 FP |
| real-trace value-drift, 144 traces (F6) |  -  | (relational) 0/144 | - | (+absolute) 144/144 |
| temporal ordering mutants (F7)          |  -  | inert | - | 12/12 caught, 0 FP |

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

## FINDING 7 — the shipped TEMPORAL-ORDERING feature closes the sequencing bug-class gap (executable)
Payment sequencing (capture must follow authorize; settle must follow capture) is a core banking bug
class that NO arithmetic/relational invariant can catch. The multi-step ordering shipped this
session-set (`before`/`precedes` over the event timeline) expresses and checks it:
- temporal spec (capture_after_auth, settle_after_capture) monitored over event streams:
    valid streams passed (no false positive): 4/4
    ordering mutants (capture-before-auth, missing-auth, settle-before-capture) caught: 12/12
- => Pattern with F6: each language feature shipped this session closes a DISTINCT real bug-class gap
  the executable gate can now catch — DIVISION -> value bugs (0->144/144 on real traces); TEMPORAL
  ORDERING -> sequencing bugs (12/12). This is the concrete, deliverable "why v4 is better": not a
  higher one-shot build-correctness rate (saturated), but an expanding set of bug classes a v4 spec can
  mechanically GATE against, that a prose spec cannot express or check at all.

## FINDING 8 — coverage at scale: a monitorable spec generalises the oracle to ALL inputs
A value bug engineered to manifest only on large loans (disbursed >= 100k) is MISSED by a spot-check
test suite of small examples (d<=5000) — the bug isn't present in those cases — but the v4 spec-gate,
run over all 144 real traces, CATCHES it (on 24 traces). A monitorable invariant is one law checked
against every input the system actually sees, where an example-based test checks only the cases someone
thought to write. Honest caveat: somewhat expected (a suite without large loans can't see a large-loan
bug); the point is that a spec-gate's coverage is the whole input distribution, not a hand-picked set.

## FINDING 9 — v4's value expressiveness was incomplete for banking; this programme closed the gaps
Probing what real banking invariants v4 could express surfaced THREE essential missing constructs; all
were shipped this programme, end-to-end with tests + executable gate demonstrations (54 v4 tests pass):
- DIVISION `/` — was entirely absent (`x/1200` -> `x` silently). Enables rate/ratio invariants. (F6)
- min / max — caps and floors (`fee = min(computed, cap)`, `payment = max(due, minimum)`). Catches a
  cap breach the relational spec can't see.
- if / then / else — conditional/tiered values (`rate = if bal > 10000 then 5 else 10`). Catches a
  tiered-rate violation.
- => "Building a better language" is concrete and corpus-driven here: each construct was motivated by a
  real banking invariant it unlocked, and each measurably widened the executable gate's reach. v4 can
  now express the arithmetic of real loan/fee products (rates, caps, tiers) and gate against their drift.
  Remaining gap noted: the day-count-exact rate factor for penny-perfect interest laws.

## FINDING 10 — generality: the pattern holds in a SECOND domain (payment allocation)
Payment allocation (split a partial payment across penalty/fee/interest/principal), 42 oracle cases:
- With a NON-DEFAULT convention (pro-rata, not the waterfall the model defaults to): no-spec 21/42
  (guesses waterfall — right only where the two coincide); a complete prose spec 42/42.
- With a GUESSABLE convention (charges-first waterfall): no-spec 42/42 — saturates, as expected.
- => F1 generalises beyond loan schedules: a spec is necessary exactly when the convention is non-
  default; when it's guessable, no-spec saturates. Same law, second domain.
- Honest caveat: the v4 arm scored 24/42 here — but that reflects an INCOMPLETE v4 spec I wrote (one
  invariant pinning only the penalty share), not the language. Free prose was easier to make COMPLETE
  than a set of formal invariants — consistent with the recurring finding that v4 carries a
  fluency/completeness cost that prose does not, which its checkability is meant to offset.
