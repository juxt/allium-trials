def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    total_due = penalty_due + fee_due + interest_due + principal_due

    if total_due <= 0:
        return {
            "penalty": 0.0,
            "fee": 0.0,
            "interest": 0.0,
            "principal": 0.0,
            "unapplied": round(float(payment), 2),
        }

    # Cap the amount we apply at the total due; the rest is unapplied.
    applied = min(payment, total_due)

    result = {
        "penalty": round(applied * (penalty_due / total_due), 2),
        "fee": round(applied * (fee_due / total_due), 2),
        "interest": round(applied * (interest_due / total_due), 2),
        "principal": round(applied * (principal_due / total_due), 2),
    }
    result["unapplied"] = round(payment - applied, 2)
    return result
