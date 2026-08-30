# Reference: declining-balance amortising schedule, monthly, DAYS_360/30 (monthly factor = rate/1200),
# EMI by annuity formula, last period absorbs residual, HALF_EVEN 2dp.
from decimal import Decimal, ROUND_HALF_EVEN
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))
def schedule(disbursed, annual_rate_pct, months):
    bal = disbursed
    mrate = annual_rate_pct/1200.0
    if mrate == 0:
        emi = disbursed/months
    else:
        emi = disbursed*mrate*(1+mrate)**months/((1+mrate)**months - 1)
    emi = r2(emi)
    out = []
    for i in range(months):
        interest = r2(bal*mrate)
        if i == months-1:
            principal = bal
            inst = r2(interest + principal)
        else:
            principal = r2(emi - interest)
            inst = emi
        out.append({"emi": inst, "interest": interest, "principal": principal, "outstanding_start": r2(bal)})
        bal = r2(bal - principal)
    return out
