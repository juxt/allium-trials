from decimal import Decimal, ROUND_HALF_EVEN


def _round2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    P = Decimal(str(disbursed))
    r = Decimal(str(annual_rate_pct)) / Decimal(1200)
    n = int(months)

    if n <= 0:
        return []

    if r == 0:
        emi = _round2(P / Decimal(n))
    else:
        growth = (Decimal(1) + r) ** n
        emi = _round2(P * r * growth / (growth - Decimal(1)))

    rows = []
    outstanding = P
    for i in range(n):
        outstanding_start = outstanding
        if i == n - 1:
            interest = _round2(r * outstanding_start)
            principal = _round2(outstanding_start)
            inst = _round2(interest + principal)
        else:
            interest = _round2(r * outstanding_start)
            principal = _round2(emi - interest)
            inst = emi
        outstanding = outstanding_start - principal
        rows.append({
            "emi": float(inst),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(_round2(outstanding_start)),
        })

    return rows
