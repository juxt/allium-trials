# Overnight session — 2026-09-02 (the SMT rung + arithmetic verification)

A single autonomous session extending the v4 static verification suite. Every change is committed with
tests green (773 workspace tests), the master reproducer passing, and **0 false positives on the corpus,
0 crashes**. One unsound pass was built and reverted (see the lesson at the end).

**Headline:** built a 28-specimen static-analysis soundness gauntlet (the missing guard for the static
analyser — the reproducer only guarded the monitor). It surfaced four verdict issues from mixed specimens
the corpus lacked. Two were FIXED with tests (a second `ensures` clause silently dropped; the boolean
literal `= true` encoded as a free SAT atom). Two are FILED with diagnosis and gauntlet tripwires that flip
when fixed (cross-module `given`/contract resolution, #61; `in { }` guards not preservation-checked, #63 —
its expand-in fix reverted as unsound). The monitor was spot-validated and found transparent (it reports
enum-value invariants as skipped rather than passing them silently). The recurring discipline: when a
soundness-sensitive fix cannot be fully validated, REVERT and file rather than ship.

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

## A static-analysis soundness gauntlet (and the bug it caught)

`reproduce.py` guards the MONITOR (runtime traces); the reverted unsound pass lived in the static ANALYSER,
unguarded. So `p5/soundness-gauntlet/` now holds 27 known-verdict `analyse` specimens across seven verdicts
(CLEAN / BREAK / ERROR / SAT / NOSAT / INFEAS / DEAD) and the main tool surfaces — preservation,
conservation, state-guarded arithmetic, refinement entailment (both directions, incl. the
false-certification refusal), feasibility, types/dimensions, dead-state and boolean-literal encoding.
`guard.py` asserts every verdict and is wired into `reproduce.py`. The centrepiece `trap_monotone_overwrite`
is the exact interacting shape that broke the reverted relational pass.

On its FIRST run the gauntlet caught a real bug: an action with two separate `ensures` lines silently kept
only the first (`ensures` isn't an item-starter, so the clauses ran into one span and only the first
equality parsed) — a false positive in the aggregate pass and a latent false negative anywhere a dropped
clause breaks a bound. Fixed: the parser now rejects a second `ensures`/`requires` with a pointed message
(combine with `and`).

Extending the gauntlet to type/dimension and dead-state surfaces caught a SECOND bug: `ensures logged(x) =
true` false-alarmed as a break because the SAT encoder treated the boolean literal `true` as a free atom
(so the solver could pick `true = false`). Fixed: `true`/`false` now encode as the constants ⊤/⊥. This one
lived in the core SAT engine and affected any boolean-literal equality — seven real specs use the pattern.

Around twenty further adversarial probes (guard on/off, negated-guard activation, conjunctive and
arithmetic-guard breaks, computed-given totals and conditionals, nonlinear graceful-skip, refinement
near-misses, feasibility, universal and existential quantifiers, establishment, type/dimension, dead-state,
biconditional encoding) all came back sound. The gauntlet is 27 specimens across seven verdicts
(CLEAN / BREAK / ERROR / SAT / NOSAT / INFEAS / DEAD) plus two cross-module tripwires. One design question
was logged, not fixed (an agent should not decide it): dead-state on a written enum with NO `init` flags a
guard-required value as unreachable — it hinges on whether a missing `init` means "vacuous" or
"unconstrained initial", a human semantics call.

## Cross-module is the next frontier (filed, not fixed)

Probing the cross-module surface (the v3 postmortem's dominant defect class) found that v4's semantic passes
are single-module. Name resolution is import-aware, but the arithmetic and refinement passes never receive
imported `given` bodies or contracts: an invariant using an imported `given` is silently under-checked (a
real break is missed), and a component that `satisfies` an imported contract reports "no such contract is
declared" instead of a proper SAT/NOSAT. Same root cause, filed as #61 with two gauntlet tripwires that flip
when the fix lands. Not attempted under time pressure — it is a cross-cutting change to the import-merge
layer. A third attempted fix (expanding `in { a, b }` guards to disjunctions, #63) caught its target break
but introduced a false positive on the guard-off case and was reverted too — an "equivalent" rewrite that
diverges in the encoder, the same lesson as the relational pass.

## What the real target specs actually need (the prioritisation signal)

Running `analyse` over the real `achronic/specs` (10 files) reframes where value comes from. Those specs
produce **zero** invariant-verification diagnostics — they are event-driven (rules, triggers, surfaces,
deferred specifications) and multi-file, not the invariant-preservation shape the arithmetic tier proves. So
the arithmetic/state-guarded verification hardened here delivers on the **banking** specimens (Fineract loan
schedules, the gauntlet); achronic value is gated by **cross-module resolution**, which is blind in three
places at once: semantic (imported `given`/contracts, #61), structural triggers (a rule consuming a trigger
emitted in an imported module, 17 times, #66 — needs confirmation vs spec subtlety), and the unreferenced
lint (a `core/Type` used across files flagged as unreferenced). All three share the crate `allium` import
context. For achronic, closing cross-module outranks any further single-module verification feature.

## The one feature added (safe, message-only)

An arithmetic preservation break now names the weakest guard — `To fix, guard it: requires balance(e) -
fee(e) >= 0` — instead of a generic "Add a guard." (the elicit value). It reuses the boolean pass's tested
`guard_suggestion` with `old` read as the pre-state. Message-only, so no verdict-soundness risk — which is
why it was safe to build when the verdict-affecting fixes were not.

## The lesson (an unsound pass, reverted)

Relational arithmetic ordering (`version(a)>version(b) implies offset(a)>=offset(b)`) was attempted for
overwrite actions on the argument that an overwrite makes the pre-state irrelevant. That is WRONG when the
overwrite value relates to the pre-state via the action's guard. The corpus scan reported 0 false
positives — it lacked the interacting pattern — but a hand-written capstone (a state-guarded watermark
bound + the version ordering over the same state) exposed it immediately. **Reverted.** Lesson: validate a
soundness-sensitive pass on a realistic MIXED spec, not only the corpus.

## Open (filed)

- **#61 cross-module semantic** (imported `given` bodies + contracts unreachable) and **#66 cross-module
  structural** (imported→importer trigger flow; unreferenced-lint blindness) — the priority for achronic.
- #63 `in { }` guards not preservation-checked (fix reverted as unsound; tripwire pinned).
- #64 monitor enum-value point invariants (transparent skip today; widen the fragment).
- #65 monitor-schedule warns on zero period rows.
- #49 relational arithmetic (ordering needs the full disjunctive/SMT pre-reasoning; uniqueness deferred).
- #58 conditional/guarded sums; #60 conjoined multi-clause `ensures`; #48 transitions-block sugar.

## Scoreboard

31-specimen gauntlet, seven verdicts, wired into `reproduce.py`. Two soundness bugs fixed with tests
(multi-`ensures` drop, `= true` SAT literal); one elicit feature added (weakest-guard suggestion); two fixes
reverted rather than shipped unsound (relational overwrite, `in`-guard). 774 workspace tests green, master
reproducer green, 0 corpus panics. The through-line: known-verdict adversarial mixed specimens on a proven
engine either confirm soundness or find a bug on first run — four verdict issues surfaced this way.
