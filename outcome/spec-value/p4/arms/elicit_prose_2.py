from decimal import Decimal, ROUND_HALF_UP


def _round2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # list of length months; each element a dict with float keys
    # "emi","interest","principal","outstanding_start"
    total_interest = _round2(disbursed * (annual_rate_pct / 100.0) * (months / 12.0))
    emi = _round2((disbursed + total_interest) / months)
    interest_line = _round2(total_interest / months)

    rows = []
    outstanding = _round2(disbursed)
    interest_charged = 0.0

    for i in range(months):
        outstanding_start = outstanding
        if i == months - 1:
            # final period absorbs any rounding residual
            principal = outstanding_start
            interest = _round2(total_interest - interest_charged)
            emi_i = _round2(principal + interest)
        else:
            interest = interest_line
            principal = _round2(emi - interest)
            emi_i = emi
            interest_charged = _round2(interest_charged + interest)

        outstanding = _round2(outstanding_start - principal)
        rows.append({
            "emi": emi_i,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

    return rows
