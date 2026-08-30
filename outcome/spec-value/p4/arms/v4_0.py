from decimal import Decimal, ROUND_HALF_EVEN


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    cents = Decimal("0.01")

    def r2(x: Decimal) -> Decimal:
        return x.quantize(cents, rounding=ROUND_HALF_EVEN)

    principal_amount = Decimal(str(disbursed))
    n = int(months)
    monthly_factor = Decimal(str(annual_rate_pct)) / Decimal(1200)

    if n <= 0:
        return []

    # Constant EMI for the non-final periods.
    if monthly_factor == 0:
        emi = r2(principal_amount / Decimal(n))
    else:
        growth = (Decimal(1) + monthly_factor) ** n
        emi = r2(principal_amount * monthly_factor * growth / (growth - Decimal(1)))

    result = []
    balance = principal_amount
    for i in range(n):
        is_last = i == n - 1
        start = balance
        interest = r2(start * monthly_factor)

        if is_last:
            # Final period absorbs the residual: clears the balance exactly.
            principal = start
            period_emi = r2(interest + principal)
        else:
            period_emi = emi
            principal = r2(period_emi - interest)

        balance = start - principal

        result.append({
            "emi": float(period_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(start),
        })

    return result
