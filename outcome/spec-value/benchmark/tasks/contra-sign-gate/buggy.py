def account_balance(normal_side, is_contra, debits, credits):
    # BUG: ignores the contra flag — uses the account type's normal side directly
    effective_debit_normal = (normal_side == 'debit')
    return (debits - credits) if effective_debit_normal else (credits - debits)
