def build(notional, lei_present):
    # BUG: omits the large-notional-requires-LEI enforcement
    return {"notional": notional, "has_lei": lei_present}
