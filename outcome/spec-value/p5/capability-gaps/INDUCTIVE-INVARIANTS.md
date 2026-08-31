# A capability we lack, from the model-checking field: inductive invariant preservation

Prompted by the observation that our corpus (loan schedules, double-entry) is a biased sample, this looks
at a capability the field (TLA+, Ivy, Alloy, P) has and Allium does not, asks whether a real specimen class
justifies it, and tests whether it is feasible in the existing engine. The answer to all three is yes.

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
