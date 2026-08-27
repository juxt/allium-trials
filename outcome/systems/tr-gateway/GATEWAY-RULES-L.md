# Trade Repository submission rules (integrator-facing, extended set)

A submitted report is ACCEPTED only if it satisfies every rule below.

## Report fields (booleans; use these exact names)

`action_new`, `action_modify`, `action_correct`, `action_terminate`, `has_uti`,
`has_prior_uti`, `cleared`, `has_ccp_lei`, `clearing_exception`, `intent_to_clear`,
`is_clearing_member`, `asset_rates`, `asset_credit`, `asset_fx`, `asset_equity`,
`has_index_factor`, `has_fx_notional2`, `has_equity_underlier`, `collateralised`,
`has_collateral_code`, `bespoke_collateral`, `uncollateralised`, `has_variation_margin`,
`confirmed`, `has_confirmation_time`, `allocation`, `is_package`, `has_package_id`

## Acceptance rules

1. A new-trade report must carry a UTI.
2. A modification report must carry a prior UTI.
3. A correction report must carry a prior UTI.
4. A termination report must carry a prior UTI.
5. A report cannot be both a new trade and a modification.
6. A report cannot be both a new trade and a correction.
7. A report cannot be both a new trade and a termination.
8. A cleared trade must carry the CCP's LEI.
9. A collateralised trade must carry a collateral portfolio code.
10. The CCP LEI may be populated only on cleared trades.
11. A cleared trade must not be flagged intent-to-clear.
12. A cleared trade must not carry a clearing exception.
13. A clearing exception may be present only on an uncleared trade.
14. A clearing-member report is made on a cleared trade.
15. A report cannot be both rates and credit asset class.
16. A report cannot be both credit and FX asset class.
17. A report cannot be both FX and equity asset class.
18. A credit-derivative report must carry the index factor.
19. A bespoke collateral schedule is a form of collateralisation.
20. An FX report must carry the second-leg notional.
21. An equity report must carry the equity underlier.
22. An uncollateralised trade is not collateralised.
23. An uncollateralised trade carries no variation margin.
24. A bespoke collateral schedule cannot use a collateral portfolio code (that field must be empty).
25. A confirmed report must carry a confirmation timestamp.
26. A cleared trade is confirmed.
27. An allocation must carry a prior UTI.
28. An allocation is not a new-trade report.
29. A package trade must carry a package id.
