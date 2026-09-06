def build(base_assets, base_liab, base_equity, accrual):
    """Build a balance sheet after posting an accrual. Precondition: the base balances
    (base_assets == base_liab + base_equity). The accrual raises assets and equity equally."""
    assets = base_assets + accrual
    liabilities = base_liab
    equity = base_equity + accrual
    return {"assets": assets, "liabilities": liabilities, "equity": equity}
