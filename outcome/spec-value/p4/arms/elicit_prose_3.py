from decimal import Decimal, ROUND_HALF_UP


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    def r2(x) -> float:
        return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    # Flat / add-on interest: total interest charged up front over the whole term.
    total_interest = r2(disbursed * (annual_rate_pct / 100.0) * (months / 12.0))

    # Equal instalment for every period except the last.
    emi = r2((disbursed + total_interest) / months)
    per_interest = r2(total_interest / months)

    rows = []
    outstanding = disbursed
    interest_charged = 0.0

    for i in range(months):
        outstanding_start = r2(outstanding)

        if i < months - 1:
            interest = per_interest
            principal = r2(emi - interest)
            row_emi = emi
        else:
            # Final period absorbs all rounding residual.
            interest = r2(total_interest - interest_charged)
            principal = outstanding_start  # remaining outstanding -> closes to zero
            row_emi = r2(principal + interest)

        rows.append({
            "emi": row_emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": outstanding_start,
        })

        interest_charged = r2(interest_charged + interest)
        outstanding = r2(outstanding - principal)

    return rows
