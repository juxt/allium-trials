from decimal import Decimal, ROUND_HALF_EVEN


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)

    P = Decimal(str(disbursed))
    factor = Decimal(str(annual_rate_pct)) / Decimal(1200)

    if months <= 0:
        return []

    # Level EMI for the standard amortising schedule.
    if factor == 0:
        emi = r2(P / Decimal(months))
    else:
        growth = (Decimal(1) + factor) ** months
        emi = r2(P * factor * growth / (growth - Decimal(1)))

    rows = []
    bal = r2(P)
    for i in range(months):
        interest = r2(bal * factor)
        if i == months - 1:
            # Final period absorbs residual: closes balance to zero.
            principal = bal
            period_emi = principal + interest
        else:
            period_emi = emi
            principal = period_emi - interest
        outstanding_start = bal
        bal = bal - principal
        rows.append({
            "emi": float(period_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
