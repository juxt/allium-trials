from decimal import Decimal, ROUND_HALF_UP


def _r(x: float) -> float:
    """Round to 2 decimals, half-up."""
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # Add-on (flat) interest on the ORIGINAL principal.
    total_interest = _r(disbursed * (annual_rate_pct / 100) * (months / 12))

    # Equal figures for every period except the last.
    emi = _r((disbursed + total_interest) / months)
    interest_line = _r(total_interest / months)

    rows = []
    outstanding = _r(disbursed)   # outstanding principal at start of the loan
    interest_charged = 0.0        # interest lines booked in non-final periods

    for period in range(months):
        start = outstanding

        if period == months - 1:
            # Final period absorbs all rounding residual.
            principal = start                              # closes loan to exactly zero
            interest = _r(total_interest - interest_charged)
            this_emi = _r(principal + interest)
        else:
            interest = interest_line
            principal = _r(emi - interest_line)            # == disbursed/months, keeps emi = interest + principal
            this_emi = emi
            interest_charged = _r(interest_charged + interest)

        outstanding = _r(start - principal)

        rows.append({
            "emi": this_emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": start,
        })

    return rows
