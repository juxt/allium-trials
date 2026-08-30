from decimal import Decimal, ROUND_HALF_UP


def _r(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    D = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct))
    n = int(months)

    total_interest = _r(D * (rate / Decimal(100)) * (Decimal(n) / Decimal(12)))
    period_interest = _r(total_interest / Decimal(n))
    emi = _r((D + total_interest) / Decimal(n))

    rows = []
    outstanding = D
    interest_charged = Decimal("0.00")

    for i in range(n):
        if i == n - 1:
            interest = _r(total_interest - interest_charged)
            principal = _r(outstanding)
            this_emi = _r(principal + interest)
        else:
            interest = period_interest
            principal = _r(emi - interest)
            this_emi = emi

        rows.append({
            "emi": float(this_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(_r(outstanding)),
        })

        interest_charged += interest
        outstanding = outstanding - principal

    return rows
