def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    r = annual_rate_pct / 100.0 / 12.0
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
        principal = emi - interest
        # On the final instalment, clear any residual to avoid drift
        if i == months - 1:
            principal = outstanding_start
            emi = principal + interest
        outstanding = outstanding_start - principal
        rows.append({
            "emi": float(emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })
    return rows