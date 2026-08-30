def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # list of length months; each element a dict with float keys
    # "emi","interest","principal","outstanding_start"
    r = annual_rate_pct / 100.0 / 12.0

    if r == 0:
        emi = round(disbursed / months, 2)
    else:
        factor = (1 + r) ** months
        emi = round(disbursed * r * factor / (factor - 1), 2)

    rows = []
    outstanding = disbursed
    for m in range(months):
        outstanding_start = outstanding
        interest = round(outstanding_start * r, 2)

        if m == months - 1:
            # final instalment clears the balance exactly, absorbing rounding drift
            principal = outstanding_start
            this_emi = round(principal + interest, 2)
        else:
            principal = round(emi - interest, 2)
            this_emi = emi

        outstanding = round(outstanding_start - principal, 2)

        rows.append({
            "emi": float(this_emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
