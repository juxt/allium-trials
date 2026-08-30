from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    D = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct))
    n = int(months)

    total_interest = r2(D * (rate / Decimal(100)) * (Decimal(n) / Decimal(12)))
    emi = r2((D + total_interest) / Decimal(n))
    interest_line = r2(total_interest / Decimal(n))

    rows = []
    outstanding = D
    interest_charged = Decimal("0.00")
    for i in range(n):
        outstanding_start = outstanding
        if i == n - 1:
            # final period absorbs all rounding residual
            interest = total_interest - interest_charged
            principal = outstanding_start
            period_emi = r2(principal + interest)
        else:
            interest = interest_line
            principal = r2(emi - interest)
            period_emi = emi

        interest_charged += interest
        outstanding = outstanding_start - principal

        rows.append({
            "emi": float(period_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
