from decimal import Decimal, ROUND_HALF_UP


def _r2(x: float) -> float:
    """Round to 2 decimals, half-up."""
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # Add-on (flat) interest on the original principal.
    total_interest = _r2(disbursed * (annual_rate_pct / 100.0) * (months / 12.0))
    per_interest = _r2(total_interest / months)          # equal interest line each period
    emi = _r2((disbursed + total_interest) / months)     # equal instalment each period

    rows = []
    outstanding = disbursed
    interest_charged = 0.0

    for i in range(months):
        outstanding_start = _r2(outstanding)

        if i < months - 1:
            interest = per_interest
            principal = _r2(emi - per_interest)
            this_emi = emi
        else:
            # Final period absorbs all rounding residual: close the loan to zero.
            interest = _r2(total_interest - interest_charged)
            principal = _r2(outstanding)
            this_emi = _r2(principal + interest)

        rows.append({
            "emi": this_emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        outstanding = _r2(outstanding - principal)
        interest_charged = _r2(interest_charged + interest)

    return rows
