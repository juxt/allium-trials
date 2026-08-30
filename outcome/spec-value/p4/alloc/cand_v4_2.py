def allocate(payment, penalty_due, fee_due, interest_due, principal_due) -> dict:
    # PRO-RATA split, per the Allium v4 spec:
    #   total_due  = penalty_due + fee_due + interest_due + principal_due
    #   X_applied  = payment * X_due / total_due
    #
    # The spec's applied amounts are literal proportions of total_due, so when
    # total_due > 0 they sum exactly to `payment` (nothing is left unapplied).
    # The only case with no proportional basis is total_due == 0: there are no
    # dues to allocate against, so the whole payment is unapplied.
    payment = float(payment)
    penalty_due = float(penalty_due)
    fee_due = float(fee_due)
    interest_due = float(interest_due)
    principal_due = float(principal_due)

    total_due = penalty_due + fee_due + interest_due + principal_due

    if total_due == 0:
        return {
            "penalty": 0.0,
            "fee": 0.0,
            "interest": 0.0,
            "principal": 0.0,
            "unapplied": payment,
        }

    penalty = payment * penalty_due / total_due
    fee = payment * fee_due / total_due
    interest = payment * interest_due / total_due
    principal = payment * principal_due / total_due

    unapplied = payment - (penalty + fee + interest + principal)

    return {
        "penalty": penalty,
        "fee": fee,
        "interest": interest,
        "principal": principal,
        "unapplied": unapplied,
    }
