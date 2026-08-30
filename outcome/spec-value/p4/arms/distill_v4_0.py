from decimal import Decimal, ROUND_HALF_EVEN


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)

    D = Decimal(str(disbursed))
    f = Decimal(str(annual_rate_pct)) / Decimal(1200)
    n = int(months)

    fee = r2(D * Decimal("0.0025"))

    if f == 0:
        base_emi = r2(D / Decimal(n))
    else:
        pow_n = (Decimal(1) + f) ** n
        base_emi = r2(D * f * pow_n / (pow_n - Decimal(1)))

    rows = []
    outstanding = r2(D)
    for period in range(n):
        pure_interest = r2(outstanding * f)
        if period < n - 1:
            principal = r2(base_emi - pure_interest)
            base_instalment = base_emi
        else:
            principal = outstanding
            base_instalment = r2(pure_interest + principal)

        interest = r2(pure_interest + fee)
        emi = r2(base_instalment + fee)

        rows.append({
            "period": period,
            "outstanding_start": float(outstanding),
            "pure_interest": float(pure_interest),
            "principal": float(principal),
            "base_instalment": float(base_instalment),
            "interest": float(interest),
            "emi": float(emi),
        })

        outstanding = r2(outstanding - principal)

    return rows
