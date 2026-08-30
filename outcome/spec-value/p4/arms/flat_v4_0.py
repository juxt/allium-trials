from decimal import Decimal, ROUND_HALF_UP


def _r2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    D = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct))
    n = int(months)

    total_interest = _r2(D * rate / Decimal(100) * Decimal(n) / Decimal(12))
    flat_interest = _r2(D * rate / Decimal(1200))
    emi = _r2((D + total_interest) / Decimal(n))

    rows = []
    outstanding = D
    interest_so_far = Decimal("0.00")

    for i in range(n):
        is_last = i == n - 1
        if not is_last:
            interest = flat_interest
            principal = emi - interest
            row_emi = emi
        else:
            # final period absorbs residual principal and interest
            principal = outstanding
            interest = total_interest - interest_so_far
            row_emi = principal + interest

        rows.append({
            "emi": float(row_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })

        interest_so_far += interest
        outstanding = outstanding - principal

    return rows
