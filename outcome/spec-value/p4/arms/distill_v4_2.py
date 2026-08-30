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

    result = []
    outstanding = disbursed
    for i in range(n):
        outstanding_start = outstanding
        interest = outstanding_start * r
        if i == n - 1:
            principal = outstanding_start
            emi_i = principal + interest
        else:
            principal = emi - interest
            emi_i = emi
        outstanding = outstanding_start - principal
        result.append({
            "emi": float(emi_i),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })
    return result
