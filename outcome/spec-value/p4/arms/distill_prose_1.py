from decimal import Decimal, ROUND_HALF_UP


def _round2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    total_interest = _round2(disbursed * (annual_rate_pct / 100) * (months / 12))
    per_int = _round2(total_interest / months)
    emi = _round2((disbursed + total_interest) / months)

    rows = []
    bal = disbursed
    for i in range(months):
        outstanding_start = _round2(bal)
        if i < months - 1:
            interest = per_int
            principal = _round2(emi - interest)
            instalment = emi
        else:
            interest = _round2(total_interest - per_int * (months - 1))
            principal = bal
            instalment = _round2(interest + principal)

        rows.append({
            "emi": emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        bal = _round2(bal - principal)

    return rows
