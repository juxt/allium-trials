from decimal import Decimal, ROUND_HALF_EVEN


def _round2(value) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200
    fee = _round2(disbursed * 0.0025)

    if f == 0:
        base_instalment = _round2(disbursed / months)
    else:
        factor = (1 + f) ** months
        base_instalment = _round2(disbursed * f * factor / (factor - 1))

    rows = []
    balance = _round2(disbursed)

    for period in range(months):
        is_final = period == months - 1

        outstanding_start = _round2(balance)
        pure_interest = _round2(balance * f)

        if is_final:
            principal = _round2(balance)
            period_base = _round2(pure_interest + principal)
        else:
            principal = _round2(base_instalment - pure_interest)
            period_base = base_instalment

        interest_line = _round2(pure_interest + fee)
        emi = _round2(period_base + fee)

        rows.append({
            "emi": emi,
            "interest": interest_line,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        balance = _round2(balance - principal)

    return rows
