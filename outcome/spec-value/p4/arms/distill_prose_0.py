from decimal import Decimal, ROUND_HALF_EVEN


def _round(value):
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200
    fee = _round(disbursed * 0.0025)

    if f == 0:
        base_emi = _round(disbursed / months)
    else:
        base_emi = _round(disbursed * f * (1 + f) ** months / ((1 + f) ** months - 1))

    result = []
    balance = disbursed
    for period in range(months):
        outstanding_start = _round(balance)
        pure_int = _round(balance * f)

        if period == months - 1:
            principal = _round(balance)
            period_base = _round(pure_int + principal)
        else:
            principal = _round(base_emi - pure_int)
            period_base = base_emi

        result.append({
            "outstanding_start": outstanding_start,
            "principal": principal,
            "interest": _round(pure_int + fee),
            "emi": _round(period_base + fee),
        })

        balance = _round(balance - principal)

    return result
