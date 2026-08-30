def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    r = annual_rate_pct / 1200.0  # rate_factor: monthly base rate

    if r == 0:
        emi = disbursed / months
    else:
        f = (1 + r) ** months
        emi = disbursed * r * f / (f - 1)

    rows = []
    outstanding = disbursed
    for period in range(months):
        is_last = (period == months - 1)
        interest = outstanding * r

        if is_last:
            # final_payment_clears_outstanding: principal == outstanding_start
            principal = outstanding
            emi_period = interest + principal
        else:
            principal = emi - interest
            emi_period = emi  # emi == interest + principal holds by construction

        rows.append({
            "emi": emi_period,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding,
        })

        outstanding -= principal

    return rows