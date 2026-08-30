from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    cents = Decimal("0.01")

    def r(x: Decimal) -> Decimal:
        return x.quantize(cents, rounding=ROUND_HALF_UP)

    principal_total = Decimal(str(disbursed))
    rate = Decimal(str(annual_rate_pct)) / Decimal("100")
    term_years = Decimal(months) / Decimal("12")

    total_interest = principal_total * rate * term_years
    total_interest_r = r(total_interest)
    per_interest = r(total_interest / Decimal(months))
    emi = r((principal_total + total_interest) / Decimal(months))

    rows = []
    outstanding = principal_total          # remaining principal
    interest_charged = Decimal("0.00")

    for i in range(months):
        start = outstanding
        if i == months - 1:
            # final period absorbs all rounding residual
            interest_line = total_interest_r - interest_charged
            principal = start
            emi_i = principal + interest_line
        else:
            interest_line = per_interest
            principal = emi - interest_line
            emi_i = emi

        interest_charged += interest_line
        outstanding = start - principal

        rows.append({
            "emi": float(emi_i),
            "interest": float(interest_line),
            "principal": float(principal),
            "outstanding_start": float(start),
        })

    return rows
