def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    monthly_rate_factor = annual_rate_pct / 1200
    service_fee_monthly = round(disbursed * 0.0025, 2)
    
    if annual_rate_pct == 0:
        base_emi_amount = round(disbursed / months, 2)
    else:
        r = monthly_rate_factor
        compound = (1 + r) ** months
        base_emi_amount = round(disbursed * r * compound / (compound - 1), 2)
    
    periods = []
    outstanding_start = disbursed
    
    for period_index in range(months):
        r = monthly_rate_factor
        is_final = period_index == months - 1
        
        pure_interest = round(outstanding_start * r, 2)
        
        if is_final:
            principal_portion = outstanding_start
            base_instalment = round(pure_interest + principal_portion, 2)
        else:
            principal_portion = round(base_emi_amount - pure_interest, 2)
            base_instalment = base_emi_amount
        
        emi = round(base_instalment + service_fee_monthly, 2)
        interest_reported = round(pure_interest + service_fee_monthly, 2)
        outstanding_end = round(outstanding_start - principal_portion, 2)
        
        periods.append({
            "emi": emi,
            "interest": interest_reported,
            "principal": principal_portion,
            "outstanding_start": outstanding_start
        })
        
        outstanding_start = outstanding_end
    
    return periods
