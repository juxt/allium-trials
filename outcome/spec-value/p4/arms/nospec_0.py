def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    if months <= 0:
        return []

    monthly_rate = annual_rate_pct / 100.0 / 12.0

    if monthly_rate == 0.0:
        emi = disbursed / months
    else:
        factor = (1.0 + monthly_rate) ** months
        emi = disbursed * monthly_rate * factor / (factor - 1.0)

    rows = []
    outstanding = disbursed
    for i in range(months):
        interest = outstanding * monthly_rate
        principal = emi - interest
        payment = emi

        # Clear any residual on the final instalment.
        if i == months - 1:
            principal = outstanding
            payment = principal + interest

        row = {
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        }
        rows.append(row)
        outstanding -= principal

    return rows
