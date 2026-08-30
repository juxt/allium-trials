-- allium: 4
--
-- SME term loan repayment schedule.
-- Declining-balance interest with a flat monthly service fee bolted on top.
-- Several non-default conventions interact; see givens and invariants.

component sme_term_loan

-- The loan being amortised. One loan owns an ordered set of periods.
entity loan
  disbursed          -- original principal actually disbursed
  annual_rate_pct    -- nominal annual interest rate, in percent
  months             -- number of repayment periods (also the period count)

-- One row of the repayment schedule, ordered by index (0-based).
entity period
  index              -- 0-based position within the schedule
  outstanding_start  -- balance at the START of this period
  emi                -- reported instalment the customer pays (base + fee)
  interest           -- reported interest line (pure interest + fee)
  principal          -- principal component repaid this period (fee excluded)

-- Rounding is banker's rounding (HALF_EVEN) to 2 decimal places, applied at
-- every marked step. Intermediate re-rounding is deliberate and load-bearing:
-- fee, base_emi, pure interest, principal, and both reported fields each round.
given r2(x) means round_half_even(x, 2)

-- Monthly interest factor. Note the /1200 (percent AND 12 months in one step).
given monthly_factor(annual_rate_pct) means annual_rate_pct / 1200

-- Flat monthly service fee: 0.25% of the ORIGINAL disbursed principal.
-- Computed once, rounded once, then added to EVERY period unchanged.
given service_fee(disbursed) means r2(disbursed * 0.0025)

-- Pure declining-balance interest on this period's opening balance.
-- The service fee is NOT part of this; it is added separately.
given pure_interest(bal, f) means r2(bal * f)

-- Base EMI, excluding the service fee. Zero-rate loans amortise linearly;
-- otherwise the standard annuity formula. Rounded to 2dp once, up front.
given base_emi(disbursed, f, months) means
  if f == 0
    then r2(disbursed / months)
    else r2(disbursed * f * (1 + f) ^ months / ((1 + f) ^ months - 1))

-- Base instalment for a single period (fee still excluded).
-- The final period ignores the annuity EMI and instead closes the loan:
-- it pays this period's pure interest plus the whole remaining balance.
given base_instalment(bal, base, f, is_final) means
  if is_final
    then r2(pure_interest(bal, f) + bal)
    else base

-- Principal component for a single period (fee excluded, as principal is
-- computed against PURE interest only). The final period absorbs the residual
-- by repaying the entire remaining balance, so principal closes exactly.
given principal_part(bal, base, f, is_final) means
  if is_final
    then bal
    else r2(base - pure_interest(bal, f))

-- The schedule has exactly one row per month.
invariant schedule_length:
  count(period) == loan.months

-- The first period opens at the full disbursed amount.
invariant opens_at_disbursed:
  every period p ::
    if p.index == 0 then p.outstanding_start == loan.disbursed else true

-- Balance rolls forward: each period's opening balance is the previous
-- opening balance minus the previous principal, re-rounded to 2dp.
invariant balance_rolls_forward:
  follows(next, p) ::
    next.outstanding_start == r2(p.outstanding_start - p.principal)

-- Principal repaid each period (final period takes the whole remaining balance).
invariant principal_split:
  every period p ::
    p.principal == principal_part(
      p.outstanding_start,
      base_emi(loan.disbursed, monthly_factor(loan.annual_rate_pct), loan.months),
      monthly_factor(loan.annual_rate_pct),
      p.index == loan.months - 1)

-- Reported interest line = pure interest on the opening balance + service fee.
invariant reported_interest:
  every period p ::
    p.interest == r2(
      pure_interest(p.outstanding_start, monthly_factor(loan.annual_rate_pct))
        + service_fee(loan.disbursed))

-- Reported instalment = base instalment + service fee (final period's base
-- instalment is the loan-closing amount, not the annuity EMI).
invariant reported_emi:
  every period p ::
    p.emi == r2(
      base_instalment(
        p.outstanding_start,
        base_emi(loan.disbursed, monthly_factor(loan.annual_rate_pct), loan.months),
        monthly_factor(loan.annual_rate_pct),
        p.index == loan.months - 1)
      + service_fee(loan.disbursed))

-- The principal components sum to exactly the disbursed amount: the final
-- period's residual absorption guarantees the loan closes with zero balance.
invariant principal_closes_loan:
  sum period p :: p.principal == loan.disbursed

end
