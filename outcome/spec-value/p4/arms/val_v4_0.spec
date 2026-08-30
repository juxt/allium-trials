-- allium: 4

component sme_term_loan
-- Reference schedule for an SME term loan.
-- Non-default conventions, all carried in the invariants below:
--   declining-balance interest, a flat monthly service fee on ORIGINAL principal,
--   fee added on top of a standard-amortisation base payment, and a final period
--   that absorbs the residual so principal repays exactly.

entity Period
  index             : whole   -- 0-based period number, 0 .. months-1
  outstanding_start : money   -- balance owing at the start of the period
  emi               : money   -- what the customer pays: base instalment + service fee
  interest          : money   -- reported interest line: pure interest + service fee
  principal         : money   -- principal repaid this period (fee is NOT part of this)

state
  disbursed         : money   -- original principal disbursed
  annual_rate_pct   : number  -- nominal annual interest rate, in percent
  months            : whole   -- number of periods

observable schedule : list of Period

-- Numeric conventions -------------------------------------------------------

-- Banker's rounding to 2 decimal places; applied at every quantisation step.
given r2(x) means round_half_even(x, 2)

-- Monthly interest factor: annual percentage rate over 1200 (= /100 then /12).
given monthly_factor(annual_rate_pct) means annual_rate_pct / 1200

-- Flat service fee: 0.25% of the ORIGINAL disbursed principal, rounded, added
-- to EVERY period (never re-based on the declining balance).
given service_fee(disbursed) means r2(disbursed * 0.0025)

-- Pure declining-balance interest for a period, on its opening balance.
given pure_interest(balance, f) means r2(balance * f)

-- Standard amortising base payment (fee excluded). Zero-rate loans amortise
-- principal evenly.
given raw_emi(disbursed, f, months) means
  if f = 0 then disbursed / months
  else (disbursed * f * (1 + f)^months) / ((1 + f)^months - 1)

given base_emi(disbursed, f, months) means r2(raw_emi(disbursed, f, months))

-- Structure -----------------------------------------------------------------

invariant schedule_length :
  count(schedule) = months

invariant index_domain :
  every p in schedule : 0 <= p.index and p.index < months

invariant indices_consecutive :
  every p, next in schedule :
    follows(next, p) => next.index = p.index + 1

-- Opening balance of the first period is the full disbursed amount.
invariant opening_balance :
  every p in schedule :
    p.index = 0 => p.outstanding_start = r2(disbursed)

-- Balance rolls forward exactly: next opening = this opening less principal repaid.
invariant balance_rolls_forward :
  every p, next in schedule :
    follows(next, p) =>
      next.outstanding_start = r2(p.outstanding_start - p.principal)

-- Numeric conventions per period --------------------------------------------

-- Reported interest line = pure interest on the opening balance + the flat fee.
invariant interest_line_carries_fee :
  every p in schedule :
    p.interest =
      r2(pure_interest(p.outstanding_start, monthly_factor(annual_rate_pct))
         + service_fee(disbursed))

-- Regular periods: principal is the base payment less PURE interest (fee sits on
-- top and never enters the principal split); the paid emi is base payment + fee.
invariant regular_principal :
  every p in schedule :
    p.index < months - 1 =>
      p.principal =
        r2(base_emi(disbursed, monthly_factor(annual_rate_pct), months)
           - pure_interest(p.outstanding_start, monthly_factor(annual_rate_pct)))

invariant regular_emi :
  every p in schedule :
    p.index < months - 1 =>
      p.emi =
        r2(base_emi(disbursed, monthly_factor(annual_rate_pct), months)
           + service_fee(disbursed))

-- Final period absorbs the residual: principal is the whole remaining balance,
-- and the base instalment closes the loan (pure interest + that principal),
-- with the fee added on top.
invariant final_principal :
  every p in schedule :
    p.index = months - 1 => p.principal = p.outstanding_start

invariant final_emi :
  every p in schedule :
    p.index = months - 1 =>
      p.emi =
        r2(r2(pure_interest(p.outstanding_start, monthly_factor(annual_rate_pct))
              + p.principal)
           + service_fee(disbursed))

-- Loan repays exactly: total principal across the schedule equals disbursed.
invariant principal_closes_loan :
  (sum p in schedule : p.principal) = disbursed

end