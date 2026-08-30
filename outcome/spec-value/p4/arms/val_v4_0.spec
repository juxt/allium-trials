-- allium: 4

entity ScheduleRow
  field disbursed : Money
  field annual_rate_pct : Number
  field months : Number
  field period : Number
  field emi : Money
  field interest : Money
  field principal : Money
  field outstanding_start : Money
  field rate_factor : Number
  field is_last : Boolean

  invariant payment_splits_into_interest_and_principal:
    emi == interest + principal

  invariant rate_factor_is_monthly_base_rate:
    rate_factor == annual_rate_pct / 1200

  invariant last_period_is_final_index:
    is_last == (period == months - 1)

  invariant final_payment_clears_outstanding:
    is_last implies principal == outstanding_start

  invariant amounts_are_well_formed:
    interest >= 0 and principal > 0 and outstanding_start > 0 and emi > 0
end