# State machines in v4: a committed recommendation

> **REVISED after senior-engineer review (James Henderson, 2026-09-01).** Two of his points improve the
> direction and one reframes it; see "Revision" at the end. In short: (1) make the state a SUM TYPE rather
> than a separate status field with `when` field-presence, so illegal states are unrepresentable by
> construction; (2) govern transitions BY THE RULES that change the state (declare the edge on the rule,
> specify it once), rather than a separate `transitions` block; (3) the real blocker is the conceptual
> model — where state, behaviour and events live, and which constructs are declarations versus values —
> which must be settled before any surface syntax. The elaboration target below (transition + finality
> invariants) is unchanged and still does the checking; only how you WRITE the machine changes.

The state-machine story has been the one recurring blocker (the "terminal marker" kept coming up). This is
a decision, so it is yours; but you asked me to commit to a direction, and the evidence now points to one
clearly. This is that recommendation, with the demonstration that it works.

## The recommendation, in one line

Adopt v3's `transitions <status-field> { A -> B, …; terminal: X, Y }` block as the v4 surface (Shape-A),
and give it v4 semantics by ELABORATION into constructs v4 already has — no new semantic primitive.

## Why Shape-A, and why now

Three independent lines of evidence converge.

**The v3 postmortem is decisive.** The banked lesson (`v3-tooling-postmortem-lessons`) says v3's worst
bug class — false deadlocks, false `status.noExit`, false unreachable-value (#18, #58, #64) — all came
from one root cause: v3 has no lifecycle former, so it INFERS the state machine from scattered guards and
enum-value names, unsoundly. The recorded conclusion is that this is "the strongest evidence for the former
AND for Shape-A (transition-list on the status field): a declared edge-set removes the inference." A false
deadlock is worse than a missed one, and inference is what produces them.

**My own V&V work has been committing the same sin.** Everything I built this cycle — preservation, BMC,
k-induction, dead-action — reconstructs the state machine by reading scattered `action requires/ensures`
over hand-rolled boolean flags. It is the inference pattern, one layer up. It works on clean fixtures, but
it is exactly the fragile thing the v3 postmortem warns against. A declared `transitions` block removes the
inference: the states, the legal edges, and the terminals are stated, not guessed.

**It elaborates onto what v4 already accepts.** The two-state / step invariant was accepted (CONSTRUCTS.md,
2026-08-06) and I implemented it this cycle (transition/finality invariants). A `transitions` block is
sugar over exactly that:

- the status enum is the state observable;
- each declared edge `A -> B` is a step constraint (`status` moves only along declared edges);
- each `terminal: T` is a finality invariant (`old(status = T) implies status = T` — a terminal is never
  left), which is the finality check I just shipped;
- the entry state is `init`.

Actions still perform the moves; preservation then proves each action respects the declared graph. So the
block (a declarative constraint) and actions (the operational moves) compose cleanly, and nothing new is
added to the semantic core. This keeps the small-core philosophy intact: the surface grows, the calculus
does not.

## It is demonstrated, not asserted

`lifecycle_elaborated.allium` hand-expands an order lifecycle
(`created -> paid -> shipped -> delivered; cancelled; terminal: delivered, cancelled`) into v4 today. The
existing suite proves both terminals INDUCTIVE (never left), proves `no_deliver_and_cancel` safe by
5-induction, and — when an illegal `reopen` edge is injected that leaves the terminal `delivered` — catches
it as breaking `delivered_final`, with a witness. The elaboration target is real and already checkable.

## What this unblocks

- **The terminal marker**, directly: `terminal:` states become finality invariants, proved automatically.
- **The deferred deadlock check.** It was parked because, without a terminal marker, deadlock detection
  flags every legitimate terminal state (a delivered order, a settled trade) as noise. With declared
  terminals, deadlock detection distinguishes an intended dead-end (declared terminal) from a real stuck
  state (an undeclared dead-end). The blocker resolves the block.
- **Cleaner specs.** Enumerated states replace hand-written one-hot boolean flags; the mutual-exclusion
  ("exactly one state") is derived from the declared value set, not authored, removing a class of error.

## The one real cost, scoped

The checker currently reasons over boolean state. An enum `status : S` needs the "exactly one value"
constraint in the SAT encoding (`status = a` xor `status = b` …), auto-generated from the value set the
`transitions` block declares. This is a bounded, well-understood addition to the encoder; the demonstration
sidesteps it by using the boolean one-hot encoding the surface would generate, which proves the semantics
without needing the enum support first. It is the only implementation work the direction requires.

## Two smaller calls, flagged

- **`when status = s1 | s2` field presence** (a field exists only in certain states) is the other half of
  v3's lifecycle surface. It is orthogonal — a data-shape refinement per state — and genuinely useful
  (lifecycle-dependent data). Recommend adopting it too, but it is separable from the core decision.
- **Surface tokens** (`transitions`, `terminal`, `->`) are yours to confirm. Importing v3's exactly, as
  you suggested, is the low-friction choice and it reads well; the naming test passes (`terminal`,
  `transitions` mean what a settlement engineer would think).

## The decision to commit

Adopt Shape-A: `transitions <field> { edges; terminal: states }`, semantics by elaboration to the enum
status observable + step invariant (edges) + finality invariants (terminals) + `init` (entry). Add enum
support to the checker. Let deadlock detection read declared terminals. No new semantic core. This ends the
inference that produced v3's false deadlocks, unblocks the terminal marker and the deadlock check, and
reuses the transition-invariant machinery already built and tested.

## Revision after senior-engineer review

**1. Sum type, not `when` field-presence.** He is right, and it is the stronger version of the same goal.
A status field plus `field X when status = shipped | delivered` re-checks per field what a sum type
guarantees once: make the state a tagged union whose variants carry exactly the fields valid in that
state, and an illegal field access is unrepresentable, not a proof obligation. This drops the `when`
clause entirely. Cost: v4 has no sum types today (its enums are barely more than source text), so this is
a genuine type-system addition, not just surface. It aligns with the design's own "exhaustiveness is a
type property, make it unrepresentable" line (FRICTION.md 141).

**2. Govern transitions by the rules, not a separate block.** Also right, and it reconciles with the
postmortem rather than contradicting it. The postmortem's lesson was "declared, not inferred"; v3's bug
was inferring the graph from guard SHAPES. His "specify once" says: declare the edge explicitly ON the
rule that performs it (`pay : created -> paid`), and the graph is the union of those declared edges, with
a terminal being a variant no rule leaves. That is still declared, not inferred; it just removes the
redundancy of stating the edges twice (once in a block, once in the rules) and co-locates each edge with
its behaviour. So the separate `transitions` block goes too. The elaboration is unchanged: each declared
edge is a step constraint, each derived terminal a finality invariant.

**3. The model must be settled first — this is the actual blocker.** He cannot map his mental model
(surface, actor, contract) onto Allium, and cannot tell which constructs are values, instances, or
declarations. That is not a syntax problem, and no `transitions` surface fixes it. The answer, and the
open gap:

- STATE lives in `observable state f(Entity) : T` — functions from an entity instance to a value.
- BEHAVIOUR lives in `action` — the guarded transition, the only thing that writes state.
- EVENTS have no first-class home. At design time an "event" is an action firing; at runtime it is a
  trace entry the monitor reads. There is no event type or event value. For an event-SOURCED domain
  (achronic is one), where the log of events is primary and state is derived, this is a real impedance
  mismatch and is very likely the source of his confusion about "where events live".
- Declaration vs value: Allium is a DESCRIPTIVE language (the TLA+ / Alloy / Z family), not a programming
  language. Almost every construct is a DECLARATION describing a model — `contract` (an interface, like a
  Java interface), `component` (a module that satisfies contracts and holds entities, state and actions),
  `entity` (a sort), `observable`/`action`/`invariant`. The only first-class VALUES are entity instances
  and their observable values, which predicates quantify over (`every p ::`). There are no actor values
  you construct and pass; a component/actor is a module, a contract/surface is an interface, and one
  satisfies the other (`component X satisfies (_ : C)`), which is the refinement check already built.
- The vocabulary itself is split: "surface / actor" are the productised v3 terms he is using; "contract /
  component" are the v4 research terms this work is built on. A surface is a contract; an actor is a
  component. Unifying that vocabulary is part of removing the confusion.

**Net.** The state-machine SEMANTICS and the checking are settled and demonstrated. What is NOT settled,
and what his review shows must come first, is the conceptual model and its vocabulary: fix where events
live, decide sum-typed state, decide rule-governed transitions, and unify surface/actor/contract with
component/entity/action. The surface syntax follows from that, and it elaborates to the invariants already
built either way.

## Built and validated on the real target (2026-09-01, mandate relaxed)

With the constraint on new syntax lifted, the lifecycle/sum-type story is now built and checked on
achronic's actual shapes (`achronic_lifecycle.allium`), and it holds:

- **Enum lifecycle states** reason as exactly-one; `action`s move them; preservation proves the invariants.
- **`terminal <state-cond>`** declares an end state, desugaring to a finality invariant proved
  automatically (achronic's `delivering` terminal proves INDUCTIVE).
- **Payload-carrying sum types** — `outcome : { success { outputs } | failure { error } }`, achronic's real
  `EventOutcome` — parse, hold exactly-one over the tags, and enforce correct-by-construction guarded
  access: reading a field outside its variant's guard is ill-formed.
- **Stuck-state (deadlock) detection** flags a reachable non-terminal dead-end, and correctly stays silent
  on `delivering` because it is declared terminal — resolving the deadlock check that was blocked precisely
  on the missing terminal annotation.

So James's two points (sum types, govern the state naturally) and the Tier-1 synthesis (lifecycle = sum-
typed state + typed transitions) are realised, built onto what existed rather than bolted on, and validated
on the system they were meant to serve. 749 tests, 0 false positives across the corpus. What remains, and
is genuinely optional, is the deeper typestate discipline (an action typed as a variant-to-variant
transition rather than reading its edge from `requires`/`ensures`), which the current form already
approximates soundly.
