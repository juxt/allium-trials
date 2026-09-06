def build(notional, lei_present):
    """Build a transaction report record. Rule: a notional over 1,000,000 REQUIRES an LEI."""
    if notional > 1000000 and not lei_present:
        raise ValueError("LEI required for notional over 1,000,000")
    return {"notional": notional, "has_lei": lei_present}
