# What the verification suite finds across the whole v4 corpus

A systematic run of `allium analyse` over all 316 v4 specs in the repository, to see what the safety and
refinement suite surfaces at scale and, more importantly, whether it stays silent where it should.

## Soundness at scale: it fires only on specs built to be broken

The suite produced 20 safety or refinement findings (invariant breaks, reachable violations, dead actions,
failed refinements). Every one is in a spec I authored to be broken — the `*_bad`, `*_bug`, `proto`,
`quant`, `refinement_broken` fixtures in `capability-gaps/` and `ladders/`. Not one fires on a genuine,
non-fixture spec. The 31 INDUCTIVE proofs and 5 SATISFIES verdicts likewise land on the intended specs.
This is the zero-false-positive property confirmed across the real corpus, not just the unit tests.

(One finding worth naming: `quant_safe.allium`'s `capture` is reported never-enabled. That is correct —
the fixture has no `authorize` action, so `authed` is never set and the guard can never hold. A true dead
action, found.)

## Where static analysis stops, measured

The coverage report tells us, across the corpus, exactly which invariants the static engines cannot reach
and why:

```
specs with linear-arithmetic invariants   80
specs with boolean invariants             56
specs with a NOT-statically-checked one   21

reasons static analysis stops:
  product of two unknowns   14   (interest = rate x balance, and kin)
  existential quantifier     7
  division by an unknown     1
```

The dominant boundary is a single shape: a product of two unknowns, overwhelmingly the interest law
`rate x balance`. That is the known nonlinear limit, and it is precisely the case the runtime `monitor`
covers by checking the law against real traces. So the two halves of the tool divide the corpus cleanly:
static proof for the boolean and linear invariants (the large majority), runtime checking for the handful
of genuinely nonlinear ones, and the coverage report says which is which for every spec rather than
skipping silently.

## Verdict distribution

```
INDUCTIVE proofs            31
SATISFIES contract           5
SAFE by k-induction          1
(deliberate-fixture) breaks  9 invariant + 1 arithmetic + 1 relational
(deliberate-fixture) traces  7 reachable violations
(deliberate-fixture) other   1 dead action + 1 failed refinement
```

## Re-run after the refinement and transition-invariant additions

Repeating the sweep with the fuller suite (finality, assume-guarantee, refinement across vocabularies and
levels) over 319 v4 specs holds the same shape: 32 INDUCTIVE proofs, 6 SATISFIES verdicts, 1 conditional
(assume-guarantee) satisfaction, and again zero findings on any genuine, non-fixture spec. Every break,
reachable violation, dead action, and failed refinement is in a spec authored to be broken. The
soundness-at-scale property survives each capability added.

## Reading

The sweep is the honest, corpus-scale version of the per-example validation. It shows the suite is sound
where it matters (silent on every real spec, loud only on the broken fixtures), it quantifies the static
reach on real material (most invariants are within the boolean or linear rungs; the nonlinear tail is
small and named), and it confirms the division of labour the two-ladder framework predicts: the cheapest
adequate engine per invariant, the runtime monitor for the genuinely nonlinear remainder, and a coverage
report that never hides which is which.

## Reproduce

The sweep is a short script over `outcome/**/*.allium` and `~/code/allium/**/*.allium` filtered to
`-- allium: 4`, running `allium analyse` and tallying the coverage lines and verdicts.
