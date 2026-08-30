# Flat (add-on) interest loan schedule

This specifies the repayment schedule for a flat-rate, or add-on, consumer loan. Interest is charged on the original principal for the whole term rather than on the declining balance, so the schedule cannot be derived from an amortising formula. Every monetary quantity is rounded half-up to two decimal places at the point it is computed, and the final period absorbs whatever residual the rounding leaves behind.

## Inputs

Three values define a schedule: the disbursed principal, the annual interest rate as a percentage (for example, 12 for 12%), and the term as a whole number of months. The schedule has exactly one row per month.

## The three headline figures

Compute these once, before building any rows.

Total interest is the flat charge on the original principal across the full term: the disbursed amount multiplied by the annual rate expressed as a fraction, multiplied by the term in years. That is, `disbursed × (annual_rate_pct / 100) × (months / 12)`, then rounded to two decimals. Note that it is charged on the disbursed principal and never on the outstanding balance, which is what makes this a flat product.

The per-period interest line is the total interest spread evenly: total interest divided by the number of months, rounded to two decimals. Every period except the last carries exactly this interest amount.

The instalment (EMI) is the total repayable spread evenly: `(disbursed + total_interest) / months`, rounded to two decimals. Every period except the last is billed exactly this instalment.

## Building the rows

Carry a running balance, starting at the disbursed principal. Walk the months in order. Each row records four fields: the instalment, the interest portion, the principal portion, and the outstanding balance at the start of the period (the running balance rounded to two decimals).

For every period other than the last:

- Interest is the per-period interest line computed above.
- Principal is the instalment minus that interest, rounded to two decimals.
- The instalment billed is the flat EMI.

After recording the row, reduce the running balance by that period's principal and round to two decimals.

## The last period absorbs the residual

The final period is not billed the standard figures. Because each earlier period rounded independently, the accumulated interest and principal will not tie back exactly to the totals, so the last period is computed to close both gaps.

Its interest is whatever remains of the total interest after the earlier periods have each taken one per-period line: `total_interest − per_int × (months − 1)`, rounded to two decimals. Its principal is the entire remaining balance, so that the sum of all principal portions equals the disbursed amount exactly. Its instalment is the sum of that interest and that principal, rounded to two decimals; it will generally differ from the flat EMI charged in earlier periods.

## Invariants

Across the whole schedule, the principal portions sum to the disbursed principal, and the instalments sum to the disbursed principal plus the total interest. The outstanding-start balance declines by each period's principal and reaches zero after the last period. Any drift introduced by per-period rounding is corrected in the final row alone, never redistributed across the schedule.