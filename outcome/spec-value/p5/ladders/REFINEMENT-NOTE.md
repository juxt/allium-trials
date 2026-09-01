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

## Update: vocabulary mapping needs no new construct

The note first assumed cross-vocabulary refinement would need a new mapping construct. It does not. A
detailed component bridges the abstract vocabulary with an ordinary `given` definition — the abstract
`funded` is `given funded(t) means cash_moved(t) and sec_moved(t)` in detail terms — and refinement inlines
those definitions into each promise before the entailment check. So the abstract and detailed layers can
use different words, bridged by definitions the detail already provides, with no syntax added. Shipped and
tested (`refinement_vocab_mapping.allium`: `funded := cash_moved and sec_moved`, proved; drop a leg, fails).

That changes the picture. The abstraction ladder is now largely delivered without any new construct:

- **Layers**: `contract` + `component` (existing).
- **Refinement**: entailment, checked at the tier each promise needs — boolean via SAT, linear via the
  simplex (shipped).
- **Cross-vocabulary**: `given` mapping, inlined (shipped).
- **Multi-level**: chains — a component both satisfies a higher contract and serves as the contract for a
  lower one (`three_level.allium` proves both links).

## What remains a human decision

Only the deeper *semantics* choice is still yours, and it is now optional rather than blocking:

- **Behavioural refinement / simulation.** The shipped reading checks that the detail's stated invariants
  *entail* the abstract promises. It does not check that the detail's *state machine* refines the
  abstract one (every behaviour the detail can exhibit is permitted by the abstraction). That richer
  relation is heavier and would be worth adding only when a specimen needs it. It is a genuine construct-
  and-semantics decision, so it waits for you; nothing built so far depends on it.

## Recommendation

The entailment reading, across both tiers and across vocabularies, covers the abstraction-ladder use we
have. Ship it as the meaning of `satisfies`, and defer behavioural simulation until a specimen forces it.
