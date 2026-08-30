-- allium: 4

component sme_term_loan

-- A fixed-rate SME term loan repaid over `months` equal periods.
-- Interest is declining-balance. A flat service fee, fixed as a fraction of the
-- ORIGINAL disbursed principal, is added on top of every instalment (it is not
-- part of the principal calculation). The final period absorbs the residual so
-- the balance repays to exactly zero. All money is rounded HALF_EVEN to 2dp.

entity loan
  disbursed : decimal          -- original principal disbursed, > 0
  annual_rate_pct : decimal    -- nominal annual rate in percent, >= 0
  months : int                 -- number of periods, >= 1

entity instalment
  -- one per period, index 0 .. months-1, in schedule order
  index : int
  balance : decimal            -- running balance at start of period (exact, pre-report)
  outstanding_start : decimal  -- reported opening balance = r2(balance)
  interest : decimal           -- reported interest line = pure interest + fee
  principal : decimal          -- principal repaid this period
  emi : decimal                -- customer payment = base instalment + fee

invariant loan_domain:
  every loan l :: l.disbursed > 0 and l.annual_rate_pct >= 0 and l.months >= 1

-- Round HALF_EVEN (banker's rounding) to 2 decimal places. Matches
-- Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN).
given r2(x) means round_half_even(x, 2)

-- Monthly interest factor: annual percent / 1200.
given monthly_factor(l) means l.annual_rate_pct / 1200

-- Flat monthly service fee: 0.25% of the ORIGINAL disbursed principal, rounded.
-- Constant across every period; it never tracks the declining balance.
given fee(l) means r2(l.disbursed * 0.0025)

-- Base EMI (fee excluded). Standard annuity formula; degenerates to straight-
-- line principal at zero rate. Rounded to 2dp once, before the schedule loop.
given base_emi(l) means
  if monthly_factor(l) == 0
    then r2(l.disbursed / l.months)
    else r2( l.disbursed * monthly_factor(l) * (1 + monthly_factor(l)) ^ l.months
             / ((1 + monthly_factor(l)) ^ l.months - 1) )

-- Pure declining-balance interest for a period: r2(opening balance * factor).
-- Uses the exact running balance (period 0 uses the unrounded disbursed value),
-- not the reported outstanding_start.
given pure_int(i, l) means r2(i.balance * monthly_factor(l))

-- The schedule has exactly one instalment per period.
invariant period_count:
  every loan l :: count(instalment) == l.months

-- Balance recurrence: first period opens at the full disbursed principal;
-- each subsequent opening balance is the prior balance minus prior principal,
-- rounded to 2dp (so from period 1 onward the balance is always a 2dp value).
invariant balance_initial:
  every instalment i where i.index == 0 ::
    every loan l :: i.balance == l.disbursed

invariant balance_recurrence:
  follows(next, i) :: next.balance == r2(i.balance - i.principal)

invariant outstanding_reported:
  every instalment i :: i.outstanding_start == r2(i.balance)

-- Principal split. Regular periods: base EMI minus PURE interest (fee is on top,
-- excluded here), rounded. Final period: repay the entire remaining balance.
invariant principal_regular:
  every instalment i where i.index < loan.months - 1 ::
    i.principal == r2(base_emi(loan) - pure_int(i, loan))

invariant principal_final:
  every instalment i where i.index == loan.months - 1 ::
    i.principal == i.balance

-- Reported interest line = pure interest + service fee, rounded.
invariant interest_line:
  every instalment i ::
    i.interest == r2(pure_int(i, loan) + fee(loan))

-- Reported EMI (what the customer pays) = base instalment + service fee.
-- Regular periods use base_emi as the base instalment. The final period's base
-- instalment closes the loan (pure interest + residual principal), so its EMI
-- nests the two roundings: r2(r2(pure_int + balance) + fee).
invariant emi_regular:
  every instalment i where i.index < loan.months - 1 ::
    i.emi == r2(base_emi(loan) + fee(loan))

invariant emi_final:
  every instalment i where i.index == loan.months - 1 ::
    i.emi == r2(r2(pure_int(i, loan) + i.balance) + fee(loan))

-- Load-bearing outcome: the loan closes exactly, balance to zero after the last
-- period (guaranteed by the final period repaying its whole opening balance).
invariant closes_exactly:
  every instalment i where i.index == loan.months - 1 ::
    r2(i.balance - i.principal) == 0

end
