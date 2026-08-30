component consumer_loan {

  # ADD-ON (FLAT) interest consumer loan.
  #
  # Interest is computed ONCE, up front, on the ORIGINAL disbursed principal
  # (it does not decline with the balance). The total interest is split into
  # equal per-period lines; the equal instalment (emi) is likewise the total
  # amount due divided evenly across the term. The FINAL period is the residual
  # sink: it absorbs all rounding drift so that principal lines sum exactly to
  # the disbursed amount and instalments sum exactly to principal + interest.
  #
  # Every derived money value is rounded HALF_UP to 2 decimal places (r2).
  # All divisions below are REAL division (e.g. 6 months / 12 = 0.5).

  entity Loan {
    observable state disbursed : money          # original principal, 2dp
    observable state annual_rate_pct : number   # nominal annual rate, in percent
    observable state months : integer           # term = number of equal periods, >= 1
  }

  entity Installment {
    observable state loan : Loan
    observable state index : integer             # 0-based period: 0 .. months-1
    observable state outstanding_start : money    # balance at the START of the period
    observable state interest : money             # interest line for the period
    observable state principal : money            # principal line for the period
    observable state emi : money                  # total instalment = interest + principal
  }

  # --- rounding convention: HALF_UP to 2 decimal places, applied to each derived money value.
  given r2(x) means round_half_up(x, 2)

  # --- loan-level derived constants ------------------------------------------
  # Add-on interest on the original principal for the full term:
  given total_interest(L) means r2(L.disbursed * (L.annual_rate_pct / 100) * (L.months / 12))
  # Equal interest line charged in every non-final period:
  given per_interest(L)   means r2(total_interest(L) / L.months)
  # Equal instalment charged in every non-final period:
  given emi_regular(L)    means r2((L.disbursed + total_interest(L)) / L.months)

  # --- per-period reference values (i = Installment.index; last period = months - 1) -----
  given is_last(L, i) means i == L.months - 1

  # Non-final periods carry the equal interest line; the final period carries
  # the residual so the interest lines total exactly total_interest.
  given ref_interest(L, i) means
    if is_last(L, i)
    then r2(total_interest(L) - per_interest(L) * (L.months - 1))
    else per_interest(L)

  # === structural obligations ================================================
  invariant one_installment_per_period:
    every Loan L ::
      (count Installment i where i.loan == L :: true) == L.months

  invariant indices_cover_the_term:
    every Installment i :: i.index >= 0 and i.index < i.loan.months

  # === per-period numeric obligations ========================================
  # Interest line follows the flat-interest reference exactly.
  invariant interest_matches_reference:
    every Installment i :: i.interest == ref_interest(i.loan, i.index)

  # Non-final instalment is the equal emi; principal is whatever the emi leaves
  # after the (equal) interest line.
  invariant regular_emi_is_equal:
    every Installment i where not is_last(i.loan, i.index) ::
      i.emi == emi_regular(i.loan)

  invariant regular_principal_is_residual_of_emi:
    every Installment i where not is_last(i.loan, i.index) ::
      i.principal == r2(emi_regular(i.loan) - i.interest)

  # Final period: principal clears the whole remaining balance; emi is whatever
  # that principal plus the residual interest come to.
  invariant last_principal_clears_balance:
    every Installment i where is_last(i.loan, i.index) ::
      i.principal == i.outstanding_start

  invariant last_emi_is_interest_plus_principal:
    every Installment i where is_last(i.loan, i.index) ::
      i.emi == r2(i.interest + i.principal)

  # === balance recurrence ====================================================
  # The first period opens at the full disbursed principal.
  invariant first_outstanding_is_disbursed:
    every Installment i where i.index == 0 :: i.outstanding_start == i.loan.disbursed

  # Balance declines by the principal paid; installments are ordered by index
  # within a loan, so follows(next, p) is the immediately-next period.
  invariant outstanding_declines_by_principal:
    follows(next, p) ::
      next.outstanding_start == r2(p.outstanding_start - p.principal)

  # === reconciliation (the residual sink guarantees these hold exactly) ======
  invariant principal_sums_to_disbursed:
    every Loan L ::
      (sum Installment i where i.loan == L :: i.principal) == L.disbursed

  invariant interest_sums_to_total_interest:
    every Loan L ::
      (sum Installment i where i.loan == L :: i.interest) == total_interest(L)

  invariant instalments_sum_to_total_due:
    every Loan L ::
      (sum Installment i where i.loan == L :: i.emi) == r2(L.disbursed + total_interest(L))
}
