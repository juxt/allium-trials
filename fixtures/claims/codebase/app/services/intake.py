"""Claim intake and automated triage.

Submission creates a claim in ``submitted``. Triage is the automated first
pass: it validates the claim against its policy, opens a fraud check, and
moves the claim to ``triaged`` (queuing it for adjuster assignment). A small
claim that already looks clean can be fast-tracked, but never past the
controls that protect a payout.
"""

from datetime import datetime

import config
from app.extensions import db
from app.models.claim import Claim
from app.models.fraud import FraudCheck  # noqa: F401  relationship target
from app.services import audit, cache, email
from app.services.fraud_client import request_fraud_check


class IntakeError(Exception):
    """Raised when a claim cannot be submitted or triaged."""


def submit_claim(claimant, policy, payload):
    """Open a brand-new claim in the ``submitted`` state."""
    incident_date = datetime.fromisoformat(payload["incident_date"])
    if not policy.is_active_on(incident_date):
        raise IntakeError("policy was not in force on the incident date")

    claim = Claim(
        claimant_id=claimant.id,
        policy_id=policy.id,
        peril=payload["peril"],
        description=payload.get("description"),
        amount_claimed=payload["amount_claimed"],
        incident_date=incident_date,
        details=payload.get("details", {}),
        status="submitted",
    )
    db.session.add(claim)
    db.session.commit()

    audit.record("submit", claim=claim, peril=claim.peril)
    email.send_templated_email(
        claimant.email,
        email.TEMPLATE_CLAIM_RECEIVED,
        {"claimant_name": claimant.full_name, "reference": claim.reference},
    )
    return claim


def triage_claim(claim):
    """Automated triage: open a fraud check and move to ``triaged``.

    Triage is only valid out of ``submitted``. It always opens a fraud
    scoring request so that approval can later be gated on a clear result.
    """
    if claim.status != "submitted":
        raise IntakeError("only submitted claims can be triaged")

    request_fraud_check(claim)

    claim.status = "triaged"
    claim.triaged_at = datetime.utcnow()
    db.session.commit()

    audit.record_transition("claim", claim.id, "submitted", claim.status)
    return claim


def withdraw_claim(claim):
    """Claimant pulls a claim back.

    Allowed from any non-terminal state (submitted, triaged, investigating,
    escalated, approved or settling). Terminal claims cannot be withdrawn.
    """
    if claim.is_terminal:
        raise IntakeError("a finished claim cannot be withdrawn")

    previous = claim.status
    claim.status = "withdrawn"
    db.session.commit()

    audit.record_transition("claim", claim.id, previous, claim.status)
    cache.invalidate_status(claim.reference)
    return claim


def is_auto_approvable(claim):
    """A small claim under the auto-approve threshold may skip manual
    investigation, but only once the same controls that apply to manual
    approval are satisfied (clear fraud check + verified documents). The
    coverage half of the precondition is enforced in the decision service.
    """
    if claim.amount_claimed > config.AUTO_APPROVE_THRESHOLD:
        return False
    if not claim.has_clear_fraud_check():
        return False
    if not claim.required_documents_verified():
        return False
    return True
