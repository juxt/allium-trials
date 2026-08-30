from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x) -> float:
        return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    total_interest = r2(disbursed * (annual_rate_pct / 100) * (months / 12))
    per_interest = r2(total_interest / months)
    emi_regular = r2((disbursed + total_interest) / months)

    def ref_interest(i: int) -> float:
        if i == months - 1:
            return r2(total_interest - per_interest * (months - 1))
        return per_interest

    rows = []
    outstanding = r2(disbursed)
    for i in range(months):
        interest = ref_interest(i)
        if i == months - 1:
            principal = outstanding
            emi = r2(interest + principal)
        else:
            emi = emi_regular
            principal = r2(emi_regular - interest)
        rows.append({
            "emi": emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding,
        })
        outstanding = r2(outstanding - principal)

    return rows
