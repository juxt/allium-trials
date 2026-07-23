"""Claim decisions: approve, deny, escalate.

Approval is the most heavily guarded transition. Its full precondition is
deliberately spread across three layers:

* the model knows whether the fraud check came back clear and whether the
  requested documents are all verified (Claim.has_clear_fraud_check /
  Claim.required_documents_verified),
* this service knows whether the loss is actually covered by the policy
  (within coverage limit, peril covered, policy in force) -- see
  ``within_policy_coverage`` below,
* the calling route knows the actor is an adjuster or manager and that the
  claim is in a decidable state.

All three must hold for ``approve_claim`` to succeed.
"""

from datetime import datetime

from app.extensions import db
from app.services import audit, cache, email, policy_eval

# A claim can be decided while it is being investigated or after it has been
# escalated to a senior adjuster.
DECIDABLE_STATUSES = ("investigating", "escalated")


class DecisionError(Exception):
    """Raised when a decision is not allowed for the claim."""


def within_policy_coverage(claim):
    """The coverage half of the approval precondition.

    The policy must be in force on the incident date, must cover the claimed
    peril, and the claimed amount must sit within the remaining coverage
    limit. This is intentionally the only place the coverage maths lives.
    """
    return bool(policy_eval.evaluate(claim))


def _payable_amount(claim):
    """Amount we would settle: claim capped at the limit, less deductible."""
    return policy_eval.evaluate(claim).payable


def approve_claim(claim):
    """Approve a decidable claim once every control is satisfied.

    Combines the three scattered halves of the precondition: a clear fraud
    check, all requested documents verified, and the loss within policy
    coverage.
    """
    if claim.status not in DECIDABLE_STATUSES:
        raise DecisionError("claim is not in a decidable state")
    if not claim.has_clear_fraud_check():
        raise DecisionError("fraud check has not cleared")
    if not claim.required_documents_verified():
        raise DecisionError("not all requested documents are verified")
    if not within_policy_coverage(claim):
        raise DecisionError("loss is not within policy coverage")

    previous = claim.status
    claim.status = "approved"
    claim.amount_approved = _payable_amount(claim)
    claim.decided_at = datetime.utcnow()
    db.session.commit()

    audit.record_transition("claim", claim.id, previous, claim.status)
    cache.invalidate_status(claim.reference)
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_CLAIM_APPROVED,
        {"reference": claim.reference, "amount": claim.amount_approved},
    )
    return claim


def deny_claim(claim, reason):
    """Deny a decidable claim, recording the reason."""
    if claim.status not in DECIDABLE_STATUSES:
        raise DecisionError("claim is not in a decidable state")

    previous = claim.status
    claim.status = "denied"
    claim.denial_reason = reason
    claim.decided_at = datetime.utcnow()
    db.session.commit()

    audit.record_transition("claim", claim.id, previous, claim.status)
    cache.invalidate_status(claim.reference)
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_CLAIM_DENIED,
        {"reference": claim.reference, "reason": reason},
    )
    return claim


def escalate_claim(claim):
    """Escalate an investigating claim to senior review.

    Valid only out of ``investigating``. The escalated claim stays decidable
    (it can later be approved or denied).
    """
    if claim.status != "investigating":
        raise DecisionError("only investigating claims can be escalated")

    claim.status = "escalated"
    db.session.commit()

    audit.record_transition("claim", claim.id, "investigating", claim.status)
    cache.invalidate_status(claim.reference)
    return claim
