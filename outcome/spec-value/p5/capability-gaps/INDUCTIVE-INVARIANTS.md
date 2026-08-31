# A capability we lack, from the model-checking field: inductive invariant preservation

> **Status: SHIPPED.** This began as a capability gap and is now implemented in `analyse`. `allium analyse`
> reports "action X can break invariant Y" with a witness pre-state, and certifies guarded actions safe.
> The boolean-`=` defect below is also fixed. See "Implementation" at the end.

Prompted by the observation that our corpus (loan schedules, double-entry) is a biased sample, this looks
at a capability the field (TLA+, Ivy, Alloy, P) has and Allium did not, asks whether a real specimen class
justifies it, and tests whether it is feasible in the existing engine. The answer to all three is yes, and
it is now built.

## The specimen class our corpus ignores: state-machine safety

Everything we have tested is a *computation* checked against a *trace*: a loan schedule, a set of posting
legs. But a huge fraction of what people use a behavioural spec language for is *state-machine safety*: a
system moves through states via actions, and a safety invariant must hold in every reachable state. The
canonical banking specimens are exactly this and are absent from our corpus:

- a payment must never be *captured* without a prior *authorization*;
- a transaction id must never be *settled* twice (no double-spend);
- a loan must never move from *closed* back to *active* except through *reopen*;
- an account must never be *debited* while *frozen*.

These are not computations over a trace. They are properties of a transition system, and the bug is usually
a *missing guard* on an action. That bug has no natural trace: normal executions take the happy path, so
runtime monitoring never sees it. The field catches it by *search* over the transition relation.

## The gap: Allium checks coexistence, not preservation

Allium's `analyse` already does bounded model-finding for the boolean fragment: it finds a satisfying
witness and reports a requirement INFEASIBLE with the blocking axiom named. But that is *static coexistence*
(can these invariants all hold at once?). It does not check *preservation*: does each action maintain the
invariant? Given

```
action capture ensures captured(t)            -- NO guard requiring authed(t)
invariant no_capture_without_auth means captured(t) implies authed(t)
```

`analyse` reports nothing. From the initial state (not authed, not captured), `capture` reaches a state with
`captured and not authed`, violating the invariant. TLA+/Ivy/Alloy find this; Allium does not. This is the
inductive step at the heart of Ivy and of TLA+ `Spec => []Inv` proofs, and it is the "bug with no trace"
class that runtime monitoring structurally cannot reach.

## It is feasible in the existing engine

The one-step preservation query is a satisfiability question already in `analyse`'s fragment: does there
exist a pre-state satisfying the invariant, in which the action fires, whose post-state violates the
invariant? Encoding that by hand for `capture` and asking `analyse`:

```
unguarded capture (no requires authed)  ->  BUG FOUND (preservation query feasible)
guarded capture   (requires authed)     ->  SAFE      (preservation query infeasible)
```

It discriminates correctly: the missing guard is found, and adding the guard proves the action safe. So the
capability does not need a new solver. It needs a pass that, for each action and each invariant,
auto-generates `inv(pre) and effect and not inv(post)` with the frame conditions, and checks it. This is
bounded and decidable in the boolean/linear fragment `analyse` already has.

## The one blocker found along the way: boolean `=` is an opaque atom

Encoding the frame condition (`authed_post = authed_pre`) exposed a real over-approximation in the SAT
encoder (`sat.rs`): `=` between two boolean atoms is treated as a single opaque proposition, not a
biconditional. Minimal repro:

```
axiom link means a(s) = b(s)
requirement contra means a(s) and not b(s)   -- reported FEASIBLE; should be INFEASIBLE
```

Written with `implies` both ways it is correctly INFEASIBLE, which is the workaround the preservation test
above uses for its frame. It is a documented approximation (the encoder comment says non-boolean-connective
terms are opaque atoms), but it matters here: a preservation check that used `=` frames would wrongly pass
unsafe actions. The fix is to desugar boolean-typed `A = B` to `(A implies B) and (B implies A)` (and `<>`
to xor) before encoding, using the type checker to tell boolean `=` from an arithmetic equality, which must
stay opaque to the SAT path and is handled by the LRA path.

## Recommendation, justified by the specimen class

Add inductive invariant preservation to `analyse` as a first-class check: for every action-invariant pair,
generate and solve the one-step preservation query, and on failure report "action X can break invariant Y"
with the witness pre-state. It is a core model-checking capability the field considers table stakes, it is
justified by a real and common banking specimen class our corpus never exercised, it catches a bug class
neither runtime monitoring nor current `analyse` reaches, and it is feasible in the existing engine once
boolean `=` is desugared. This is the kind of sophistication the V&V value proposition should double down
on, and here the extra complexity is justified by concrete use cases rather than added speculatively.

## Reproduce

The four probe specs and their verdicts are in this directory (`proto.allium`, `induct*.allium`,
`eq.allium`). `allium analyse <file>` shows each verdict.

## It is a specimen class, not one example

The same one-step preservation encoding discriminates safe from unsafe across three independent
state-machine safety specimens, so the capability is justified by a class rather than a single case:

```
specimen                          unguarded action    guarded action
capture without authorization     BUG FOUND           SAFE
debit while frozen                BUG FOUND           SAFE
settle without validity           BUG FOUND           SAFE
```

Payment sequencing, account-state safety, and idempotency/validity are three distinct real banking
concerns, and the check catches the missing-guard bug in each and certifies the guarded version safe. That
comfortably clears the project's bar that a construct must earn more than one specimen. The feature to add
is the automation (generate the query per action-invariant pair); the reasoning it needs is already sound
in the engine, modulo the boolean-`=` desugaring noted above.

## Implementation (shipped)

`analyse` now runs a `preservation` pass. For each action and each boolean-fragment invariant in a
component, it builds the one-step verification condition and solves it with the existing SAT engine:

- **Frame by priming.** A state observable the action WRITES (appears bare, outside `old`, in `ensures`)
  becomes a distinct post variable `X'`; everything untouched keeps its pre variable, so the frame is
  implicit and needs no annotation. `old(X)` reads the pre value.
- **The VC** is `inv(pre) ∧ guard(pre) ∧ effect ∧ ¬inv(post)`. If satisfiable, the action steps from a
  good state to a bad one; the diagnostic names the action, the invariant, and the witness pre-state.
- **Soundness by restriction.** Only the pure boolean fragment is checked (no arithmetic, ordering, or
  quantifiers): those rest on opaque atoms whose post version is unconstrained and would false-alarm, so
  they are skipped. Verified: 0 preservation findings across 284 real v4 specs (no false positives), the
  three specimens discriminate (unguarded = bug, guarded = safe), and an arithmetic `bal >= 0` invariant
  is correctly left alone. Tests: `preservation_flags_missing_guard_and_clears_guarded_action`,
  `preservation_is_silent_on_arithmetic_invariants`, `preservation_ignores_actions_that_write_unrelated_state`.
- **The boolean-`=` fix.** `sat.rs` now encodes a boolean-typed `A = B` as a biconditional (and `<>` as
  xor), using the declared types to keep arithmetic `=` opaque for the LRA path. Test
  `boolean_equality_is_a_biconditional`.

Limitations, honestly: the check is one-step inductive, so it can flag an action that only breaks the
invariant from an unreachable pre-state (the invariant is true but not inductive — strengthen it, as in
TLA+/Ivy). Explicit quantified invariants (`every p :: ...`) and arithmetic invariants are deferred, not
covered. These are the natural next increments.
