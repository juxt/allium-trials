from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    D = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct)) / Decimal("100")
    m = Decimal(months)

    total_interest = r(D * rate * (m / Decimal("12")))
    emi = r((D + total_interest) / m)
    interest_line = r(total_interest / m)

    rows = []
    outstanding = r(D)
    interest_charged = Decimal("0.00")

    for i in range(months):
        start = outstanding
        if i == months - 1:
            # final period absorbs all rounding residuals
            principal = start
            interest = total_interest - interest_charged
            period_emi = principal + interest
        else:
            interest = interest_line
            principal = emi - interest
            period_emi = emi

        interest_charged += interest
        outstanding = r(start - principal)

        rows.append({
            "emi": float(period_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(start),
        })

    return rows
