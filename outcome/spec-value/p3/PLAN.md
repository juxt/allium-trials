# Execution plan (P3c) — fix the checker, then grow two paradigms

Budget: to ~20:30. Order is deliberate: correctness first (a checker you can't trust taints everything),
then the two highest-value paradigm additions. Keep additions NATURAL in v4's existing syntax/semantics;
OCaml is the language inspiration (pure functions, algebraic/pattern thinking, `let` bindings).

## 1. FIX D8 — relational quantified monitor correctness  [FIRST, it's a bug]
Symptom (repro in p3/temporal/): `some a :: is_open(a)` false-flags; `every a::every b:: a=b`
(uniqueness/at-most-one) false-passes; single-`every`+predicate is correct.
Approach: (a) add a Rust unit-test suite in monitor.rs covering every/some/no/exists-one x single/multi-
quantifier x entity-identity (RED first); (b) decide violations via `eval_rel` not the universal-only
`find_witness`; (c) root-cause + fix eval_quant/eval_rel for `Some` and entity-identity `a=b` (debug with
eprintln if needed); (d) all tests GREEN; (e) re-run p3/temporal repro. Verify P1-P3 unaffected (sum +
single-every arithmetic paths untouched).

## 2. ADD temporal ordering — multi-step before/precedes as first-class  [highest-value paradigm]
Gap: analyse name-resolution doesn't declare before/precedes/after; the relational monitor can't compare
event order (arity-2 ordering skipped). `old` (immediate past) already works.
Natural-in-v4 design: keep `before(a,b)`/`precedes(a,b)`/`after(a,b)` as built-in ordering predicates over
events of an entity (event index/time). Wire: declare them in analyse name-resolution (so specs
type-check); give the monitor an event-order index per entity so eval_rel can evaluate before(a,b) =
index(a) < index(b). Semantics decision (natural): ordering is over the event SEQUENCE of a single
entity's timeline (a,b are events), matching how `old` already reads the previous event. Verify:
auth-anywhere-before-capture and no-replay-over-a-window are catchable.

## 3. ADD reference/absolute oracle (D1)  [closes value-blindness generally]
Gap: relations-only specs miss consistent-value bugs; today you must hand-write an input-anchored
invariant AND get the input into the trace.
OCaml-inspired, natural-in-v4 design: allow a PURE FUNCTION definition in the spec (OCaml `let`),
e.g. `let expected_interest(bal, rate) = bal * rate`, and let invariants assert `interest(p) =
expected_interest(outstanding_start(p), rate)`. The function is the reference oracle; the monitor
evaluates it on concrete trace values (nonlinear ok at runtime). This keeps absolutes first-class and
composable, in v4's existing invariant syntax, without a separate "golden trace" mechanism. If a full
`let` is too big for the budget, prototype the minimal form (a named pure expression) and demonstrate it
catches the wrong-rate mutant end-to-end.

## Discipline
Every change: RED test first, then GREEN, then re-run the real repro. Do not ship unverified (I reverted
an unverified D8 fix last session — do not repeat). Constructs/names are the human's; these three were
DIRECTED by the human this session. Commit each step. If a step over-runs, stop at a clean, tested state.
