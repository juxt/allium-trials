# Modelling paradigms x bug classes x v4 capability — answering "are we just strong on relational?"

The P3 law ("a spec catches a bug iff the bug breaks a relation it STATES") is, restated, a fact about
v4's MODELLING PARADIGM: it checks relational/arithmetic invariants over numeric state. Each modelling
paradigm a spec language has catches a different bug class. Here is where v4 stands, with evidence.

| paradigm | catches bug class | v4 capability (evidence) | prior art for the gap |
|---|---|---|---|
| Relational / algebraic invariants (Sigma, =, <=, between quantities) | desync / structural: omitted-mismatched parts, broken conservation | **STRONG** — E3 600/600, E5 60/60, E4 real 4/7 | (this is our strength) |
| Absolute / input-anchored invariants (output = f(reference input)) | value errors (wrong rate/amount) | **EXPRESSIBLE, under-used** — E7 + E7-real catch wrong-rate 114/120 once you add `interest=rate*balance` + emit the input; static analyse can't do nonlinear but the runtime MONITOR can | within-paradigm; fix = D1/D3 |
| Light-sequential arithmetic (follows-guarded numeric roll-forward) | wrong state-transition ARITHMETIC | **PARTIAL** — balance_rolls works (monitored, E3 caught rollforward) but only when the consequent is NUMERIC | — |
| Temporal / ordering — IMMEDIATE past (`old`, previous event) | immediate-precedence / state-step: capture-not-directly-preceded-by-auth | **WORKS (event-based `monitor`)** — cap_after_auth = `is_capture implies old(is_auth)`: GOOD holds; BAD caught (kind temporal, witness "is_capture=T, old is_auth=F"). A real, useful ordering class | — |
| Temporal / ordering — MULTI-STEP / distance (`before`/`precedes`/`after`, arity-2) | out-of-order over a distance, replay across many events | **GAP** — event `monitor` skips arity-2 ordering ("relational atom of arity 2"); analyse: predicate "not declared". Auth-anywhere-before-capture NOT checkable | Allium v3 (lifecycle/trigger); TLA+; MFOTL (p-lens memo) |
| Temporal — quantified-temporal (`old` inside `every`/`some`) & liveness (until/since/eventually) | population-wide ordering; eventual settlement | **GAP** — `old` in a quantifier "not supported"; no future/eventually operators (finite pointwise) | TLA+ temporal; runtime verification |
| Pure boolean-state invariants (mutually-exclusive flags, guards) | illegal-state bugs | **SPLIT** — analyse's EPR/SAT layer handles them statically; the MONITOR skips them (numeric-only) -> not checkable against traces | — |
| Liveness / eventuality (something good eventually happens) | stuck/never-settles | **GAP** — no eventually/until; monitor is finite-trace pointwise | TLA+ temporal; runtime verification |
| Concurrency / interleaving (atomicity, races, linearizability) | race conditions, lost updates | **ABSENT** | TLA+, P, model checkers |
| Refinement / reference-model (impl refines an abstract spec) | value errors generally, behavioural equivalence | **ABSENT (D1)** | TLA+ refinement; model-based testing |

## The answer, precisely
Two distinct kinds of "miss" hide in the P3 law:
1. **Within-paradigm under-use** — value bugs. NOT a paradigm gap: v4 CAN express input-anchored
   absolute invariants and the monitor catches value bugs once you write them and emit the inputs
   (E7-real: 114/120). Fixable by usage + D1/D3.
2. **Cross-paradigm gaps** — TEMPORAL/ordering, LIVENESS, CONCURRENCY, REFINEMENT. These need modelling
   capability v4 largely lacks. Confirmed for temporal: it is PARTIAL — immediate-precedence via `old` WORKS (capture-after-auth caught), but multi-step ordering (before/precedes), quantified-temporal, and liveness are absent, and analyse cannot statically check any temporal.

So: yes, we are a RELATIONAL/ARITHMETIC-invariant checker and strong there; the bugs we miss are
dominantly (a) value bugs we simply haven't written invariants for, and (b) TEMPORAL/CONCURRENCY/
REFINEMENT bugs we cannot yet state. In banking these missed classes are first-class (payment
sequencing, no-replay/idempotency, eventual settlement, concurrent posting) — so the temporal paradigm
is the highest-value capability to add, and Allium's own v3 already had the lifecycle/trigger form to
draw on.

## Highest-value paradigm to add (recommendation)
TEMPORAL/ORDERING (past + bounded-future over a trace) — because (a) banking is full of it, (b) the
monitor already has the ordering vocabulary (before/precedes/after/follows in its evaluator) so wiring
it into name-resolution + the monitorable set is incremental, (c) v3 + MFOTL give a design, and (d) it
is checkable at runtime over finite traces (unlike full liveness). Second: REFINEMENT/reference-oracle
(D1) for general value bugs. Concurrency is the hardest and least incremental.

## CORRECTION (accuracy matters both ways)
v4 temporal is PARTIAL, not absent. Immediate past-temporal via `old` works end-to-end and catches a
real ordering class (capture must be directly preceded by auth). What is missing: (a) multi-step /
distance ordering (before/precedes/after arity-2 — evaluator has them but they are skipped in the
relational path and undeclared in analyse); (b) quantified-temporal (`old` inside a quantifier);
(c) liveness (until/since/eventually); (d) any STATIC (analyse) temporal checking. The fix is therefore
INCREMENTAL from a working base: the highest-value, most tractable step is multi-step past ordering
(wire the arity-2 ordering predicates into the relational monitor + analyse name-resolution), which the
evaluator already computes. Liveness and concurrency are the larger, separate efforts.
