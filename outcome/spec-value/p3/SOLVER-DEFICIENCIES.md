# Solver / checker deficiencies found — and how to fix them (actionable)

Framing (per the human): where the checker is weak is useful IF it is fixable — especially where other
behavioural-spec languages already have the capability. Ranked by value.

## D1 — No absolute-value / reference-oracle capability  [HIGHEST VALUE]
Finding: the spec checks RELATIONAL invariants only, so it is blind to consistent-VALUE bugs — E2
(0/20 solver arithmetic mutants), E5 (0/30 uniform-scale). This is the single biggest gap: it is why
the spec adds no regression value on solver code and why golden/fixed-value tests are still needed.
Fix: give a spec a way to pin ABSOLUTE behaviour, not just relations — a reference model / expected-
value / refinement capability. Prior art: TLA+ refinement (implementation refines an abstract spec);
model-based testing (assert the system against a reference model over generated inputs); QuickCheck
"model" properties. With this, `interest = rate x balance` could be checked against an independently
specified rate, catching the wrong-rate/mul mutants the current spec misses.

## D2 — Single global monitor tolerance  [E6, easy fix]
Finding: `monitor-schedule` uses one tolerance (default 0.005). At default, sub-0.005 desyncs escape
(E6: +0.001 -> 0/15); at `--tol 0` any nonzero desync is caught (15/15). But different invariants need
different tolerances in the SAME spec: double-entry must be EXACT (tol 0), floating schedule math needs
an epsilon. One global tol cannot serve both, and the default 0.005 is unsafe for exact domains.
Fix: per-invariant tolerance, or an `exact`/`approx(eps)` annotation on each invariant. Cheap.

## D3 — Unmonitorable invariants silently skipped  [P2, correctness-of-confidence]
Finding: `interest_on_balance` referenced a `given rate` absent from the traces, so the monitor SKIPPED
it silently — an unchecked invariant reads as "fine" (false comfort). 
Fix: (a) let the monitor bind givens / read them from the trace manifest so more invariants are
checkable; (b) at minimum, LOUDLY report every skipped invariant as uncovered. Prior art: coverage
reporting in most verification tools; "checked/total" summaries.

DEMONSTRATED FIX (E7): with rate_factor added to the trace, interest_on_outstanding is evaluated and CATCHES the wrong-rate value bug (resid 10.0) that E2's rate-less traces missed. The fix (emit reference inputs into traces + never silently skip) directly converts value-blind into value-catching for computable absolute invariants.

## D4 — Weak vacuity / reachability / coverage detection  [P2]
Finding: a pure vacuity (guard antecedent unreachable) was NOT caught by analyse; nothing flags "this
guarded case never occurs in the traces". Vacuously-true invariants give false assurance.
Fix: stronger vacuity + guard-reachability checks in analyse; in the monitor, report per-invariant how
many times each guard's antecedent was actually exercised. Prior art: TLA+/Alloy vacuity checks; Alloy
coverage; "trivially true" detection.

## D5 — Trace-corpus coverage gaps  [E2]
Finding: several E2 mutants showed changed=no because the 150-input grid never exercised the mutated
site (the shipped test's targeted input did). The monitor only sees behaviour the corpus exercises, so
under-sampled inputs are blind spots.
Fix: coverage-guided trace generation (track which branches the traces hit), or PBT-style input
generation aimed at maximising code/branch coverage. Prior art: coverage-guided fuzzing; PBT generators.

## D6 — Completeness metric is battery-dependent  [P2, methodology]
Finding: the "63% complete" number depends on the mutation operators I chose; not portable.
Fix: adopt a standard mutation-operator set (e.g. PIT's operators) so completeness is a comparable,
principled number rather than an artefact of the battery.

## Net
D1 is the load-bearing one: adding a reference/absolute-value capability would let Allium catch the
value bugs that currently only golden tests catch — turning the "complementary" story into a fuller
regression gate. D2-D6 are smaller, mostly-known fixes that raise the trustworthiness of the checks
themselves (exactness, coverage honesty, vacuity). None is a fundamental barrier; all have prior art.

## D7 — Temporal is PARTIAL: immediate `old` works; multi-step ordering + liveness missing  [HIGH VALUE, incremental]
Finding: an auth-before-capture property is NOT checkable. analyse reports the ordering predicates
`before`/`follows`/`precedes` as "not declared" (name resolution); the monitor evaluates ONLY numeric
invariants and SKIPS boolean/temporal ones — it returned `monitored:0, ok:true` on a spec whose only
invariant was temporal (false comfort: an unchecked temporal spec reads as passing). The ordering
vocabulary EXISTS in the monitor's expression evaluator (before/precedes/after/follows) but is not
wired into name-resolution or the monitorable-invariant set.
Fix (incremental): declare the ordering predicates in analyse name-resolution; extend the monitor to
evaluate boolean/temporal invariants (not just numeric) over the ordered trace; add past + bounded-
future operators. Prior art: Allium's OWN v3 (lifecycle/rule/trigger), TLA+/temporal logics, MFOTL
(p-lens memo). Highest-value paradigm to add: banking is full of ordering/replay/settlement-sequence
properties; runtime-checkable over finite traces (unlike full liveness).

## D3 (STRENGTHENED) — the monitor silently skips WHOLE CLASSES of invariant, reporting ok=true
Beyond skipping invariants that reference absent givens (original D3), monitor-schedule skips EVERY
non-numeric invariant (pure boolean, temporal/ordering) entirely and still reports `ok:true`. A spec of
only such invariants monitors 0 and looks like it passed. Fix: report monitored/total and FAIL loudly
(or refuse) when load-bearing invariants are unmonitorable, rather than silently returning ok.

## D8 — Uniqueness / at-most-one invariants FALSE-PASS  [CORRECTNESS BUG, HIGH SEVERITY]
Finding (black-box, two forms): `every a :: every b :: (is_open(a) and is_open(b)) implies (a=b)` and
`no a :: no b :: (a != b and is_open(a) and is_open(b))` both report monitored=1, ok=true on a trace
with TWO distinct open entities — a clear violation. The monitor returns a FALSE PASS (not a skip). The
relational evaluator claims to support entity identity `a=b` (monitor.rs:184) but the double-quantifier
uniqueness form is mis-evaluated. This is worse than the temporal skip: a violated invariant reads as
passing. Uniqueness/no-duplicate/at-most-one is a core banking class (replay/idempotency, single active
mandate, one-open-position). Fix: correct nested-quantifier + entity-identity evaluation in eval_quant/
eval_rel, and add a test that a two-entity uniqueness violation is caught. Until fixed, DO NOT rely on
uniqueness invariants — they can silently pass. (Caveat: observed black-box; may be mis-report-as-
monitored rather than mis-evaluation, but the user-facing false pass is the same.)
