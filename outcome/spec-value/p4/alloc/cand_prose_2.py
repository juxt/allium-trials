def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    # keys: "penalty","fee","interest","principal","unapplied" (floats)
    total_due = penalty_due + fee_due + interest_due + principal_due

    # No dues: nothing can be applied; the whole payment is unapplied.
    if total_due <= 0:
        return {
            "penalty": 0.0,
            "fee": 0.0,
            "interest": 0.0,
            "principal": 0.0,
            "unapplied": round(float(payment), 2),
        }

    # Cap the amount we actually apply at the total due; the rest is unapplied.
    applied = min(payment, total_due)
    unapplied = payment - applied

    # Pro-rata split of the applied amount across each due, rounded to 2 dp.
    return {
        "penalty": round(applied * (penalty_due / total_due), 2),
        "fee": round(applied * (fee_due / total_due), 2),
        "interest": round(applied * (interest_due / total_due), 2),
        "principal": round(applied * (principal_due / total_due), 2),
        "unapplied": round(unapplied, 2),
    }
