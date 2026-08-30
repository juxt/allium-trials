from decimal import Decimal, ROUND_HALF_EVEN


def _r(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN))


def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    f = annual_rate_pct / 1200

    fee = _r(disbursed * 0.0025)

    if f == 0:
        base_emi = _r(disbursed / months)
    else:
        base_emi = _r(disbursed * f * (1 + f) ** months / ((1 + f) ** months - 1))

    rows = []
    bal = disbursed
    for i in range(months):
        pure_int = _r(bal * f)

        if i == months - 1:
            principal = bal
            base_inst = _r(pure_int + principal)
        else:
            principal = _r(base_emi - pure_int)
            base_inst = base_emi

        interest = _r(pure_int + fee)
        emi = _r(base_inst + fee)

        rows.append({
            "outstanding_start": _r(bal),
            "emi": emi,
            "interest": interest,
            "principal": principal,
        })

        bal = _r(bal - principal)

    return rows
