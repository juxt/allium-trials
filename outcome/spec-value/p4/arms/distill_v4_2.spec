-- allium: 4

component LoanSchedule
  entity Period
    observable emi: decimal
    observable interest: decimal
    observable principal: decimal
    observable outstanding_start: decimal

  given monthly_rate(annual_rate_pct) means 
    annual_rate_pct / 1200

  given base_emi_value(disbursed, rate, months) means
    if rate == 0 then 
      disbursed / months
    else 
      disbursed * rate * (1 + rate) ^ months / ((1 + rate) ^ months - 1)

  given service_fee(disbursed) means 
    disbursed * 0.0025

  invariant rounding ::
    every monetary value in schedule :: 
      value rounded HALF_EVEN to 2 decimal places

  invariant monthly_factor ::
    rate = monthly_rate(annual_rate_pct)

  invariant fee_flat ::
    every period p ::
      fee = round(service_fee(original_disbursed), HALF_EVEN, 2dp)

  invariant outstanding_start_balance ::
    every period p ::
      p.outstanding_start = round(balance_at_start, HALF_EVEN, 2dp)

  invariant interest_on_declining_balance ::
    every period p ::
      pure_interest = round(p.outstanding_start * rate, HALF_EVEN, 2dp)

  invariant principal_regular_period ::
    every period p where p.index < total_months - 1 ::
      base_emi_amt = round(base_emi_value(original_disbursed, rate, total_months), HALF_EVEN, 2dp) and
      p.principal = round(base_emi_amt - pure_interest, HALF_EVEN, 2dp)

  invariant principal_final_period ::
    every period p where p.index == total_months - 1 ::
      p.principal = p.outstanding_start

  invariant emi_regular_period ::
    every period p where p.index < total_months - 1 ::
      base_emi_amt = round(base_emi_value(original_disbursed, rate, total_months), HALF_EVEN, 2dp) and
      p.emi = round(base_emi_amt + fee, HALF_EVEN, 2dp)

  invariant emi_final_period ::
    every period p where p.index == total_months - 1 ::
      base_amt = round(pure_interest + p.principal, HALF_EVEN, 2dp) and
      p.emi = round(base_amt + fee, HALF_EVEN, 2dp)

  invariant interest_includes_fee ::
    every period p ::
      p.interest = round(pure_interest + fee, HALF_EVEN, 2dp)

  invariant balance_decay ::
    follows(next, current) ::
      next.outstanding_start = round(current.outstanding_start - current.principal, HALF_EVEN, 2dp)

  invariant principal_exhausts_loan ::
    sum(all periods, principal) == original_disbursed

end
