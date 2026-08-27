# Trial G — integration against a third-party contract

## What it tests

The other half of the design-time-value hypothesis: a third-party library spec giving
integration reassurance. A dealer integrates its swap-reporting system with a Trade
Repository whose acceptance rules are published (`GATEWAY-RULES.md`, formalised as the
pristine axioms in `GATEWAY-CONTRACT.allium`, which the integrator never edits, verified
internally satisfiable).

The integrator declares its report scenarios as `requirement` items. The sound feasibility
check (`allium analyse`) merges them with the contract and, for each requirement, decides
whether any acceptable report satisfies it — flagging infeasible ones with a minimal
blocking-rule core. One brief scenario is EMERGENTLY infeasible: posting bespoke collateral
on collateralised trades cannot be accepted, because rule 7 (collateralised needs a
portfolio code) and rule 8 (bespoke has no code) forbid it together, though no single rule
does. The brief states the business practice plainly, without naming the code field, so
the conflict must be derived.

## Result (baseline, N=8, opus)

    every run: 6 requirements, collateralised_trade infeasible (truth)
    every run: model flagged collateralised_trade   ->   miss-rate 0/8

The checker's verdict is sound, so it catches the infeasibility with certainty. The
unaided model also caught it every time. On a two-rule emergent conflict within a small
contract, a strong model is reliable.

## Reading — this is the sixth saturation, and the pattern is the finding

Across six independent trials — ledger build/comprehension/reimplement (A/C/D),
idempotency integration (E), case-split structure and fidelity (F), and now contract
integration (G) — a strong model, given a well-specified task, essentially never ships a
correctness error that the design-time checker then catches. The one apparent exception
(free-vocabulary Trial F, 3/8) was naming and scoping difficulty that a data dictionary
removes; correctness itself did not fail.

The conclusion is not that the checker is worthless. It is that its value is not a higher
mistake-catch-rate than a strong model on well-specified, small tasks. Two places its
value is real and unmeasured by these trials:

1. **Soundness and auditability.** A regulator or auditor cannot accept "a capable model
   reviewed it"; they can accept a machine-checked verdict with a witness or a blocking
   core. The checker's worth is the GUARANTEE and the artefact, independent of whether a
   model would also have been right. That is the assurance-layer positioning.

2. **Scale beyond reliable reading.** The bounded enumeration is exact but capped at 16
   atoms. Every trial that saturated lived inside that cap, where strong models are
   reliable. The regime where reading plausibly degrades — dozens of interacting rules,
   deep chains — is above the cap and needs the typed/quantified EPR discharge (a Z3-backed
   engine), the real 4c. Whether a non-saturated correctness result exists there is the
   open question the bounded engine cannot answer.

The honest fork: keep hunting for a non-saturated correctness regime (which points to
building the EPR/Z3 backend for scale), or reframe the eval to measure the assurance value
directly (soundness, coverage, a machine-checkable certificate) rather than catch-rate
against a strong model.
