from decimal import Decimal, ROUND_HALF_EVEN


def _r2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200
    fee = _r2(disbursed * 0.0025)

    if f == 0:
        base_emi = _r2(disbursed / months)
    else:
        base_emi = _r2(disbursed * f * (1 + f) ** months / ((1 + f) ** months - 1))

    rows = []
    balance = disbursed
    for i in range(months):
        is_last = i == months - 1

        pure_interest = _r2(balance * f)

        if is_last:
            principal = _r2(balance)
            period_base = _r2(pure_interest + principal)
        else:
            principal = _r2(base_emi - pure_interest)
            period_base = base_emi

        interest_line = _r2(pure_interest + fee)
        emi = _r2(period_base + fee)
        outstanding_start = _r2(balance)

        rows.append({
            "emi": emi,
            "interest": interest_line,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        balance = _r2(balance - principal)

    return rows
