def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    r = annual_rate_pct / 100.0 / 12.0
    n = int(months)

    if n <= 0:
        return []

    if r == 0.0:
        emi = disbursed / n
    else:
        factor = (1.0 + r) ** n
        emi = disbursed * r * factor / (factor - 1.0)

    rows = []
    outstanding = float(disbursed)
    for i in range(n):
        interest = outstanding * r
        if i == n - 1:
            # final instalment clears the balance exactly
            principal = outstanding
            payment = principal + interest
        else:
            principal = emi - interest
            payment = emi
        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })
        outstanding -= principal

    return rows
