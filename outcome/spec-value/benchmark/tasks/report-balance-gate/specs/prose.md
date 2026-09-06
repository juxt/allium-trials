A balance sheet report. INVARIANT (the fundamental accounting identity that MUST hold before the report is
submitted to a regulator): assets == liabilities + equity. build(base_assets, base_liab, base_equity,
accrual) posts an accrual and returns {assets, liabilities, equity}; the base already balances, and the
report must still balance after the accrual, for ANY accrual amount.
