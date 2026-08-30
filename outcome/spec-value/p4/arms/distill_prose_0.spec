## SME Term Loan Specification

A declining-balance loan with interest calculated on outstanding balance, a flat monthly service fee, and final-period residual absorption to close the loan exactly.

**Loan parameters:** principal P (disbursed), annual interest rate r (%), term n months.

**Constants:**
- Monthly interest factor: f = r / 1200
- Monthly service fee: S = 0.0025 × P (calculated once, independent of balance, added to every period's payment)

**Base EMI calculation (fixed instalment amount before final-period adjustment):**
- If r = 0: base_emi = P / n
- Otherwise: base_emi = P × f × (1 + f)^n / ((1 + f)^n − 1)
- Round to 2 decimal places using ROUND_HALF_EVEN.

**Amortisation schedule:**

For each month i = 1 to n, with outstanding balance B (initially = P):

1. Interest accrual: I = B × f. Round to 2 decimal places using ROUND_HALF_EVEN.

2. Principal repayment:
   - Final month (i = n): principal = B (absorb entire remaining balance to close the loan)
   - Other months: principal = base_emi − I. Round to 2 decimal places using ROUND_HALF_EVEN.

3. Reported amounts:
   - Interest charge (to customer) = I + S. Round to 2 decimal places using ROUND_HALF_EVEN.
   - Payment (EMI) = (principal + I) + S. Round to 2 decimal places using ROUND_HALF_EVEN.

4. Update balance: B := B − principal. Round to 2 decimal places using ROUND_HALF_EVEN.

**Output per period:** outstanding_start (balance at start of period), principal (amount repaid), interest (reported charge = pure interest + service fee), emi (total payment = principal + reported interest).

**Rounding:** All calculations use ROUND_HALF_EVEN (banker's rounding) to 2 decimal places at each step: interest calculation, principal determination, balance updates, and reported amounts.