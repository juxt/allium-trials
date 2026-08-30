from decimal import Decimal, ROUND_HALF_EVEN


def _r2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    P = Decimal(str(disbursed))
    r = Decimal(str(annual_rate_pct)) / Decimal(1200)
    n = int(months)

    if r == 0:
        emi = _r2(P / Decimal(n))
    else:
        growth = (Decimal(1) + r) ** n
        emi = _r2(P * r * growth / (growth - Decimal(1)))

    result = []
    outstanding = _r2(P)

    for i in range(n):
        interest = _r2(r * outstanding)
        if i == n - 1:
            principal = outstanding
            instalment = _r2(interest + principal)
        else:
            principal = _r2(emi - interest)
            instalment = emi

        result.append({
            "emi": float(instalment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })

        outstanding = _r2(outstanding - principal)

    return result
