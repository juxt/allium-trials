# Type-theory ideas for v4: a ranked synthesis

Three agents assessed twelve type-theory ideas against one test: does it move a proof obligation into the
type system so an illegal state or value becomes unrepresentable, while staying inside the decidable,
descriptive fragment. The result is clearer than a list, because several threads converge on one decision,
and because the design has already travelled most of this road.

## The convergence: four questions are one

The state-machine work, James Henderson's sum-type suggestion, the typestate idea, and "where do events
live" are not four questions. They are one.

- Make the state a **sum type** whose variants are the lifecycle states, each carrying its own fields
  (James: illegal field access unrepresentable).
- Type each action as a **transition between variants** (typestate: `capture : Authorized -> Captured`, so
  capturing a voided trade is a type error, not a proof obligation, and the machine is declared, not
  inferred from scattered guards, which was v3's unsound mistake).
- An **event kind** is then just a variant carrying its payload, which gives events the first-class home
  they currently lack.

Two agents reached this independently. One noted the design holds a general tagged sum as a rejection
candidate "with no clearing specimen", and named the likely trigger: a lifecycle event whose fields differ
by kind. The other said the open lifecycle construct and the held sum-type decision are the same decision.
And the linchpin: achronic, the real event-sourced target system, already writes exactly this in v3 —
`EventOutcome` with `kind: Success | Failure`, `variant Success { outputs }`, `variant Failure { error }`,
different fields per variant. The clearing specimen the design was waiting for is in the target system. It
also carries refinement-shaped invariants (`gap >= 1`, `output_index >= 0`) throughout.

Crucially, the checking is already built. A variant is the state, each declared transition is a step
constraint, each state a variant no action leaves is a terminal, and these elaborate to the transition and
finality invariants shipped this cycle. So the semantics and the proof engine are done; what is open is the
type surface and one implementation piece (variant discrimination in the encoder).

## The discriminating principle (the answer to "which ideas fit")

The ideas that FIT move an obligation into a **nominal, stratified, closure-free** check: a variant tag, a
refinement predicate in linear arithmetic, a currency argument branding a sort, footprint-disjointness, a
monotone decoration. The ideas that FIGHT want **runtime identity, allocation, or use-order tracking**:
linear/affine types (consumption counting), object-capabilities (unforgeable references), borrow regions.
That machinery is exactly what Allium omits to stay decidable, so importing it breaks the one thing the
design cannot trade. This is a sharper line than "programmer idiom or not". Several so-called programmer
idioms are closer to their logical home in a predicate-and-sort language than in a programming language.

## Ranked adoption view

**Tier 1 — the convergent decision, genuinely open, highest value.**
Payload-carrying sum types with typestate: the variant is the lifecycle state (or event kind), each action
a typed transition. This is James's point, the lifecycle former, and typestate, unified. It answers the
single largest open question, ends the inference that produced v3's false deadlocks, houses events, and
elaborates to invariants already built and tested. The clearing specimen is in achronic. This is the thing
to decide.

**Tier 2 — ratified or accepted in the design, not yet built; cheap wins.**
- **Refinement types** (a type carrying a predicate: a non-negative Money, a rate in a range). Ratified in
  the design 2026-08-04 as a type former; the tool implements only the nominal one. It pushes an invariant
  into the type, discharged once by the linear-arithmetic engine already in the tool. achronic's
  `gap >= 1` and friends are the specimens. Buildable now, no new decision.
- **Monotone / ordered types as a decoration** (a field that only moves one way: high-water marks,
  append-only, a settled flag). The semantics are the accepted two-state invariant; the type form auto-
  generates the obligation over every action, closing a coverage gap the decision itself flagged. A surface
  decision plus a cheap build, not new mechanism.

**Tier 3 — genuine small increments for the human.**
- **Footprint in the interface.** Read/write footprints and the mover check are adopted, but as an
  annotation on the transition relation. Lifting a footprint onto a contract's surface, so two imported
  components' independence is checkable without their bodies, is the one un-banked composition move; it
  lands on the sealing boundary. Specimen G36.
- **Write-capability declaration** on an observable (written only by these actions), riding the existing
  footprint machinery, explicitly not regions or lifetimes. Serves the sealing specimens H38/B12.
- **Warn-only under-branding diagnostic** for parametric sorts (a sealed sort instantiated twice over one
  argument with nothing to tell the instances apart). Zero fragment cost, soundness-relevant.

**Tier 4 — leave in the programming languages where they belong.**
- **Linear / affine types.** Every target (uniqueness, no-double-spend, segregation) is already served by
  the uniqueness-key former, the set-once invariant, and an invariant over binding names. N75 was drafted
  specifically to force linearity and collapsed to applicative. Its substructural core needs a use-order
  the descriptive language does not have. The clear reject.
- **Object-capabilities.** The authority need is met by W1 (no imposition) nominally, plus objects the tool
  emits and the author cannot forge. Ocap wants runtime references and allocation, the machinery whose
  absence keeps the system decidable.
- **Full session types over channels, extensible rows, full dependent types.** No forcing specimen, and
  each threatens decidability or provenance.

## The reassurance, and the through-line

James's instinct that types are a good fit is strongly validated, and not by me: the design had already
reached most of this on its own. The P1 type formers (refinement, nominal, record) were ratified in August;
footprint-independence is adopted; the sealing arc is closed and is best accounted for by existentials;
parametric polymorphism over sorts is adopted and is the healthiest fit of the composition cluster. The
type-theory lens is where the design was already heading. What the review adds is one sharp, well-evidenced
push: the payload-carrying sum, held for want of a specimen, has its specimen in the real target system,
and adopting it resolves the state machine, the events question, and James's point at once.
