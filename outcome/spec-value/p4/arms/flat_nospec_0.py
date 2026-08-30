def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    """Equal-monthly-instalment consumer loan repayment schedule.

    Returns a list of `months` rows, each a dict with float values:
      "outstanding_start", "emi", "interest", "principal".

    Monetary amounts are rounded to 2 decimal places (currency minor units).
    The final instalment absorbs accumulated rounding so the loan closes at
    exactly zero outstanding.
    """
    if months <= 0:
        return []

    def cents(x: float) -> float:
        # Round half away from zero at 2 dp, matching typical money rounding.
        return float(int(x * 100 + (0.5 if x >= 0 else -0.5)) / 100.0)

    principal_total = cents(disbursed)
    r = annual_rate_pct / 100.0 / 12.0

    # Flat (zero-interest) case: equal principal, no interest.
    if r == 0.0:
        emi = cents(principal_total / months)
    else:
        factor = (1.0 + r) ** months
        emi = cents(principal_total * r * factor / (factor - 1.0))

    rows = []
    outstanding = principal_total
    for m in range(months):
        if m == months - 1:
            # Final row: clear the balance exactly.
            interest = cents(outstanding * r)
            principal = outstanding
            emi_row = cents(principal + interest)
        else:
            interest = cents(outstanding * r)
            principal = cents(emi - interest)
            # Never amortise more than what is owed.
            if principal > outstanding:
                principal = outstanding
            emi_row = emi

        rows.append({
            "outstanding_start": float(outstanding),
            "emi": float(emi_row),
            "interest": float(interest),
            "principal": float(principal),
        })
        outstanding = cents(outstanding - principal)

    return rows
