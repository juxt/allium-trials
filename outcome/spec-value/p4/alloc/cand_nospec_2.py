def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    """Split a payment across amounts due in priority order.

    Order: penalty -> fee -> interest -> principal. Whatever remains
    after all dues are covered is returned as "unapplied".
    """
    def clean(x):
        # Treat negatives as zero; work in rounded cents to avoid float drift.
        x = float(x)
        return round(x, 2) if x > 0 else 0.0

    remaining = clean(payment)
    result = {}

    for key, due in (
        ("penalty", penalty_due),
        ("fee", fee_due),
        ("interest", interest_due),
        ("principal", principal_due),
    ):
        due = clean(due)
        applied = min(remaining, due)
        result[key] = round(applied, 2)
        remaining = round(remaining - applied, 2)

    result["unapplied"] = round(remaining, 2)
    return result
