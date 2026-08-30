from decimal import Decimal, ROUND_HALF_EVEN


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    D = lambda x: Decimal(str(x))

    def r2(x):
        return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)

    disb = D(disbursed)
    factor = D(annual_rate_pct) / D(1200)
    fee = r2(disb * D("0.0025"))

    if factor == 0:
        base_emi = r2(disb / D(months))
    else:
        g = (D(1) + factor) ** months
        base_emi = r2(disb * factor * g / (g - D(1)))

    rows = []
    balance = disb  # exact running balance; period 0 uses unrounded disbursed
    for index in range(months):
        pure_int = r2(balance * factor)
        outstanding_start = r2(balance)

        if index < months - 1:
            principal = r2(base_emi - pure_int)
            emi = r2(base_emi + fee)
        else:
            principal = balance
            emi = r2(r2(pure_int + balance) + fee)

        interest = r2(pure_int + fee)

        rows.append({
            "emi": float(emi),
            "interest": float(interest),
            "principal": float(principal),
            "outstanding_start": float(outstanding_start),
        })

        balance = r2(balance - principal)

    return rows
