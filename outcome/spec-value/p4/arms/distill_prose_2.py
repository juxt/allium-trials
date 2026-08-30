def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    from decimal import Decimal, ROUND_HALF_UP

    def round2(x):
        return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    total_interest = round2(disbursed * (annual_rate_pct / 100) * (months / 12))
    per_int = round2(total_interest / months)
    last_interest = round2(total_interest - per_int * (months - 1))
    emi = round2((disbursed + total_interest) / months)
    principal = round2(emi - per_int)

    rows = []
    balance = round2(disbursed)
    for m in range(months):
        outstanding_start = round2(balance)
        if m == months - 1:
            last_principal = outstanding_start
            last_instalment = round2(last_interest + last_principal)
            rows.append({
                "emi": last_instalment,
                "interest": last_interest,
                "principal": last_principal,
                "outstanding_start": outstanding_start,
            })
            balance = round2(balance - last_principal)
        else:
            rows.append({
                "emi": emi,
                "interest": per_int,
                "principal": principal,
                "outstanding_start": outstanding_start,
            })
            balance = round2(balance - principal)
    return rows
