# Trial B result — distill → bug detection (ledger)

**Score: 3/3 planted bugs detected.** Model `claude-sonnet-4-6`, 2026-08-26.
Measure: spec-as-oracle (distill the correct code to a spec, then weed each buggy
variant against it). Reproduce: `node outcome/trial-b.mjs`.

| planted bug | detected | weed's finding |
|---|---|---|
| overdraft-in-withdraw | yes | "Withdraw — missing insufficient-funds guard": named the unconditional subtraction, quoted the line, noted `transfer` still checks, tied it to the `NonNegativeBalance` invariant. |
| non-atomic-transfer | yes | "Transfer is not atomic: destination credited before source balance is checked." |
| same-account-allowed | yes | "Transfer: same-account guard absent in code." |

What this shows: distill produced an Allium spec that carried the real invariant
(`NonNegativeBalance { balance >= 0 }`), and the spec then served as an oracle that
located each planted bug precisely and explained it against the spec. This is the
outcome the eval is for — the spec finds the bug — measured, not asserted.

## Caveats (honest)

- **Scorer is crude.** Detection = weed reported a divergence AND its text matched a
  per-bug keyword signal. An LLM judge over the weed report would be fairer and is
  the intended replacement.
- **Spec-as-oracle, not self-detection.** This measures "the spec catches code
  drift". The deeper measure you asked for — distill+analyse of the buggy code
  self-identifying the invariant violation with no separate oracle — needs the v4
  analyse layer (4c). That is where v4 must beat v3.
- **v3 skills, small system, one model, one run.** A real number needs more systems,
  runs, and a v3-vs-v4 arm. This is the first datapoint, and the mechanic is proven.
