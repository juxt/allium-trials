# SME term loan schedule — behavioural specification

## Purpose

Produce a period-by-period repayment schedule for a fixed-term SME loan that carries a declining-balance interest charge plus a flat monthly service fee. Given the disbursed principal, an annual interest rate, and a term in whole months, the routine returns one row per month describing what the customer pays, how that payment splits between interest and principal, and the balance outstanding at the start of the period.

## Inputs

Three inputs: the disbursed principal (the amount actually advanced), the annual interest rate expressed as a percentage (for example, 12 means 12% per annum), and the term as a whole number of months.

## Numeric conventions

All monetary values are rounded to two decimal places using banker's rounding, HALF_EVEN: ties round to the nearest even last digit rather than always up. Apply this rounding by converting the value to its string form first, then quantising to two places, so the rounding acts on the decimal value as written rather than on a binary approximation. Call this operation "round-2" below. Every stored or reported money figure passes through round-2 at the point stated; intermediate factors (the monthly rate, the compounding term) are held at full precision until a money figure is formed.

**Monthly interest factor.** Derive a monthly factor `f` by dividing the annual percentage rate by 1200. This folds together the conversion from percent to fraction (divide by 100) and from annual to monthly (divide by 12). Hold `f` at full floating-point precision; do not round it.

**Service fee.** Compute a flat monthly service fee once, up front, as 0.25% of the original disbursed principal (multiply the disbursed amount by 0.0025), then round-2. This fee is a constant: the same amount is added to every period regardless of the declining balance. It is computed from the original disbursement, never from the running balance.

## Base instalment (before fee)

Compute a base instalment that would amortise the principal over the term using standard declining-balance amortisation, ignoring the service fee entirely.

If the monthly factor is exactly zero (a zero interest rate), the base instalment is simply the principal divided by the number of months.

Otherwise, use the annuity formula: `principal × f × (1+f)^months ÷ ((1+f)^months − 1)`.

Round-2 the resulting base instalment and hold it fixed for use in every non-final period.

## Period loop

Maintain a running balance, starting at the full disbursed principal. Iterate once per month, in order. For each period:

1. **Pure interest** on the current balance: multiply the balance by `f`, then round-2. This is the interest actually earned this period on the declining balance. It excludes the service fee.

2. **Principal repaid and base instalment**, split by whether this is the final period:
   - For every period except the last: the principal repaid is the base instalment minus the pure interest, rounded-2. The base instalment for the period is the fixed base instalment computed above.
   - For the final period: the principal repaid is the entire remaining balance (so the loan closes to exactly zero with no residual left over). The base instalment for this period is recomputed as pure interest plus that principal, rounded-2, so the final base instalment absorbs any accumulated rounding residual rather than carrying it forward.

3. **Reported interest line**: pure interest plus the service fee, rounded-2. The fee is reported as part of the interest line, not as a separate field.

4. **Reported instalment (the `emi` the customer pays)**: the period's base instalment plus the service fee, rounded-2. The fee sits on top of the amortising instalment; it is not part of the principal calculation.

5. **Emit the row** with four fields: the reported instalment (`emi`), the reported interest line (`interest`), the principal repaid (`principal`), and the balance at the start of the period (`outstanding_start`, the current running balance rounded-2).

6. **Advance the balance**: subtract the principal repaid from the running balance and round-2. Carry this forward to the next period.

## Load-bearing points that are easy to get wrong

The service fee is a fixed amount added on top of, and outside of, the amortisation. It never enters the principal-versus-interest split: principal is always `base instalment − pure interest`, using the fee-free base instalment. The fee only ever appears by being added into the reported interest line and the reported instalment.

The pure interest is charged on the running declining balance, not on the original principal. The base instalment is fixed for all periods except the last.

The final period is special in two ways at once: its principal is set to the whole remaining balance (not the formula split), and its base instalment is rebuilt as interest-plus-principal so the loan repays exactly and any rounding drift is absorbed there. After the final period the balance should be zero.

Rounding is HALF_EVEN to two places, applied via the string-then-quantise route, at each of these points: the fee, the base instalment, each period's pure interest, each non-final principal, the final base instalment, the reported interest line, the reported instalment, the start-of-period balance, and the balance carried to the next period.