-- allium: 4

entity TermLoan
  disbursed: number
  annual_rate_pct: number
  months: integer

entity Period
  index: integer
  outstanding_start: number
  principal: number
  interest: number
  emi: number

contract TermLoan
  observable schedule: [Period]

  given monthly_factor means annual_rate_pct / 1200
  
  given service_fee means disbursed * 0.0025
  
  given base_emi_calc means
    let f = monthly_factor in
    if f = 0
      then disbursed / months
      else disbursed * f * (1 + f) ^ months / ((1 + f) ^ months - 1)

  every period in schedule ::
    let idx = period.index
    let f = monthly_factor
    let fee = round(service_fee, 2, HALF_EVEN)
    let emi_base = round(base_emi_calc, 2, HALF_EVEN)
    let is_final = idx = months - 1
    
    let bal_start = if idx = 0 then disbursed else schedule[idx - 1].outstanding_start - schedule[idx - 1].principal
    period.outstanding_start = round(bal_start, 2, HALF_EVEN)
    
    let pure_int = round(period.outstanding_start * f, 2, HALF_EVEN)
    
    period.principal = 
      if is_final
        then period.outstanding_start
        else round(emi_base - pure_int, 2, HALF_EVEN)
    
    let base_inst = 
      if is_final
        then round(pure_int + period.principal, 2, HALF_EVEN)
        else emi_base
    
    period.interest = round(pure_int + fee, 2, HALF_EVEN)
    period.emi = round(base_inst + fee, 2, HALF_EVEN)

end
