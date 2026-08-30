# SME term loan repayment schedule

## Purpose

Given a disbursed loan amount, an annual interest rate, and a term in months, produce a period-by-period repayment schedule. Each row reports what the customer pays that month, how that payment splits between interest and principal, and the balance outstanding at the start of the period.

## Inputs

- `disbursed`: the original principal advanced to the borrower.
- `annual_rate_pct`: the nominal annual interest rate, expressed as a percentage (e.g. `12` means 12%, not 0.12).
- `months`: the number of monthly periods in the term (a positive integer).

## Output

A list of rows, one per month, in chronological order. Each row has four fields:

- `outstanding_start`: the principal balance owed at the start of that period.
- `emi`: the total amount the customer pays that period (the "instalment").
- `interest`: the interest portion of that payment, as reported to the customer.
- `principal`: the principal portion of that payment.

## Numeric conventions

All monetary values in the output, and every intermediate monetary quantity described below, are rounded to two decimal places using banker's rounding (round-half-to-even). Concretely: take the value, quantise to two decimal places with the half-even rule, so a value exactly halfway between two cents rounds to the nearest even cent. Apply this rounding at each step described, not only at the end; intermediate results are carried forward already rounded.

The **monthly interest factor** is `f = annual_rate_pct / 1200`. This is the annual percentage divided by 100 to make it a fraction, then by 12 for the monthly rate, in one step. The factor `f` is used at full precision; do not round it.

## Fixed service fee

There is a flat monthly service fee, the same in every period. It is **0.25% of the original disbursed principal**: `fee = round(disbursed * 0.0025)`. Compute it once from the original disbursement. It does not decline as the balance is paid down, and it is added on top of the loan's own interest and principal, never mixed into the principal calculation.

## Base instalment (before the fee)

First compute the level base instalment that would amortise the loan on a declining balance over the full term, excluding the service fee.

- If `f` is zero (a zero-rate loan), the base instalment is simply `disbursed / months`.
- Otherwise, use the standard annuity formula: `base_emi = disbursed * f * (1 + f)^months / ((1 + f)^months - 1)`.

Round the base instalment to two decimal places once, up front, and use that rounded value for every non-final period.

## Period loop

Track a running balance `bal`, starting at the full `disbursed` amount. For each period `i` from the first (`i = 0`) to the last (`i = months - 1`):

1. **Pure interest** on the current balance: `pure_int = round(bal * f)`. This is the loan interest only, with no fee.

2. **Principal and base instalment**, depending on whether this is the final period:
   - For every period **except the last**: the principal repaid is `principal = round(base_emi - pure_int)`. The base instalment for the period is the level `base_emi`. Note the split subtracts pure interest only; the fee plays no part here.
   - For the **final period** (`i == months - 1`): the principal repaid is the entire remaining balance, `principal = bal`, so the loan closes exactly with no residual left over. The base instalment for that period is `round(pure_int + principal)`, i.e. whatever interest plus the balance closeout comes to, rather than the level `base_emi`.

3. **Reported interest line**: `interest = round(pure_int + fee)`. The customer-facing interest figure bundles the pure loan interest together with the service fee.

4. **Reported instalment (emi)**: `emi = round(base_inst + fee)`, where `base_inst` is the base instalment for this period (the level `base_emi` in normal periods, or the closeout value in the final period). This is the total the customer actually pays: base instalment plus the fee on top.

5. **Record the row** with `outstanding_start = round(bal)` (the balance at the start of the period), and the `emi`, `interest`, and `principal` computed above.

6. **Advance the balance**: `bal = round(bal - principal)`. Because `principal` is already rounded, the balance stays at two decimal places throughout. After the final period the balance reaches exactly zero.

## Notes on behaviour that must be preserved

- The service fee is computed from the **original** disbursed amount and is constant across all periods; it is never recomputed against the declining balance.
- The fee is additive. It appears in both the reported `interest` line and the reported `emi`, but it is deliberately excluded from the principal split, so `principal` reflects only base instalment less pure interest.
- The final period is the residual absorber. Rather than paying the level base instalment, it repays the exact outstanding balance, and its base instalment is derived from that balance plus that period's interest. This guarantees the loan is fully repaid to the cent regardless of accumulated rounding differences in earlier periods.
- Rounding is applied at each intermediate monetary step (fee, base instalment, pure interest, principal, balance update, and each reported field), always half-even to two decimals. Reproducing the exact outputs requires rounding at these same points, not just once at the end.