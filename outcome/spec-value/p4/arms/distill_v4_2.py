from decimal import Decimal, ROUND_HALF_EVEN

def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    disbursed_d = Decimal(str(disbursed))
    annual_rate_pct_d = Decimal(str(annual_rate_pct))
    months_d = Decimal(months)
    
    rate = annual_rate_pct_d / Decimal('1200')
    
    if rate == 0:
        base_emi_amt = disbursed_d / months_d
    else:
        numerator = disbursed_d * rate * (1 + rate) ** months_d
        denominator = (1 + rate) ** months_d - 1
        base_emi_amt = numerator / denominator
    
    base_emi_amt = base_emi_amt.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    fee = (disbursed_d * Decimal('0.0025')).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    schedule_list = []
    balance = disbursed_d
    
    for i in range(months):
        period = {}
        
        outstanding_start = balance.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        period['outstanding_start'] = float(outstanding_start)
        
        pure_interest = (outstanding_start * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        is_final = (i == months - 1)
        
        if is_final:
            principal = outstanding_start
            emi_base = pure_interest + principal
        else:
            principal = (base_emi_amt - pure_interest).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
            emi_base = base_emi_amt
        
        period['principal'] = float(principal)
        period['interest'] = float((pure_interest + fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))
        period['emi'] = float((emi_base + fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))
        
        schedule_list.append(period)
        
        balance = (balance - principal).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    return schedule_list
