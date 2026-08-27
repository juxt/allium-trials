# Trade Repository submission rules (integrator-facing)

A submitted report is ACCEPTED only if it satisfies every rule below. These are the
repository's published validation rules; you integrate against them.

## Report fields (booleans; use these exact names in your spec)

- `action_new` — action type is NEWT (a new trade)
- `action_modify` — action type is MODI (a modification)
- `has_uti` — the report carries a UTI
- `has_prior_uti` — the report carries a prior UTI
- `cleared` — the trade is cleared through a CCP
- `has_ccp_lei` — the report carries the CCP's LEI
- `intent_to_clear` — the report is flagged intent-to-clear
- `collateralised` — the trade is collateralised
- `has_collateral_code` — the report carries a collateral portfolio code
- `bespoke_collateral` — the trade uses a bespoke collateral schedule
- `credit_derivative` — the product is a credit derivative
- `has_index_factor` — the report carries the index factor
- `confirmed` — the trade is electronically confirmed
- `has_confirmation_time` — the report carries a confirmation timestamp
- `allocation` — the report is a post-trade allocation

## Acceptance rules

1. A new-trade report must carry a UTI.
2. A modification report must carry a prior UTI.
3. A report cannot be both a new trade and a modification.
4. A cleared trade must carry the CCP's LEI.
5. The CCP LEI may be populated only on cleared trades.
6. A cleared trade must not be flagged intent-to-clear.
7. A collateralised trade must carry a collateral portfolio code.
8. A bespoke collateral schedule cannot use a collateral portfolio code (that field must be empty).
9. A credit-derivative report must carry the index factor.
10. A confirmed report must carry a confirmation timestamp.
11. An allocation must carry a prior UTI.
12. An allocation is not a new-trade report.
