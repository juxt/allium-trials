"""Payment allocation in Fineract's default order: PAST_DUE > DUE > IN_ADVANCE, and within each,
PENALTY > FEE > PRINCIPAL > INTEREST. A payment fills buckets in this order until exhausted."""
ORDER = [
    ("PAST_DUE","PENALTY"),("PAST_DUE","FEE"),("PAST_DUE","PRINCIPAL"),("PAST_DUE","INTEREST"),
    ("DUE","PENALTY"),("DUE","FEE"),("DUE","PRINCIPAL"),("DUE","INTEREST"),
    ("IN_ADVANCE","PENALTY"),("IN_ADVANCE","FEE"),("IN_ADVANCE","PRINCIPAL"),("IN_ADVANCE","INTEREST"),
]
def allocate(payment, owed):
    """owed: dict {(due,alloc): amount}. Returns dict of allocations in priority order."""
    remaining = payment
    out = {}
    for key in ORDER:
        o = owed.get(key, 0)
        pay = min(remaining, o)
        if pay > 0:
            out[key] = pay
            remaining -= pay
    return out
