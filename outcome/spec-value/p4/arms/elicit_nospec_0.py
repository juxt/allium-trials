def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # list of length months; each element a dict with float keys
    # "emi","interest","principal","outstanding_start"
    if months <= 0:
        return []

    r = annual_rate_pct / 100.0 / 12.0  # monthly rate

    if r == 0.0:
        emi = disbursed / months
    else:
        factor = (1.0 + r) ** months
        emi = disbursed * r * factor / (factor - 1.0)

    rows = []
    outstanding = disbursed
    for m in range(months):
        interest = outstanding * r
        principal = emi - interest
        # On the final instalment, clear any residual balance from float rounding
        if m == months - 1:
            principal = outstanding
            payment = principal + interest
        else:
            payment = emi
        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })
        outstanding -= principal

    return rows
