from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    D = Decimal
    disbursed_d = D(str(disbursed))
    rate_d = D(str(annual_rate_pct))
    n = int(months)

    def r2(x: Decimal) -> Decimal:
        return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)

    total_interest = r2(disbursed_d * (rate_d / D(100)) * (D(n) / D(12)))
    per_interest = r2(total_interest / D(n))
    level_emi = r2((disbursed_d + total_interest) / D(n))

    final_interest = r2(total_interest - per_interest * D(n - 1))

    rows = []
    outstanding = disbursed_d
    for index in range(n):
        if index < n - 1:
            interest = per_interest
            emi = level_emi
            principal = r2(level_emi - per_interest)
        else:
            interest = final_interest
            principal = outstanding
            emi = r2(interest + principal)

        rows.append({
            "outstanding_start": float(outstanding),
            "interest": float(interest),
            "principal": float(principal),
            "emi": float(emi),
        })

        outstanding = r2(outstanding - principal)

    return rows