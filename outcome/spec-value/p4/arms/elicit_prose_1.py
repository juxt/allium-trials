from decimal import Decimal, ROUND_HALF_UP


def _r(x) -> float:
    """Round to 2 decimals, half-up."""
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    total_interest = _r(disbursed * (annual_rate_pct / 100) * (months / 12))
    emi = _r((disbursed + total_interest) / months)
    per_interest = _r(total_interest / months)

    rows = []
    outstanding = _r(disbursed)
    interest_charged = 0.0

    for i in range(months):
        outstanding_start = outstanding
        if i == months - 1:
            interest = _r(total_interest - interest_charged)
            principal = _r(outstanding_start)
            emi_line = _r(principal + interest)
        else:
            interest = per_interest
            principal = _r(emi - interest)
            emi_line = emi
            interest_charged = _r(interest_charged + interest)

        outstanding = _r(outstanding_start - principal)

        rows.append({
            "emi": emi_line,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

    return rows
