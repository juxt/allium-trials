from decimal import Decimal, ROUND_HALF_EVEN


def _r2(x):
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200
    fee = _r2(disbursed * 0.0025)

    if f == 0:
        base = _r2(disbursed / months)
    else:
        base = _r2(disbursed * f * (1 + f) ** months / ((1 + f) ** months - 1))

    rows = []
    bal = disbursed
    for i in range(months):
        is_final = i == months - 1
        pure = _r2(bal * f)

        if is_final:
            principal = bal
            base_inst = _r2(pure + bal)
        else:
            principal = _r2(base - pure)
            base_inst = base

        emi = _r2(base_inst + fee)
        interest = _r2(pure + fee)

        rows.append({
            "emi": emi,
            "interest": interest,
            "principal": principal,
            "outstanding_start": bal,
        })

        bal = _r2(bal - principal)

    return rows
