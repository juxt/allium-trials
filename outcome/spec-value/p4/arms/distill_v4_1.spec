-- allium: 4

entity LoanSchedule
  component Period
    observable period_index : integer
    observable outstanding_start : decimal
    observable pure_interest : decimal
    observable principal_portion : decimal
    observable base_instalment : decimal
    observable service_fee : decimal
    observable emi : decimal
    observable interest_reported : decimal
    observable outstanding_end : decimal

  observable disbursed : decimal
  observable annual_rate_pct : decimal
  observable months : integer
  observable periods : list of Period

  given monthly_rate_factor means
    monthly_rate_factor = annual_rate_pct / 1200

  given service_fee_monthly means
    service_fee_monthly = round(disbursed * 0.0025, 2)

  given base_emi_amount means
    if annual_rate_pct = 0 then
      base_emi_amount = round(disbursed / months, 2)
    else
      let r = monthly_rate_factor
      let compound = (1 + r) ^ months
      base_emi_amount = round(disbursed * r * compound / (compound - 1), 2)

  every period : periods ::
    let r = monthly_rate_factor
    let fee = service_fee_monthly
    let emi_base = base_emi_amount
    let is_final = (period.period_index = months - 1)

    period.pure_interest = round(period.outstanding_start * r, 2)

    if is_final then
      period.principal_portion = period.outstanding_start
      period.base_instalment = round(period.pure_interest + period.principal_portion, 2)
    else
      period.principal_portion = round(emi_base - period.pure_interest, 2)
      period.base_instalment = emi_base

    period.service_fee = fee

    period.emi = round(period.base_instalment + period.service_fee, 2)
    period.interest_reported = round(period.pure_interest + period.service_fee, 2)

    period.outstanding_end = round(period.outstanding_start - period.principal_portion, 2)

  sum p in periods ::
    p.principal_portion = disbursed

  follows(next, period) in periods ::
    next.outstanding_start = period.outstanding_end

  invariant periods[0].outstanding_start = disbursed

end
