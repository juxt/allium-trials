**SME Term Loan Amortisation Specification**

**Overview**

The loan amortises using declining-balance interest with a fixed monthly service fee layered on top. All intermediate and reported amounts are rounded to 2 decimal places using HALF_EVEN rounding.

**Inputs**

- Disbursed principal amount
- Annual interest rate (as a percentage)
- Loan term in months

**Fixed calculations**

Monthly interest factor: f = annual_rate_pct / 1200.

Fixed monthly service fee: 0.25% of the original disbursed principal, calculated once and applied in every period. Fee = disbursed × 0.0025, rounded to 2dp.

Base EMI (before fee): 
- If annual rate is zero: base_emi = disbursed / months, rounded to 2dp.
- If annual rate is non-zero: base_emi = disbursed × f × (1 + f)^months / ((1 + f)^months − 1), rounded to 2dp.

**Per-period schedule**

For periods 1 through months−1:
- Pure interest = outstanding balance × f, rounded to 2dp.
- Principal repaid = base_emi − pure interest, rounded to 2dp.
- Interest reported to customer = pure interest + service fee, rounded to 2dp.
- EMI paid by customer = base_emi + service fee, rounded to 2dp.
- New outstanding balance = previous balance − principal repaid, rounded to 2dp.

For period months (final):
- Pure interest = outstanding balance × f, rounded to 2dp.
- Principal repaid = outstanding balance (absorbs all residual to close the loan exactly).
- Interest reported to customer = pure interest + service fee, rounded to 2dp.
- EMI paid by customer = pure interest + principal + service fee, rounded to 2dp.
- New outstanding balance = 0.

**Key properties**

The service fee is added to both the interest line and the EMI paid, but does not affect the principal calculation. The final period uses the remaining balance as its principal amount, ensuring complete repayment with no trailing residual.