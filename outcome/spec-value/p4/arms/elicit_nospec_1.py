def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # Equal-instalment (amortising) loan schedule.
    # Each period: interest accrues on the outstanding balance, the fixed EMI
    # pays that interest first, the remainder reduces principal. The final
    # instalment is adjusted so the loan closes exactly at zero.
    if months <= 0:
        return []

    r = annual_rate_pct / 100.0 / 12.0  # monthly rate

    if r == 0:
        emi = round(disbursed / months, 2)
    else:
        factor = (1 + r) ** months
        emi = round(disbursed * r * factor / (factor - 1), 2)

    rows = []
    outstanding = round(disbursed, 2)

    for i in range(months):
        interest = round(outstanding * r, 2)

        if i == months - 1:
            # Close out the loan exactly: last instalment clears the balance.
            principal = outstanding
            payment = round(principal + interest, 2)
        else:
            principal = round(emi - interest, 2)
            payment = emi

        rows.append({
            "emi": float(payment),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding),
        })

        outstanding = round(outstanding - principal, 2)

    return rows
