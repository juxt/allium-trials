def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    r = annual_rate_pct / 100.0 / 12.0
    if months <= 0:
        return []

    if r == 0:
        emi = disbursed / months
    else:
        factor = (1 + r) ** months
        emi = disbursed * r * factor / (factor - 1)

    rows = []
    outstanding = disbursed
    for i in range(months):
        outstanding_start = outstanding
        interest = outstanding_start * r
        if i == months - 1:
            # final instalment clears any residual balance
            principal = outstanding_start
            emi_row = principal + interest
        else:
            principal = emi - interest
            emi_row = emi
        outstanding = outstanding_start - principal
        rows.append({
            "emi": float(emi_row),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })
    return rows