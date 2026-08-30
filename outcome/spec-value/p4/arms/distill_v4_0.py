def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    r = annual_rate_pct / 100.0 / 12.0
    n = months

    if n <= 0:
        return []

    if r == 0:
        emi = disbursed / n
    else:
        factor = (1 + r) ** n
        emi = disbursed * r * factor / (factor - 1)

    emi = round(emi, 2)

    rows = []
    outstanding = round(disbursed, 2)

    for i in range(n):
        outstanding_start = outstanding
        interest = round(outstanding_start * r, 2)

        if i == n - 1:
            # final instalment clears the balance exactly
            principal = outstanding_start
            emi_i = round(principal + interest, 2)
        else:
            emi_i = emi
            principal = round(emi_i - interest, 2)

        outstanding = round(outstanding_start - principal, 2)

        rows.append({
            "emi": float(emi_i),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
