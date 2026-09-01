# State machines in v4: a committed recommendation

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
