def schedule(disbursed: float, annual_rate_pct: float, months: int) -> list:
    from decimal import Decimal, ROUND_HALF_EVEN
    
    P = Decimal(str(disbursed))
    rate_pct = Decimal(str(annual_rate_pct))
    n = months
    
    service_fee = (P * Decimal('0.0025')).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    f = rate_pct / Decimal('1200')
    
    if rate_pct == 0:
        base_emi = (P / Decimal(n)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    else:
        factor = (1 + f) ** n
        base_emi = (P * f * factor / (factor - 1)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
    
    result = []
    outstanding = P
    
    for period in range(n):
        start = outstanding
        
        if rate_pct == 0:
            interest = Decimal('0')
        else:
            interest = (outstanding * f).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        is_last = (period == n - 1)
        
        if is_last:
            principal = outstanding
        else:
            principal = (base_emi - interest).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        interest_line = (interest + service_fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        base_for_period = base_emi if not is_last else (interest + principal)
        emi = (base_for_period + service_fee).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN)
        
        outstanding = outstanding - principal
        
        result.append({
            'outstanding_start': float(start),
            'emi': float(emi),
            'interest': float(interest_line),
            'principal': float(principal)
        })
    
    return result
