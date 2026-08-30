def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    """Amortising (equal-instalment / EMI) loan repayment schedule."""
    if months <= 0:
        return []

    monthly_rate = (annual_rate_pct / 100.0) / 12.0

    if monthly_rate == 0.0:
        emi = disbursed / months
    else:
        growth = (1.0 + monthly_rate) ** months
        emi = disbursed * monthly_rate * growth / (growth - 1.0)

    emi = round(emi, 2)

    rows = []
    outstanding = round(disbursed, 2)

    for m in range(months):
        outstanding_start = outstanding
        interest = round(outstanding_start * monthly_rate, 2)

        if m == months - 1:
            # Final instalment clears the balance exactly, absorbing rounding drift.
            principal = outstanding_start
            payment = round(principal + interest, 2)
        else:
            principal = round(emi - interest, 2)
            payment = emi

        outstanding = round(outstanding_start - principal, 2)

        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return rows
