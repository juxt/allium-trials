def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    from decimal import Decimal, ROUND_HALF_UP

    def money(x):
        return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    principal = Decimal(str(disbursed))
    monthly_rate = Decimal(str(annual_rate_pct)) / Decimal("100") / Decimal("12")

    if months <= 0:
        return []

    # Equal monthly instalment (EMI)
    if monthly_rate == 0:
        emi = money(principal / Decimal(months))
    else:
        factor = (Decimal("1") + monthly_rate) ** months
        emi = money(principal * monthly_rate * factor / (factor - Decimal("1")))

    rows = []
    outstanding = principal
    for i in range(months):
        outstanding_start = outstanding
        interest = money(outstanding_start * monthly_rate)

        if i == months - 1:
            # Final instalment clears the balance exactly
            principal_component = outstanding_start
            payment = money(principal_component + interest)
        else:
            principal_component = money(emi - interest)
            payment = emi

        outstanding = outstanding_start - principal_component

        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal_component),
            "outstanding_start": float(outstanding_start),
        })

    return rows
