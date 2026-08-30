-- allium: 4
--
-- SME term loan schedule (declining-balance) with a flat monthly service fee.
-- Load-bearing numeric conventions, in order of subtlety:
--   * monthly factor f = annual_rate_pct / 1200
--   * every money value is rounded to 2dp with banker's rounding (HALF_EVEN)
--   * service fee is FLAT: 0.25% of the ORIGINAL disbursed principal, on EVERY period
--   * the fee sits ON TOP of the amortising instalment; it never enters the
--     principal split or the interest-vs-principal calculation
--   * the reported "interest" line = pure interest + fee
--   * the reported "emi" (what the customer pays) = base instalment + fee
--   * the final period absorbs the residual so principal repays exactly to zero

component sme_term_loan

entity loan
  disbursed         -- original principal disbursed
  annual_rate_pct   -- nominal annual rate, percent
  months            -- number of monthly payments (>= 1)

entity period
  belongs to loan
  index                          -- 0-based, ranges 0 .. loan.months - 1
  observable outstanding_start   -- balance at start of period, r2
  observable pure_interest       -- declining-balance interest only, r2
  observable principal           -- principal component of the payment, r2
  observable interest            -- reported interest line = pure_interest + fee
  observable emi                 -- reported customer payment = base instalment + fee

-- r2: quantise to 0.01 using ROUND_HALF_EVEN (banker's rounding).
-- This exact rounding is applied at every step below and is load-bearing;
-- results differ from HALF_UP on .xx5 ties and from unrounded chaining.
given r2(x) means banker_round(x, 2)

-- Monthly interest factor. Note the /1200 (per-cent AND per-annum in one step).
given monthly_factor(annual_rate_pct) means annual_rate_pct / 1200

-- Flat service fee: 0.25% of the ORIGINAL disbursed amount, rounded once.
-- It does not shrink as the balance amortises; the same fee is added every period.
given service_fee(disbursed) means r2(disbursed * 0.0025)

-- Base equated monthly instalment (fee-exclusive), computed once then rounded.
-- Zero-rate loans fall back to straight-line principal.
given base_emi(disbursed, annual_rate_pct, months) means
  let f = monthly_factor(annual_rate_pct) in
    if f == 0
      then r2(disbursed / months)
      else r2(disbursed * f * (1 + f) ^ months / ((1 + f) ^ months - 1))

-- There are exactly `months` periods per loan, indices 0 .. months-1.
invariant period_count
  every loan :: (count period :: period.loan == loan) == loan.months

-- The first period opens at the full disbursed principal.
invariant opening_balance
  every period :: period.index == 0 implies
    period.outstanding_start == period.loan.disbursed

-- Balance recurrence: next opens at this period's close, re-rounded to 2dp.
invariant balance_rolls_forward
  follows(next, period) ::
    next.outstanding_start == r2(period.outstanding_start - period.principal)

-- Pure interest on the current balance, rounded before use.
invariant pure_interest_calc
  every period ::
    period.pure_interest ==
      r2(period.outstanding_start * monthly_factor(period.loan.annual_rate_pct))

-- Non-final periods: principal = base_emi - pure interest (fee excluded from the split).
invariant principal_non_final
  every period :: period.index < period.loan.months - 1 implies
    period.principal ==
      r2(base_emi(period.loan.disbursed, period.loan.annual_rate_pct, period.loan.months)
         - period.pure_interest)

-- Final period: principal is the entire remaining balance, so the loan closes exactly.
invariant principal_final
  every period :: period.index == period.loan.months - 1 implies
    period.principal == period.outstanding_start

-- Loan repays to zero after the final principal is applied.
invariant closes_exactly
  every period :: period.index == period.loan.months - 1 implies
    r2(period.outstanding_start - period.principal) == 0

-- Reported interest line = pure interest + flat fee (every period).
invariant reported_interest
  every period ::
    period.interest == r2(period.pure_interest + service_fee(period.loan.disbursed))

-- Reported emi, non-final: base instalment (= base_emi) + fee.
invariant reported_emi_non_final
  every period :: period.index < period.loan.months - 1 implies
    period.emi ==
      r2(base_emi(period.loan.disbursed, period.loan.annual_rate_pct, period.loan.months)
         + service_fee(period.loan.disbursed))

-- Reported emi, final: the base instalment is the closing amount r2(pure_interest + principal),
-- and the fee is added on top of that (note the nested rounding).
invariant reported_emi_final
  every period :: period.index == period.loan.months - 1 implies
    period.emi ==
      r2(r2(period.pure_interest + period.principal)
         + service_fee(period.loan.disbursed))

end
