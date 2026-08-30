# Add-on (flat) interest loan schedule

## What this computes

Given a disbursed principal amount, an annual interest rate as a percentage, and a term in whole months, produce a repayment schedule: one row per month, each row carrying the total instalment due, the interest portion, the principal portion, and the outstanding balance at the start of that month.

This is a flat (add-on) interest product. Interest is charged on the original disbursed principal for the whole term, not on the declining balance. This is the load-bearing distinction: the interest total does not depend on how principal is repaid over time.

## Rounding convention

Every monetary figure is rounded to two decimal places using HALF_UP (round half away from zero, so 0.005 becomes 0.01). Round at each step described below, not only at the end. Intermediate quantities that feed a later rounded quantity are themselves already rounded to 2dp before reuse.

## Interest

Compute the total interest for the whole loan up front:

    total_interest = round2( disbursed × (annual_rate_pct / 100) × (months / 12) )

This is the annual rate applied to the full disbursed principal, scaled by the term expressed in years. It is a single figure for the life of the loan, fixed once at origination.

Divide it into an equal per-period interest line:

    per_int = round2( total_interest / months )

Every month except the last charges exactly `per_int` in interest. The last month charges whatever interest remains so the interest lines sum exactly to `total_interest`:

    last_interest = round2( total_interest − per_int × (months − 1) )

The residual from rounding `per_int` is absorbed entirely into the final month. Do not spread it.

## Instalment (EMI)

The equal monthly instalment is the total repayable divided evenly across the term:

    emi = round2( (disbursed + total_interest) / months )

Every month except the last bills exactly this `emi`. In those months the principal portion is the instalment less the interest line:

    principal = round2( emi − per_int )

The last month does not use `emi`. Its principal is the entire outstanding balance still owed at the start of that month, and its instalment is that principal plus the last month's interest:

    last_principal = outstanding balance at start of final month
    last_instalment = round2( last_interest + last_principal )

This guarantees two closure properties: the principal portions sum exactly to `disbursed`, and the instalments sum exactly to `disbursed + total_interest`. Both rounding residuals, on principal and on interest, land in the final row.

## Balance tracking

Track a running balance, starting at the disbursed amount. For each month, before deducting anything:

- record `outstanding_start` as the current balance, rounded to 2dp;
- emit the row (instalment, interest, principal, outstanding_start);
- reduce the balance by that month's principal: `balance = round2( balance − principal )`.

Because the final month's principal is defined as the balance itself, the balance reaches exactly zero after the last row regardless of accumulated rounding drift. Outstanding balance strictly declines each month by the principal repaid; it never reflects interest.

## Row order and count

Emit exactly `months` rows, in chronological order, month 0 through month `months − 1`. Only the last row uses the residual-absorbing branch; all earlier rows are identical in structure (equal instalment, equal interest, equal principal).