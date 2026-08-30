from decimal import Decimal, ROUND_HALF_UP


def _r2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    total_interest = disbursed * annual_rate_pct / 100 * months / 12
    flat_interest = disbursed * annual_rate_pct / 1200

    total_interest_r = _r2(total_interest)
    flat_int = _r2(flat_interest)
    emi = _r2((disbursed + total_interest) / months)

    rows = []
    outstanding = _r2(disbursed)

    for i in range(months):
        is_last = i == months - 1
        if not is_last:
            interest = flat_int
            principal = _r2(emi - interest)
            row_emi = emi
        else:
            # final period absorbs residual principal and interest
            principal = _r2(outstanding)
            interest = _r2(total_interest_r - flat_int * (months - 1))
            row_emi = _r2(principal + interest)

        rows.append(
            {
                "emi": row_emi,
                "interest": interest,
                "principal": principal,
                "outstanding_start": outstanding,
            }
        )
        outstanding = _r2(outstanding - principal)

    return rows
