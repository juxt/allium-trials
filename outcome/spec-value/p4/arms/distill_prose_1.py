def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    from decimal import Decimal, ROUND_HALF_EVEN
    
    def round_2dp(value):
        return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))
    
    f = annual_rate_pct / 1200
    fee = round_2dp(disbursed * 0.0025)
    
    if annual_rate_pct == 0:
        base_emi = round_2dp(disbursed / months)
    else:
        factor = (1 + f) ** months
        base_emi = round_2dp(disbursed * f * factor / (factor - 1))
    
    result = []
    outstanding = disbursed
    
    for period in range(1, months + 1):
        outstanding_start = outstanding
        pure_interest = round_2dp(outstanding * f)
        
        if period < months:
            principal_repaid = round_2dp(base_emi - pure_interest)
            interest_reported = round_2dp(pure_interest + fee)
            emi_paid = round_2dp(base_emi + fee)
            outstanding = round_2dp(outstanding - principal_repaid)
        else:
            principal_repaid = outstanding
            interest_reported = round_2dp(pure_interest + fee)
            emi_paid = round_2dp(pure_interest + principal_repaid + fee)
            outstanding = 0
        
        result.append({
            "emi": emi_paid,
            "interest": interest_reported,
            "principal": principal_repaid,
            "outstanding_start": outstanding_start
        })
    
    return result
