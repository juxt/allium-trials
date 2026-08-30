def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # list of length months; each element a dict with float keys
    # "emi","interest","principal","outstanding_start"
    if months <= 0:
        return []

    r = annual_rate_pct / 100.0 / 12.0

    if r == 0:
        emi = round(disbursed / months, 2)
    else:
        factor = (1 + r) ** months
        emi = round(disbursed * r * factor / (factor - 1), 2)

    rows = []
    outstanding = round(disbursed, 2)

    for m in range(months):
        outstanding_start = outstanding
        interest = round(outstanding_start * r, 2)

        if m == months - 1:
            # final instalment clears the balance exactly, absorbing rounding drift
            principal = outstanding_start
            payment = round(principal + interest, 2)
        else:
            payment = emi
            principal = round(payment - interest, 2)

        outstanding = round(outstanding_start - principal, 2)

        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
