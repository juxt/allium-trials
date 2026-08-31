# Complex "SME term loan" reference. Multiple interacting, non-default conventions:
#  1. Declining-balance interest, monthly factor = annual_rate_pct/1200.
#  2. A flat monthly SERVICE FEE = 0.25% of the ORIGINAL disbursed principal, added to EVERY period.
#  3. The instalment's PRINCIPAL split is emi - PURE interest (fee is on top, not part of principal calc).
#  4. The reported "emi" (what the customer pays) = base_emi + service_fee.
#  5. The "interest" line reported = pure interest + service_fee.
#  6. Final period absorbs residual so principal repays exactly; rounding HALF_EVEN 2dp.
from decimal import Decimal, ROUND_HALF_EVEN
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))
def schedule(disbursed, annual_rate_pct, months):
    f = annual_rate_pct/1200.0
    fee = r2(disbursed*0.0025)
    if f == 0:
        base_emi = disbursed/months
    else:
        base_emi = disbursed*f*(1+f)**months/((1+f)**months - 1)
    base_emi = r2(base_emi)
    out=[]; bal=disbursed
    for i in range(months):
        pure_int = r2(bal*f)
        if i == months-1:
            principal = bal
            base_inst = r2(pure_int + principal)  # base instalment closes the loan
        else:
            principal = r2(base_emi - pure_int)
            base_inst = base_emi
        interest_line = r2(pure_int + fee)
        emi_field = r2(base_inst + fee)
        out.append({"emi": emi_field, "interest": interest_line, "principal": principal, "outstanding_start": r2(bal)})
        bal = r2(bal - principal)
    return out
