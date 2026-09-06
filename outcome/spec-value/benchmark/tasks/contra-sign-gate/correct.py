def account_balance(normal_side, is_contra, debits, credits):
    """Compute an account's reporting balance.
    normal_side: 'debit' or 'credit' (the account type's normal side).
    is_contra: a contra account (e.g. accumulated depreciation) FLIPS its normal side.
    Balance is positive on the (effective) normal side."""
    effective_debit_normal = (normal_side == 'debit') != is_contra   # XOR: contra flips it
    return (debits - credits) if effective_debit_normal else (credits - debits)
