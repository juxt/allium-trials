from decimal import Decimal, ROUND_HALF_UP


def _round2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    total_interest = _round2(disbursed * (annual_rate_pct / 100) * (months / 12))
    emi = _round2((disbursed + total_interest) / months)
    per_interest = _round2(total_interest / months)

    rows = []
    outstanding = disbursed          # principal still owed
    interest_charged = 0.0           # interest lines already booked

    for i in range(months):
        outstanding_start = _round2(outstanding)

        if i == months - 1:
            # final period absorbs all rounding residual
            interest = _round2(total_interest - interest_charged)
            principal = outstanding_start
            this_emi = _round2(principal + interest)
        else:
            interest = per_interest
            principal = _round2(emi - interest)
            this_emi = emi

        interest_charged = _round2(interest_charged + interest)
        outstanding = _round2(outstanding - principal)

        rows.append({
            "emi": this_emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

    return rows
