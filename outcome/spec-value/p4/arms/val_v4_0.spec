-- allium: 4

-- Flat-rate loan amortisation schedule.
-- Interest and principal are constant for every installment except the last,
-- which absorbs the rounding residual so the balance is paid off exactly.

entity LoanTerms
  disbursed        : money
  annual_rate_pct  : decimal
  months           : integer

entity Installment
  period            : integer
  emi               : money
  interest          : money
  principal         : money
  outstanding_start : money
  rate_factor       : decimal
  is_last           : boolean

-- One set of terms produces an ordered list of installments.
relation Schedule
  terms        : LoanTerms
  installments : list of Installment ordered by period

invariant periods_are_contiguous
  for each Schedule s:
    for each Installment i in s.installments:
      i.period >= 0 and i.period < s.terms.months

invariant rate_factor_from_annual
  for each Schedule s:
    for each Installment i in s.installments:
      i.rate_factor == round(s.terms.annual_rate_pct / 1200, 6)

invariant emi_is_interest_plus_principal
  for each Schedule s:
    for each Installment i in s.installments:
      i.emi == round(i.interest + i.principal, 2)

invariant flat_interest_before_last
  for each Schedule s:
    for each Installment i in s.installments where not i.is_last:
      i.interest == round(s.terms.disbursed * i.rate_factor, 2)

invariant equal_principal_before_last
  for each Schedule s:
    for each Installment i in s.installments where not i.is_last:
      i.principal == round(s.terms.disbursed / s.terms.months, 2)

invariant first_outstanding_is_disbursed
  for each Schedule s:
    for the first Installment i in s.installments:
      i.outstanding_start == s.terms.disbursed

invariant outstanding_rolls_down
  for each Schedule s:
    for each Installment i in s.installments where i.period > 0:
      i.outstanding_start == round(prev(i).outstanding_start - prev(i).principal, 2)

invariant last_flag_marks_final_period
  for each Schedule s:
    for each Installment i in s.installments:
      i.is_last == (i.period == s.terms.months - 1)

invariant last_installment_clears_balance
  for each Schedule s:
    for each Installment i in s.installments where i.is_last:
      i.principal == i.outstanding_start

invariant amounts_are_non_negative
  for each Schedule s:
    for each Installment i in s.installments:
      i.emi >= 0 and i.interest >= 0 and i.principal >= 0 and i.outstanding_start > 0

end