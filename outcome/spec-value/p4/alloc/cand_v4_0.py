def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    # Spec: Allocation component, PRO-RATA split.
    #   total_due  = penalty_due + fee_due + interest_due + principal_due
    #   X_applied  = payment * X_due / total_due   (for each due)
    # The four proportions sum to 1, so when there are dues to allocate
    # against the whole payment is distributed and nothing is left unapplied.
    payment = float(payment)
    penalty_due = float(penalty_due)
    fee_due = float(fee_due)
    interest_due = float(interest_due)
    principal_due = float(principal_due)

    total_due = penalty_due + fee_due + interest_due + principal_due

    if total_due == 0.0:
        # No dues to apportion against: nothing can be allocated pro-rata.
        return {
            "penalty": 0.0,
            "fee": 0.0,
            "interest": 0.0,
            "principal": 0.0,
            "unapplied": payment,
        }

    pen_applied = payment * penalty_due / total_due
    fee_applied = payment * fee_due / total_due
    int_applied = payment * interest_due / total_due
    prin_applied = payment * principal_due / total_due

    return {
        "penalty": pen_applied,
        "fee": fee_applied,
        "interest": int_applied,
        "principal": prin_applied,
        "unapplied": payment - (pen_applied + fee_applied + int_applied + prin_applied),
    }
