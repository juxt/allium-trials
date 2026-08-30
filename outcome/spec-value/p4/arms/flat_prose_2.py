from decimal import Decimal, ROUND_HALF_UP


def _r2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    total_interest = _r2(disbursed * (annual_rate_pct / 100.0) * (months / 12.0))
    per_interest = _r2(total_interest / months)
    emi = _r2((disbursed + total_interest) / months)

    result = []
    outstanding = _r2(disbursed)
    interest_charged = 0.0

    for i in range(months):
        is_last = i == months - 1
        if is_last:
            interest = _r2(total_interest - interest_charged)
            principal = _r2(outstanding)
            emi_val = _r2(principal + interest)
        else:
            interest = per_interest
            principal = _r2(emi - interest)
            emi_val = emi

        result.append({
            "emi": emi_val,
            "interest": interest,
            "principal": principal,
            "outstanding_start": _r2(outstanding),
        })

        interest_charged = _r2(interest_charged + interest)
        outstanding = _r2(outstanding - principal)

    return result
