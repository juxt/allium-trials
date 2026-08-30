-- allium: 4

component AddOnFlatLoan
  -- A consumer loan on the ADD-ON (FLAT) interest convention: interest is charged
  -- on the ORIGINAL principal for the whole term, then spread in equal lines.
  -- Every money value is rounded HALF_UP to 2 decimal places (r2). Division is exact
  -- until r2 is applied. "/" denotes division throughout.

  observable state
    disbursed        : decimal   -- original principal advanced to the borrower
    annual_rate_pct  : decimal   -- nominal annual add-on rate, expressed in percent
    months           : int       -- number of equal periods in the term (months >= 1)

  entity Installment
    -- The schedule is the ordered sequence of Installments, index 0 .. months-1.
    index             : int       -- 0-based period number
    outstanding_start : decimal   -- principal balance at the start of the period
    interest          : decimal   -- interest line charged in the period
    principal         : decimal   -- principal line repaid in the period
    emi               : decimal   -- total instalment for the period (interest + principal)

  -- Numeric conventions ------------------------------------------------------
  -- r2: round HALF_UP to a scale of 2 decimal places. This is the ONLY rounding
  -- used, and it is applied at each named step below exactly as written.
  given r2(x) means round_half_up(x, 2)

  -- Total interest is add-on: computed once, on the original principal, for the
  -- full term, and rounded to 2dp.
  given total_interest means r2(disbursed * (annual_rate_pct / 100) * (months / 12))

  -- The interest line applied to every period except the last, rounded to 2dp.
  given per_interest means r2(total_interest / months)

  -- The level instalment paid in every period except the last, rounded to 2dp.
  given level_emi means r2((disbursed + total_interest) / months)

  -- Structural invariants ----------------------------------------------------
  invariant term_has_months_periods
    count p : Installment :: true == months

  invariant index_is_zero_based_and_dense
    every p : Installment :: p.index >= 0 and p.index <= months - 1

  invariant opening_balance_is_disbursed
    every p : Installment :: p.index == 0 implies p.outstanding_start == disbursed

  -- Balance rolls forward: each period's opening balance is the prior opening
  -- balance less the prior principal, re-rounded to 2dp.
  invariant balance_declines_by_principal
    every p : Installment, next : Installment :: follows(next, p) implies next.outstanding_start == r2(p.outstanding_start - p.principal)

  -- Regular periods (all but the last) ---------------------------------------
  invariant regular_period_lines
    every p : Installment :: p.index < months - 1 implies
      p.interest == per_interest
      and p.emi == level_emi
      and p.principal == r2(level_emi - per_interest)

  -- Final period absorbs the rounding residual -------------------------------
  -- Interest is what remains of total_interest after the equal lines; principal
  -- clears the outstanding balance; the instalment is their sum.
  invariant final_period_lines
    every p : Installment :: p.index == months - 1 implies
      p.interest == r2(total_interest - per_interest * (months - 1))
      and p.principal == p.outstanding_start
      and p.emi == r2(p.interest + p.principal)

  -- The final principal fully retires the balance.
  invariant schedule_fully_amortises
    every p : Installment :: p.index == months - 1 implies r2(p.outstanding_start - p.principal) == 0

  -- Closure invariants: the residual routing makes both sums exact -----------
  invariant principal_sums_to_disbursed
    sum p : Installment :: p.principal == disbursed

  invariant emi_sums_to_total_repayable
    sum p : Installment :: p.emi == disbursed + total_interest

end