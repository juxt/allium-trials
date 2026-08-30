def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    from decimal import Decimal, ROUND_HALF_UP

    def r2(x):
        return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    total_interest = r2(disbursed * (annual_rate_pct / 100) * (months / 12))
    per_int = r2(total_interest / months)
    emi = r2((disbursed + total_interest) / months)

    rows = []
    balance = disbursed
    for i in range(months):
        outstanding_start = r2(balance)
        if i < months - 1:
            interest = per_int
            principal = r2(emi - interest)
            instalment = emi
            balance = r2(balance - principal)
        else:
            interest = r2(total_interest - per_int * (months - 1))
            principal = outstanding_start
            instalment = r2(interest + principal)
            balance = r2(balance - principal)
        rows.append({
            "emi": instalment,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })
    return rows
