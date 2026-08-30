-- allium: 4

component SMETermLoanScheduler

  -- INPUTS to a schedule run (the original disbursed principal never changes
  -- once fixed; the fee and base instalment are both derived from it).
  entity LoanTerms
    disbursed          : Decimal   -- original principal actually paid out
    annual_rate_pct    : Decimal   -- nominal annual rate, percent
    months             : Int       -- number of periods, months >= 1

  -- One output row per period i in 0 .. months-1, in order.
  entity Instalment
    period             : Int       -- 0-based period index
    outstanding_start  : Decimal   -- balance at START of period, reported r2
    pure_interest      : Decimal   -- declining-balance interest only (no fee)
    principal          : Decimal   -- principal portion repaid this period
    base_instalment    : Decimal   -- instalment BEFORE the service fee
    interest           : Decimal   -- reported interest line = pure_interest + fee
    emi                : Decimal   -- reported customer payment = base_instalment + fee

  observable state schedule : List(Instalment)   -- length == months, ordered by period

  -- ---- NUMERIC CONVENTIONS (all load-bearing) ----

  -- Rounding is HALF_EVEN (banker's) to 2 decimal places, applied at every
  -- point the reference calls r2(...). This is the ONLY rounding mode used.
  given r2(x) means round_half_even(x, 2)

  -- Monthly declining-balance factor. Note the divisor is 1200, i.e.
  -- (annual_rate_pct / 100) / 12, NOT a compounded conversion.
  given f(annual_rate_pct) means annual_rate_pct / 1200

  -- Flat monthly SERVICE FEE: 0.25% of the ORIGINAL disbursed principal,
  -- rounded once. Constant across every period; never recomputed on balance.
  given fee(disbursed) means r2(disbursed * 0.0025)

  -- Base EMI (before fee), rounded once up front. Zero-rate is a distinct
  -- straight-line branch; otherwise the standard annuity formula.
  given base_emi(disbursed, annual_rate_pct, months) means
    if f(annual_rate_pct) == 0
      then r2(disbursed / months)
      else r2( disbursed * f(annual_rate_pct) * (1 + f(annual_rate_pct)) ^ months
               / ((1 + f(annual_rate_pct)) ^ months - 1) )

  -- ---- STRUCTURE ----

  invariant schedule has exactly one Instalment per period 0 .. months-1
    -- length(schedule) == months and periods are 0,1,...,months-1 ascending

  -- ---- BALANCE RECURRENCE ----

  -- First row starts at the full disbursed principal (reported rounded).
  invariant first-outstanding
    every p in schedule :: p.period == 0 => p.outstanding_start == r2(disbursed)

  -- Each subsequent start balance is the previous start minus the previous
  -- principal, re-rounded to 2dp BEFORE the next period uses it. The rounded
  -- balance is what feeds pure_interest, so rounding here is material.
  invariant balance-rolls-forward
    follows(next, p) in schedule ::
      next.outstanding_start == r2(p.outstanding_start - p.principal)

  -- ---- PER-PERIOD DERIVATIONS ----

  -- Pure interest is computed on the ROUNDED start balance, rounded again.
  invariant pure-interest
    every p in schedule ::
      p.pure_interest == r2(p.outstanding_start * f(annual_rate_pct))

  -- Principal split and base instalment differ ONLY in the final period.
  -- Non-final: principal = base_emi - pure interest (fee is NOT in this calc);
  --            base instalment is just the flat base_emi.
  invariant principal-split-non-final
    every p in schedule :: p.period < months - 1 =>
      (    p.principal        == r2(base_emi(disbursed, annual_rate_pct, months) - p.pure_interest)
       and p.base_instalment  == base_emi(disbursed, annual_rate_pct, months) )

  -- Final period absorbs the residual: principal repays the WHOLE remaining
  -- balance exactly, and the base instalment closes the loan (pure interest +
  -- that residual principal). This guarantees the loan zeroes out despite
  -- accumulated rounding.
  invariant principal-split-final
    every p in schedule :: p.period == months - 1 =>
      (    p.principal        == p.outstanding_start
       and p.base_instalment  == r2(p.pure_interest + p.principal) )

  -- ---- REPORTED (fee-inclusive) FIELDS ----

  -- Reported interest line adds the flat fee on top of pure interest.
  invariant interest-line
    every p in schedule ::
      p.interest == r2(p.pure_interest + fee(disbursed))

  -- Reported EMI is the base instalment plus the flat fee (fee sits on top,
  -- it is never part of the principal or annuity calculation).
  invariant emi-field
    every p in schedule ::
      p.emi == r2(p.base_instalment + fee(disbursed))

  -- ---- CLOSURE PROPERTY ----

  -- The sum of principal portions equals the original disbursed principal
  -- exactly (the final-period residual absorption makes this hold).
  invariant principal-closes-loan
    sum p in schedule :: p.principal == r2(disbursed)

end
