# SME term loan repayment schedule specification

## Purpose and inputs

The system computes a period-by-period repayment schedule for a fixed-term SME loan that carries both interest and a flat service fee. It takes three inputs: the disbursed principal (the amount lent), the annual interest rate expressed as a percentage (for example `12.0` meaning twelve percent), and the term in whole months. It returns an ordered list with one entry per month.

## Rounding convention

All monetary rounding uses banker's rounding: round half to even, to two decimal places. Concretely, a value is converted to its string form, then quantised to two decimals with ROUND_HALF_EVEN. The half-to-even rule matters at exact half-cent boundaries: `0.125` rounds to `0.12`, `0.135` rounds to `0.14`. This convention must be applied at every rounding point named below; do not substitute round-half-up. Read "round" throughout this spec as this two-decimal half-even operation.

## Derived constants

Two quantities are fixed for the whole schedule before iteration begins.

The **monthly interest factor** `f` is the annual rate percentage divided by 1200. This folds together the conversion from percent to fraction (divide by 100) and from annual to monthly (divide by 12). It is kept at full floating-point precision and is not rounded.

The **service fee** is a flat monthly charge equal to 0.25% of the original disbursed principal, that is, the disbursed amount multiplied by `0.0025`, then rounded. Note carefully: the fee is computed once from the ORIGINAL principal and is identical in every period. It does not decline with the balance and is never recomputed.

## Base instalment (EMI before fee)

A base equated monthly instalment is computed from principal, factor and term, independent of the fee.

If the monthly factor is exactly zero (a zero-rate loan), the base instalment is simply the principal divided by the number of months.

Otherwise the standard amortisation formula applies: base instalment equals `P * f * (1 + f)^n / ((1 + f)^n − 1)`, where `P` is the disbursed principal, `f` the monthly factor and `n` the term in months. This uses the full-precision factor. After computing it, round the base instalment to two decimals. This single rounded base instalment value is reused for every non-final period.

## Period iteration

Maintain a running balance, starting at the full disbursed principal. Iterate once per month, from the first period to the last. For each period, record the balance at the START of that period (rounded) as the outstanding-start figure, then compute the following.

**Pure interest** for the period is the current running balance multiplied by the monthly factor, then rounded. This is declining-balance interest: it falls as the balance is paid down. The fee is not part of this figure.

**Principal repaid** and the **base instalment** depend on whether this is the final period.

For every period except the last, the principal repaid is the base instalment minus the pure interest, rounded. The base instalment for the period is the precomputed base EMI.

For the final period, the schedule forces the loan to close exactly. The principal repaid is set to the entire remaining balance, no more and no less, so that the balance reaches zero. The base instalment for that period is then the pure interest plus that residual principal, rounded, rather than the standard EMI. This absorbs any accumulated rounding drift into the last payment.

## Reported fields

Each period entry reports four values, all rounded to two decimals.

The **outstanding_start** is the running balance at the start of the period.

The **principal** is the principal-repaid figure described above.

The **interest** line reported to the customer is the pure interest PLUS the service fee. That is, the fee is bundled into the reported interest line, not shown separately. This is the sum of pure interest and fee, rounded.

The **emi** field, meaning what the customer actually pays that period, is the base instalment PLUS the service fee, rounded. In non-final periods this is base EMI plus fee; in the final period it is (pure interest + residual principal + fee).

## Balance update

After recording the entry, reduce the running balance by the principal repaid for that period, and round the new balance to two decimals. Carry this rounded balance into the next period. Because the final period's principal equals the whole remaining balance, the balance closes at exactly zero after the last iteration.

## Load-bearing points to preserve

Four conventions are non-default and easy to get wrong. First, the service fee is on TOP of the amortisation: it never enters the principal-versus-interest split, only the two reported totals. Second, the principal split uses PURE interest (`base_emi − pure_int`), not the fee-inclusive interest line. Third, the reported "interest" and "emi" fields are both fee-inclusive, so a consumer summing reported interest across periods will see term times the fee more than the true interest cost. Fourth, the final period is special-cased twice over: its principal is the residual balance and its base instalment is rebuilt from that residual, both before the fee is added.