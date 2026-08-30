## SME term loan amortisation schedule

This specification describes a routine that produces a period-by-period repayment schedule for a fixed-term SME loan. The schedule uses declining-balance interest, adds a flat monthly service fee, and forces the final period to close the loan exactly.

### Inputs

Three values: the disbursed principal (the amount lent), the annual interest rate expressed as a percentage (for example `12` for 12%), and the term in whole months.

### Rounding convention

All monetary values are rounded to two decimal places using banker's rounding (round half to even). Concretely, take the value, render it to its ordinary decimal string, then quantise to two places with ROUND_HALF_EVEN. Ties land on the nearest even digit (2.125 → 2.12, 2.135 → 2.14). This rounding is applied at every step described below, not just to the final output; intermediate balances and part-payments are re-rounded as they are computed, and later periods see the already-rounded balance. Getting this ordering right is load-bearing, because rounding residue accumulates into the final period.

### Derived constants

Compute two quantities once, up front.

The **monthly rate factor** is the annual percentage divided by 1200. This folds together the conversion from percent (divide by 100) and from annual to monthly (divide by 12). A 12% annual rate gives a monthly factor of 0.01.

The **service fee** is 0.25% of the original disbursed principal, that is the disbursed amount multiplied by 0.0025, rounded to two places. It is computed from the original principal, fixed for the life of the loan, and charged identically in every period. It is never recomputed against the declining balance.

### Base instalment

The base instalment is the level payment that would amortise the principal over the term, excluding the service fee.

If the monthly rate factor is exactly zero (a zero-interest loan), the base instalment is the principal divided by the number of months.

Otherwise it is the standard annuity payment:

```
base_emi = P * f * (1 + f)^n / ((1 + f)^n - 1)
```

where `P` is the disbursed principal, `f` the monthly rate factor, and `n` the number of months.

Round the base instalment to two places. Use this single rounded figure for every non-final period.

### Period loop

Track a running outstanding balance, starting at the full disbursed principal. Iterate once per month. For each period, in order:

1. **Pure interest** for the period is the current outstanding balance multiplied by the monthly rate factor, rounded to two places. It is charged on the declining balance, so it falls over the life of the loan.

2. **Principal repaid and base instalment** depend on whether this is the final period.

   For every period except the last: the principal repaid is the base instalment minus the pure interest, rounded to two places. The base instalment for the period is the level base instalment computed above. (Note the fee plays no part in the principal split; principal is base instalment minus *pure* interest only.)

   For the final period: the principal repaid is set equal to the entire remaining outstanding balance, so the loan closes to exactly zero. The base instalment for that period is then the pure interest plus that principal, rounded to two places. This is what absorbs all accumulated rounding residue; the last base instalment will differ slightly from the others.

3. **Reported interest line** is the pure interest plus the service fee, rounded to two places. The customer-facing interest figure therefore includes the fee, not just the time-value interest.

4. **Reported instalment (the "emi" field)** is the base instalment for the period plus the service fee, rounded to two places. This is what the customer actually pays each month.

5. **Outstanding at period start** is the current balance, rounded to two places, recorded before any reduction.

After recording the period, reduce the outstanding balance by the principal repaid and round the result to two places. The next period's interest is computed against this rounded balance.

### Output

Return one record per month, in chronological order. Each record carries four fields: the reported instalment (`emi`), the reported interest line (`interest`, inclusive of the fee), the principal repaid in that period (`principal`), and the outstanding balance at the start of the period (`outstanding_start`). All four are two-decimal values.

### Behaviour worth checking

The service fee appears twice in each row's economics: once folded into the reported interest line and once folded into the reported instalment, but never inside the principal calculation. The sum of principal repaid across all periods equals the original disbursed principal exactly, because the final period is defined to clear whatever balance remains. Pure interest declines month on month while the fee stays flat, so the reported interest line falls more slowly than the underlying interest does.