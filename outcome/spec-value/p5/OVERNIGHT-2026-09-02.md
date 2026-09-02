# Overnight session — 2026-09-02 (the SMT rung + arithmetic verification)

A single autonomous session extending the v4 static verification suite. Every change is committed with
tests green (770 workspace tests), the master reproducer passing, and **0 false positives on 346 corpus
specs, 0 crashes**. One unsound pass was built and reverted (see the lesson at the end).

## What the tool can now verify (this session's additions)

The theme is the **SMT rung** — mixing the boolean/enum (SAT) tier with the linear-arithmetic (LRA) tier
by case-splitting on finite guards. Before, an invariant that coupled a lifecycle state to an arithmetic
bound fell through the seam between the two tiers.

- **State-guarded arithmetic preservation** — `outcome = success implies out(o) >= 0`,
  `active(x) implies balance(x) >= 0`, over enum guards, boolean flags, numeric sum-type payload fields,
  conjunctive guards, negated guards (`phase <> pending`), and mixed finite+arithmetic guards
  (`status = healthy and wm >= 5 implies wm <= 10`). Full inductive story: **init establishment +
  preservation**, reported `INDUCTIVE` / `PRESERVED` / `init does not establish …`. Guarded monotonicity
  (`healthy implies wm >= old(wm)`) works too.
- **State-guarded promises in refinement** — a contract promise `active implies balance >= 0` is entailed
  by case-splitting on the guard.
- **Conservation / aggregate preservation** — `total = sum p :: balance(p)`, and N-sum accounting
  (`net = sum(asset) - sum(liab)`, double-entry). Catches an unbalanced debit/transfer; proves a balanced
  transfer safe. Sum treated as an opaque `S` with the update `S' = S + Σ body-deltas`.
- **Conditional arithmetic** — `payment = if late then base + 5 else base` expands to two guarded bounds.
- **min / max / abs** — derive the linear bounds (`X = min(a,b)` gives `X <= a`, `X <= b`; `abs` gives
  `X >= a`, `X >= -a`, `X >= 0`) so cap/floor/magnitude violations are caught.
- **Assumption surfacing (the elicit value)** — when init can't establish a bound because a free input is
  unconstrained, the tool names the missing assumption (`holds at init only if current_offset >= -1`); a
  state-guarded break on a transition into a guard names the precise missing invariant (`add
  status = frozen implies balance >= 0`).
- **Dead-state detection** — an enum lifecycle value no init/action ever produces is flagged unreachable
  (gated to written observables, so enum inputs are never flagged).
- **Computed-given inlining** — `given available means limit - used`, invariant `available >= 0`: the
  derived definition is inlined into invariants/effects/guards across all arithmetic passes, so a
  derived-value bound ties to the states an action actually changes (multi-level givens too).

## Validated on realistic banking / distributed specs

- Fineract-style **loan lifecycle** — caught the active-at-zero boundary bug; corrected model verifies
  INDUCTIVE.
- Full **account system** (open/frozen/closed + balances + conservation + transfers) — the tool guided to
  the one missing invariant (`frozen_nonneg`), after which everything verifies (4 INDUCTIVE + conservation
  PRESERVED). Specimens under `p5/loan-lifecycle/`.

## The lesson (an unsound pass, reverted)

Relational arithmetic ordering (`version(a)>version(b) implies offset(a)>=offset(b)`) was attempted for
overwrite actions on the argument that an overwrite makes the pre-state irrelevant. That is WRONG when the
overwrite value relates to the pre-state via the action's guard. The corpus scan reported 0 false
positives — it lacked the interacting pattern — but a hand-written capstone (a state-guarded watermark
bound + the version ordering over the same state) exposed it immediately. **Reverted.** Lesson: validate a
soundness-sensitive pass on a realistic MIXED spec, not only the corpus.

## Open (filed)

- #49 relational arithmetic (ordering needs the full disjunctive/SMT pre-reasoning; uniqueness deferred).
- #58 conditional/guarded sums (`sum of active balances`).
- #48 transitions-block sugar (cosmetic; needs a Span→Expr body mechanism).
