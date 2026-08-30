def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    total_due = penalty_due + fee_due + interest_due + principal_due

    if total_due == 0:
        # Nothing owed: no dues to split across, so the whole payment is unapplied.
        return {
            "penalty": 0.0,
            "fee": 0.0,
            "interest": 0.0,
            "principal": 0.0,
            "unapplied": float(payment),
        }

    penalty = payment * penalty_due / total_due
    fee = payment * fee_due / total_due
    interest = payment * interest_due / total_due
    principal = payment * principal_due / total_due

    unapplied = payment - (penalty + fee + interest + principal)

    return {
        "penalty": float(penalty),
        "fee": float(fee),
        "interest": float(interest),
        "principal": float(principal),
        "unapplied": float(unapplied),
    }
