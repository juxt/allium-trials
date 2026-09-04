ORDER = [
    ("PAST_DUE","PENALTY"),("PAST_DUE","FEE"),("PAST_DUE","PRINCIPAL"),("PAST_DUE","INTEREST"),
    ("DUE","PENALTY"),("DUE","FEE"),("DUE","PRINCIPAL"),("DUE","INTEREST"),
    ("IN_ADVANCE","PENALTY"),("IN_ADVANCE","FEE"),("IN_ADVANCE","PRINCIPAL"),("IN_ADVANCE","INTEREST"),
]
def allocate(payment, owed):
    remaining = payment; out = {}
    for key in ORDER:
        pay = min(remaining, owed.get(key, 0))
        if pay > 0:
            out[key] = pay; remaining -= pay
    return out
