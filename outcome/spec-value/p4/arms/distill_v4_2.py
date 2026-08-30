from decimal import Decimal, ROUND_HALF_EVEN


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x) -> float:
        return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))

    f = annual_rate_pct / 1200

    if f == 0:
        base_emi = r2(disbursed / months)
    else:
        base_emi = r2(disbursed * f * (1 + f) ** months / ((1 + f) ** months - 1))

    fee = r2(disbursed * 0.0025)

    rows = []
    outstanding = r2(disbursed)
    for index in range(months):
        pure_interest = r2(outstanding * f)

        if index < months - 1:
            principal = r2(base_emi - pure_interest)
        else:
            principal = outstanding

        interest = r2(pure_interest + fee)

        if index < months - 1:
            emi = r2(base_emi + fee)
        else:
            emi = r2(r2(pure_interest + principal) + fee)

        rows.append({
            "outstanding_start": outstanding,
            "pure_interest": pure_interest,
            "principal": principal,
            "interest": interest,
            "emi": emi,
        })

        outstanding = r2(outstanding - principal)

    return rows
