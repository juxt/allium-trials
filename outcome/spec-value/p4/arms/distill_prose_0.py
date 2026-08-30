from decimal import Decimal, ROUND_HALF_EVEN

def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    P = Decimal(str(disbursed)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    r = Decimal(str(annual_rate_pct))
    n = months
    
    f = r / Decimal(1200)
    S = (Decimal('0.0025') * P).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    if r == 0:
        base_emi = P / Decimal(n)
    else:
        factor = (1 + f) ** n
        base_emi = P * f * factor / (factor - 1)
    base_emi = base_emi.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    B = P
    result = []
    
    for i in range(1, n + 1):
        outstanding_start = B
        
        I = B * f
        I = I.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        if i == n:
            principal = B
        else:
            principal = base_emi - I
        principal = principal.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        interest_charge = I + S
        interest_charge = interest_charge.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        emi = principal + interest_charge
        emi = emi.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        B = B - principal
        B = B.quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        result.append({
            'outstanding_start': float(outstanding_start),
            'principal': float(principal),
            'interest': float(interest_charge),
            'emi': float(emi)
        })
    
    return result
