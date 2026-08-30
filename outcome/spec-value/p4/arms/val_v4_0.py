def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    rate_factor = round(annual_rate_pct / 1200, 6)
    flat_interest = round(disbursed * rate_factor, 2)
    flat_principal = round(disbursed / months, 2)

    installments = []
    outstanding_start = disbursed
    for period in range(months):
        is_last = (period == months - 1)
        if is_last:
            principal = round(outstanding_start, 2)
        else:
            principal = flat_principal
        interest = flat_interest
        emi = round(interest + principal, 2)
        installments.append({
            "emi": emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": round(outstanding_start, 2),
        })
        outstanding_start = round(outstanding_start - principal, 2)

    return installments