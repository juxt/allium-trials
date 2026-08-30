# SME Term Loan Specification

## Loan structure

Loans are repaid in equal monthly instalments over a fixed term. All monetary amounts are rounded to 2 decimal places using ROUND_HALF_EVEN (round half to even) at each calculation step.

## Interest calculation

Interest accrues on a declining balance at a monthly rate equal to the annual rate divided by 1200. For a zero-interest loan, this month's interest is zero; otherwise, each month's pure interest is the outstanding balance multiplied by the monthly factor, rounded to 2dp.

## Service fee

A flat monthly service fee is charged, calculated once at the start as 0.25% of the original disbursed principal, rounded to 2dp. This fee is added to every period and reported as part of the interest line but does not reduce the principal owed.

## Instalment calculation

If the annual rate is zero, the base instalment is the disbursed principal divided by the number of months. Otherwise, the base instalment uses the standard declining-balance formula:

```
base_emi = P × f × (1+f)^n / ((1+f)^n − 1)
```

where P is disbursed principal, f is the monthly factor, and n is the number of months. The base instalment is rounded to 2dp and held constant across all periods except the final one.

## Period amortisation (regular periods)

For each period except the last:

1. Pure interest = outstanding balance × monthly factor, rounded to 2dp.
2. Principal payment = base instalment − pure interest, rounded to 2dp.
3. Interest line (reported) = pure interest + service fee, rounded to 2dp.
4. EMI (reported, customer payment) = base instalment + service fee, rounded to 2dp.
5. Outstanding balance reduces by the principal payment amount.

## Final period (residual handling)

In the final period, the principal payment equals the remaining outstanding balance (absorbing all rounding residual), ensuring the loan closes precisely. The base instalment for this period is pure interest plus this final principal. The interest line and EMI are calculated as above: interest line = pure interest + fee; EMI = (pure interest + final principal) + fee.

Each line reports: outstanding balance at period start, EMI paid, interest (including fee) charged, and principal repaid.