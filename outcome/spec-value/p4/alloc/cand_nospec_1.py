def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    """Split a payment across amounts due in waterfall order.

    Order of priority: penalty, fee, interest, principal. Whatever remains
    after all dues are covered is returned as "unapplied".
    """
    # Work in integer cents to avoid binary-float drift, then convert back.
    def cents(x):
        return int(round(float(x) * 100))

    remaining = max(cents(payment), 0)
    result = {}
    for key, due in (
        ("penalty", penalty_due),
        ("fee", fee_due),
        ("interest", interest_due),
        ("principal", principal_due),
    ):
        owed = max(cents(due), 0)
        applied = min(remaining, owed)
        result[key] = applied
        remaining -= applied

    result["unapplied"] = remaining
    return {k: v / 100.0 for k, v in result.items()}
