# Second-domain validation: DvP settlement atomicity

To check the inductive/model-checking capability generalises beyond the payment lifecycle, this validates
it on a different banking domain: delivery-versus-payment (DvP) settlement, where the central safety
property is *atomicity* — cash and securities must move together or not at all. All via `allium analyse`,
no model judge.

## The correct spec is certified fully safe

`dvp_correct.allium` models a trade through match → affirm (each leg) → atomic settle (or fail), with six
safety invariants including DvP atomicity (`cash_moved <=> sec_moved`, as two implications), per-leg
affirmation preconditions, and settle-xor-fail. `allium analyse` proves all six **INDUCTIVE** — each
established by `init` and preserved by every action, holding in every reachable state. No breaks, no
reachable violations, no dead actions. A real atomicity safety proof over the settlement state machine.

## Seeded atomicity bugs are caught, with counterexample traces

| bug | preservation | BMC counterexample trace |
|-----|-----|-----|
| non-atomic settle (moves cash only) | breaks `dvp_atomic_cash` (+ fix) | `match_trade -> affirm_cash -> affirm_sec -> settle` |
| settle without securities affirmation | breaks `sec_needs_affirm` (+ fix) | `match_trade -> affirm_cash -> settle` |

The non-atomic bug is the canonical settlement failure — one leg moves while the other does not — and the
checker both proves the design-level break (with a witness pre-state and a suggested guard) and produces
the exact operational sequence that reaches the atomicity violation. Neither has any natural execution
trace in production (the happy path never exhibits them), so `monitor` could not catch them; the transition
reasoning does.

## What this shows

The capability is not specific to the payment-capture example it was built against. On an independently
authored settlement machine with a different invariant shape (atomicity as paired implications), it proves
the correct spec safe and pinpoints realistic bugs. That is the generality a V&V feature needs to be worth
building on.

## Reproduce

```
allium analyse dvp_correct.allium          # 6 invariants INDUCTIVE; no bug
allium analyse dvp_bug_nonatomic.allium    # breaks dvp_atomic_cash; BMC: match->affirm_cash->affirm_sec->settle
allium analyse dvp_bug_unaffirmed.allium   # breaks sec_needs_affirm; BMC: match->affirm_cash->settle
```
