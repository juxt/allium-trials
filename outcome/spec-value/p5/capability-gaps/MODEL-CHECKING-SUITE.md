# Model checking in Allium: the verification suite `analyse` now runs

This is the capstone for a build cycle that turned Allium's `analyse` from a consistency/feasibility
checker into a genuine model checker for behavioural safety. It began from an observation that the value
corpus (loan schedules, double-entry) was biased toward *computation checked against a trace*, and missed
the *state-machine safety* class that TLA+, Ivy, Alloy and P exist for. That class is now first-class, on
the single static binary with no external solver.

Everything below runs under `allium analyse <file>`, is unit-tested, and produces zero false positives
across the 284 real v4 specs in the corpus.

## The bug class: safety with no execution trace

A safety invariant must hold in every reachable state of a system that moves through states via guarded
actions. The characteristic bug is a *missing guard*: an action that can step from a good state into a
state violating an invariant. It has no natural execution trace — normal runs take the happy path and
never exhibit the violating transition — so runtime monitoring (`monitor`) structurally cannot catch it.
It is caught only by reasoning over the transition relation. Three real banking shapes: capture without
authorization, settle a DvP leg unilaterally (atomicity), withdraw past a zero balance.

## The verdict taxonomy: what `analyse` now tells you per invariant

For each `invariant` over a machine of `action`s (with `requires` guards and `ensures` effects) and an
`init`, `analyse` reaches one of these verdicts:

- **INDUCTIVE** — `init` establishes it and every action preserves it, so it holds in every reachable
  state. A genuine unbounded safety proof (1-induction).
- **SAFE (proved by k-induction)** — not 1-inductive, but no reachable state violates it, proved by
  looking k steps back. Unbounded proof for the harder invariants (e.g. `r => p` where the breaking
  pre-state is unreachable because `q`, needed to reach it, only follows `p`).
- **REACHABLY VIOLATED in k steps** — a concrete minimal counterexample execution from `init`, e.g.
  `init -> authorize -> void -> capture`. A definitive bug with the exact call sequence.
- **can break invariant Y (+ suggested guard)** — a one-step break from a state satisfying the whole
  invariant set, with a witness pre-state and the weakest guard that fixes it (`To fix: requires X`).
  Reported when neither an unbounded proof nor a bounded counterexample was found within the bound.

Plus two machine-level checks: **`init` does not establish Y** (the base case fails), and **action X is
never enabled** (dead spec code — its guard holds in no reachable state).

For **relational** (two-entity) invariants — uniqueness, mutual exclusion, segregation, written
`every a :: every b :: (active(a) and active(b)) implies a = b` — there is a further verdict: **action X
can break relational invariant Y** (acting on one entity violates the relation against another). This is
the design-time counterpart of the runtime uniqueness/no-double-spend checks, and it covers the
segregation concern the corpus raises (N75 margin pools).

## How it is built (all in `analyse.rs` / `arith.rs`, no external solver)

- **Preservation (1-induction).** For each action × invariant, the verification condition
  `inv(pre) ∧ guard ∧ effect ∧ ¬inv(post)` is solved. A written state observable becomes a primed post
  variable; the frame is implicit (unmodified observables share their pre variable). SAT ⇒ a break.
- **The whole conjunction is the pre-state**, so an invariant that is only inductive given the others is
  not spuriously flagged (prove the conjunction inductive, the standard technique).
- **Two fragments.** Boolean invariants go through the dependency-free SAT engine; numeric invariants
  (e.g. `balance >= 0` under `withdraw`) through the linear-arithmetic simplex. Each is sound by
  restriction: anything nonlinear/unmodelled is skipped rather than guessed.
- **Quantified invariants** (`every p ::`, `no p ::`) are handled by normalising the invariant's and the
  action's entity variables to one canonical entity — an action touches one entity, so that is the
  instance that matters.
- **BMC** unrolls the transition relation with iterative deepening (exactly one action fires per step,
  guards/effects/frame per step) and searches for the shortest execution from `init` to a violating
  state, reading the action trace off the model.
- **k-induction** reuses the same transition encoding without `init`: if no path of k steps has the
  invariant holding throughout then failing at the end, and BMC found no bounded counterexample, the
  invariant is proved. A proof supersedes the weaker 1-step break note.
- **Dead-action** asks, per action, whether its guard is satisfiable in any state reachable within the
  bound.
- **Relational preservation** instantiates a two-entity universal invariant at the pairs `(_e, _f)` and
  `(_f, _e)` for the modified entity `_e` and a symbolic other `_f` (framed), resolves entity equality to
  a constant, and checks whether the effect on `_e` can break either instance — a sound bounded two-entity
  instantiation, since the action touches only `_e`.

## Validation

- **Unit tests**: preservation (break + guard suggestion + arithmetic + conjunction), init-establishment,
  INDUCTIVE, quantified, BMC (counterexample + silence), k-induction, dead-action. 736 workspace tests
  pass; the P4/P5 master reproducer stays green (17/17).
- **Payment lifecycle** (`lifecycle/`): four guarded actions, four interacting invariants — all INDUCTIVE
  on the correct spec; three seeded missing-guard bugs each caught by preservation (fix) and BMC (trace).
- **DvP settlement** (`settlement/`): a different domain — atomicity as paired implications — six
  invariants all INDUCTIVE; two seeded atomicity bugs caught with traces. Shows generality.
- **Defect fixed en route**: boolean `=` was an opaque atom in the SAT encoder (so `a = b` was silently
  dropped); it is now a proper biconditional, type-aware so arithmetic `=` stays with the LRA path.

## Honest bounds

- Sound, not complete: skipped (nonlinear, multi-entity, existential) invariants get no verdict rather
  than a wrong one. BMC and k-induction are bounded (≤6 steps); silence from BMC is "no counterexample
  within the bound", and the *proof* comes from induction/k-induction, not from BMC's silence.
- The boolean state-machine fragment for BMC/k-induction/dead-action requires literal-effect actions and
  a fully-pinned `init`; other specs are declined cleanly.
- Deadlock detection is deferred: without a `final`/`terminal` annotation it would flag legitimate
  terminal states (a refunded payment, a settled trade) as noise.

## Why this matters for the value proposition

The programme's earlier finding was that Allium's demonstrated edge is the *executable gate* — a spec
checked against real traces at runtime. This adds the complementary half the field considers table stakes
and that a runtime gate structurally cannot provide: **design-time proof and refutation of behavioural
safety**, over all reachable states, with counterexample traces and suggested fixes, for the missing-guard
bug class that never shows up in a trace. It is the V&V core of the value proposition, made real and
sound, in a single redistributable binary.
