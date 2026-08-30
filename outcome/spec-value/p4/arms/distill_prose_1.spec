# Add-on (flat) interest consumer loan — schedule specification

## Purpose

Given a disbursed principal, an annual interest rate, and a term in whole months, produce a repayment schedule: one row per month, each carrying the instalment amount, its interest and principal components, and the outstanding balance at the start of the period. This is a **flat (add-on)** interest product: total interest is computed once on the original principal and does not reduce as the balance is paid down.

## Inputs

- `disbursed`: the principal advanced to the borrower.
- `annual_rate_pct`: the nominal annual interest rate expressed as a percentage (e.g. `12` means 12%, not `0.12`).
- `months`: the number of repayment periods, a positive whole number. Periods are equal monthly instalments.

## Rounding convention

Every monetary value in the schedule is rounded to 2 decimal places using **half-up** rounding (a value exactly halfway between two 2dp candidates rounds away from zero). Rounding is applied by converting the number to its decimal representation first, then quantising to two places. This rounding is applied at each of the specific points named below; do not defer rounding to the end, and do not round intermediate multiplications beyond what is stated.

## Derived totals (computed once, before building rows)

1. **Total interest.** Multiply the disbursed principal by the annual rate as a fraction (`annual_rate_pct / 100`) and by the term in years (`months / 12`). Round the result to 2dp. This is the entire interest charge for the loan, computed on the original principal — it is **not** recomputed against a declining balance.

   `total_interest = round2( disbursed × (annual_rate_pct / 100) × (months / 12) )`

2. **Per-period interest line.** Divide the total interest by the number of months and round to 2dp. Every period except the last carries exactly this interest amount.

   `per_int = round2( total_interest / months )`

3. **Equal monthly instalment (EMI).** Divide the sum of disbursed principal and total interest by the number of months, and round to 2dp. Every period except the last has an instalment equal to this figure.

   `emi = round2( (disbursed + total_interest) / months )`

## Building the schedule

Maintain a running balance `bal`, initialised to `disbursed`. Iterate over the periods in order, index `i` from `0` to `months − 1`. For each period, first record the outstanding balance at the start of the period, then determine its interest, principal, and instalment, then reduce the balance.

**Every period except the last** (`i < months − 1`):

- `interest` = `per_int` (the fixed per-period interest line).
- `principal` = `round2( emi − interest )`.
- `instalment` = `emi` (the fixed EMI).

**The last period** (`i == months − 1`) absorbs all residuals so the schedule totals reconcile exactly:

- `interest` = `round2( total_interest − per_int × (months − 1) )`. This is the total interest minus the sum of all earlier interest lines, so the interest column sums exactly to `total_interest`.
- `principal` = the entire remaining balance `bal` (used as-is; it is already a rounded running value). This forces the principal column to sum exactly to `disbursed`.
- `instalment` = `round2( interest + principal )`. The final instalment may differ from the EMI.

For each period, the row records four fields: the instalment (`emi`), the `interest`, the `principal`, and `outstanding_start` = `round2(bal)` captured before the balance is reduced.

After emitting the row, reduce the balance: `bal = round2( bal − principal )`.

## Invariants the output must satisfy

- The `outstanding_start` of the first period equals `disbursed`.
- The sum of all `principal` amounts equals `disbursed` exactly.
- The sum of all `interest` amounts equals `total_interest` exactly.
- The sum of all instalments equals `disbursed + total_interest`.
- The outstanding balance declines only by the principal component each period; the interest charge does not depend on the outstanding balance (this is what distinguishes flat/add-on interest from a reducing-balance product).
- All but the final instalment are identical and equal to the EMI; the final instalment carries whatever rounding residual remains in both the interest and principal columns.