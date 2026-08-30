from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    # list of length months; each element a dict with float keys "emi","interest","principal","outstanding_start"

    def r2(x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    disbursed_d = Decimal(str(disbursed))
    rate_d = Decimal(str(annual_rate_pct))
    months_d = Decimal(months)

    # Add-on (flat) interest on the original principal.
    total_interest = r2(disbursed_d * (rate_d / Decimal(100)) * (months_d / Decimal(12)))
    # Equal instalment for all periods except the last.
    emi = r2((disbursed_d + total_interest) / months_d)
    # Equal interest line every period.
    period_interest = r2(total_interest / months_d)

    result = []
    outstanding = r2(disbursed_d)
    interest_charged = Decimal("0.00")

    for period in range(1, months + 1):
        outstanding_start = outstanding

        if period < months:
            interest = period_interest
            principal = r2(emi - interest)
            emi_line = emi
        else:
            # Final period absorbs any rounding residual and closes the loan to zero.
            interest = r2(total_interest - interest_charged)
            principal = outstanding_start
            emi_line = r2(principal + interest)

        interest_charged += interest
        outstanding = r2(outstanding_start - principal)

        result.append({
            "emi": float(emi_line),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

    return result
