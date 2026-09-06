def build(base_assets, base_liab, base_equity, accrual):
    assets = base_assets + accrual
    liabilities = base_liab
    equity = base_equity + (accrual // 2) + (accrual // 2)   # BUG: loses $1 for odd accrual
    return {"assets": assets, "liabilities": liabilities, "equity": equity}
