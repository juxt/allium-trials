from decimal import Decimal, ROUND_HALF_EVEN


def _r2(x: float) -> float:
    return float(Decimal(repr(float(x))).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200
    service_fee = _r2(disbursed * 0.0025)

    def pure_interest(balance: float) -> float:
        return _r2(balance * f)

    if f == 0:
        raw_emi = disbursed / months
    else:
        raw_emi = (disbursed * f * (1 + f) ** months) / ((1 + f) ** months - 1)
    base_emi = _r2(raw_emi)

    rows = []
    outstanding = _r2(disbursed)
    for index in range(months):
        pi = pure_interest(outstanding)
        interest = _r2(pi + service_fee)
        if index < months - 1:
            principal = _r2(base_emi - pi)
            emi = _r2(base_emi + service_fee)
        else:
            principal = outstanding
            emi = _r2(_r2(pi + principal) + service_fee)
        rows.append({
            "outstanding_start": outstanding,
            "emi": emi,
            "interest": interest,
            "principal": principal,
        })
        outstanding = _r2(outstanding - principal)

    return rows