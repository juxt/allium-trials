from decimal import Decimal, ROUND_HALF_UP


def _round2(value: float) -> float:
    """Round to 2 decimals using round-half-up."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # Add-on (flat) interest on the ORIGINAL principal.
    total_interest = _round2(disbursed * (annual_rate_pct / 100) * (months / 12))

    # Equal instalment and equal per-period interest line (all periods but the last).
    emi = _round2((disbursed + total_interest) / months)
    per_interest = _round2(total_interest / months)

    rows = []
    outstanding_start = _round2(disbursed)

    for i in range(months):
        if i == months - 1:
            # Final period absorbs any rounding residual.
            interest = _round2(total_interest - per_interest * (months - 1))
            principal = outstanding_start  # closes the loan to exactly zero
            period_emi = _round2(principal + interest)
        else:
            interest = per_interest
            principal = _round2(emi - interest)
            period_emi = emi

        rows.append({
            "emi": period_emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        outstanding_start = _round2(outstanding_start - principal)

    return rows
