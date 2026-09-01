# Refinement checking: what shipped, and the semantic decision for the human

Rung 3 of the ladder — the glue that ties a detailed layer to an abstract one — is now prototyped in
`analyse`, over constructs that already existed (`contract`, `satisfies`) but were parsed and never
checked. This note records what it does and flags the one decision that is the human's: what `satisfies`
should mean.

## What shipped (analysis only, no new construct)

`component X satisfies (_ : C)` now triggers a refinement check. For each promise the contract `C` makes
(its `guarantee`/`invariant`/`axiom` items), the checker asks whether X's own invariants ENTAIL that
promise, by testing `X_invariants ∧ ¬promise` for unsatisfiability with the boolean engine. If every
promise is entailed, X SATISFIES C. If one is not, refinement fails and the unentailed promise is named.

Worked example (`refinement_correct.allium`): an abstract `contract Settlement` promises
`settled implies funded`. The detailed `component SettlementImpl satisfies (s : Settlement)` introduces an
intermediate concept, `cash_moved`, and two finer invariants — `settled implies cash_moved` and
`cash_moved implies funded` — whose composition entails the abstract promise. The checker proves it, so
the abstract contract can be trusted without reading the detail. Drop the second invariant and it correctly
reports that the detail no longer guarantees the contract. A dangling `satisfies` names the missing contract.

Validated: correct → SATISFIES, broken → does NOT satisfy (with the promise named), dangling → error;
738 tests pass, no crashes across 313 real specs, no false verdicts (no corpus spec uses `satisfies` yet).

## The decision that is yours: the meaning of `satisfies`

I shipped the *entailment* reading because it is the standard, sound, decidable first meaning, and it is
genuinely useful. But `satisfies` could mean more, and which one you want is a language-design decision,
not mine to settle:

- **Entailment (shipped).** X's stated invariants logically imply C's promises. Cheap, decidable, checks
  the *interface*. It does not check that X's *actions* preserve the promises — that is what the
  preservation/induction suite does separately, on X alone.
- **Behavioural refinement / simulation.** Every behaviour X can exhibit is permitted by C — a stronger,
  richer relation from the model-checking literature (X's state machine refines C's). More faithful to
  "the detail implements the abstraction", and heavier: it needs a mapping between the two layers'
  vocabularies and a simulation check.
- **Vocabulary mapping.** The shipped version assumes X and C share observable names. Real abstraction
  layers rename and combine — the abstract `funded` might be `cash_moved and sec_moved` in the detail.
  A refinement *mapping* (`funded := cash_moved and sec_moved`) would let the layers differ, which is
  where the abstraction ladder earns its keep. This is the natural next increment and it needs a construct.

## Recommendation

Keep the entailment check as the base rung — it is sound and already useful for interface contracts — and
treat the vocabulary mapping as the first extension, because that is what turns `satisfies` from
"same-vocabulary interface entailment" into genuine cross-level refinement, which is the abstraction-ladder
vision. The mapping needs a small new construct, so it is a human decision; the entailment check is not and
is shipped. The heavier simulation semantics can wait until a specimen forces it.
