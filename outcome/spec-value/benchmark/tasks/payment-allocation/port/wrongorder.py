ORDER = [("IN_ADVANCE","INTEREST"),("IN_ADVANCE","PRINCIPAL"),("IN_ADVANCE","FEE"),("IN_ADVANCE","PENALTY"),
    ("DUE","INTEREST"),("DUE","PRINCIPAL"),("DUE","FEE"),("DUE","PENALTY"),
    ("PAST_DUE","INTEREST"),("PAST_DUE","PRINCIPAL"),("PAST_DUE","FEE"),("PAST_DUE","PENALTY")]
def allocate(payment, owed):
    remaining = payment; out = {}
    for key in ORDER:
        pay = min(remaining, owed.get(key,0))
        if pay > 0: out[key] = pay; remaining -= pay
    return out
