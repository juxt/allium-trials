from decimal import Decimal, ROUND_HALF_UP


def _r(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    D = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct))
    n = int(months)

    total_interest = D * rate / Decimal(100) * Decimal(n) / Decimal(12)
    flat_interest = _r(D * rate / Decimal(1200))
    emi = _r((D + total_interest) / Decimal(n))

    rows = []
    outstanding = D
    for i in range(n):
        is_last = (i == n - 1)
        if not is_last:
            interest = flat_interest
            e = emi
            principal = e - interest
        else:
            # final period absorbs residual principal + interest
            principal = outstanding
            interest = _r(total_interest) - flat_interest * Decimal(n - 1)
            e = principal + interest

        rows.append({
            "emi": float(e),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })
        outstanding = outstanding - principal

    return rows
