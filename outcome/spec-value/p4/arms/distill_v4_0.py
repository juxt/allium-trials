from decimal import Decimal, ROUND_HALF_EVEN

def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    d = Decimal(str(disbursed))
    r = Decimal(str(annual_rate_pct))
    
    f = r / Decimal('1200')
    
    service_fee = d * Decimal('0.0025')
    fee = service_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    if f == 0:
        emi_base = d / Decimal(months)
    else:
        one_plus_f = 1 + f
        compound = one_plus_f ** months
        emi_base = d * f * compound / (compound - 1)
    
    emi_base = emi_base.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    result = []
    
    for idx in range(months):
        is_final = idx == months - 1
        
        if idx == 0:
            bal_start = d
        else:
            prev = result[idx - 1]
            bal_start = Decimal(str(prev['outstanding_start'])) - Decimal(str(prev['principal']))
        
        outstanding_start = bal_start.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        pure_int = (outstanding_start * f).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        if is_final:
            principal = outstanding_start
        else:
            principal = (emi_base - pure_int).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        if is_final:
            base_inst = (pure_int + principal).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        else:
            base_inst = emi_base
        
        interest = (pure_int + fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        emi = (base_inst + fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        result.append({
            'outstanding_start': float(outstanding_start),
            'principal': float(principal),
            'interest': float(interest),
            'emi': float(emi)
        })
    
    return result
