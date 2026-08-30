def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    """Split a payment across amounts due in priority order.

    Priority: penalty, then fee, then interest, then principal. Whatever
    remains after all dues are covered is returned as "unapplied".
    """
    # Guard against negative inputs; treat them as zero.
    remaining = max(0.0, float(payment))
    dues = {
        "penalty": max(0.0, float(penalty_due)),
        "fee": max(0.0, float(fee_due)),
        "interest": max(0.0, float(interest_due)),
        "principal": max(0.0, float(principal_due)),
    }

    allocation = {}
    for bucket in ("penalty", "fee", "interest", "principal"):
        applied = min(remaining, dues[bucket])
        # Round to cents to avoid floating-point drift accumulating.
        applied = round(applied, 2)
        allocation[bucket] = applied
        remaining = round(remaining - applied, 2)

    allocation["unapplied"] = round(max(0.0, remaining), 2)
    return allocation
