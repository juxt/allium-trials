# Non-default reference: ADD-ON (FLAT) interest consumer loan (a real product type).
#  total_interest = disbursed * (annual/100) * (months/12)        # add-on, on ORIGINAL principal
#  per-period interest line = round_half_up(total_interest/months) # equal interest each period
#  emi = round_half_up((disbursed+total_interest)/months); equal for all but the LAST period
#  last period absorbs residual so sum(principal)=disbursed and sum(emi)=disbursed+total_interest
#  rounding: HALF_UP to 2dp; outstanding_start declines by principal.
from decimal import Decimal, ROUND_HALF_UP
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_UP))
def schedule(disbursed, annual_rate_pct, months):
    total_interest = r2(disbursed * (annual_rate_pct/100.0) * (months/12.0))
    per_int = r2(total_interest/months)
    emi = r2((disbursed + total_interest)/months)
    out = []; bal = disbursed
    for i in range(months):
        if i == months-1:
            interest = r2(total_interest - per_int*(months-1))
            principal = bal
            inst = r2(interest + principal)
        else:
            interest = per_int
            principal = r2(emi - interest)
            inst = emi
        out.append({"emi": inst, "interest": interest, "principal": principal, "outstanding_start": r2(bal)})
        bal = r2(bal - principal)
    return out
