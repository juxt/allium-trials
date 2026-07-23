"""Appeals against denied claims.

A claimant may file an appeal within the appeal window after a denial. A
manager picks it up for review, then either upholds the denial (the claim
stays denied) or overturns it (the claim is reopened into investigation).
"""

from datetime import datetime, timedelta

import config
from app.extensions import db
from app.models.appeal import Appeal
from app.services import audit, cache, email


class AppealError(Exception):
    """Raised when an appeal action is not allowed."""


def appeal_window_open(claim, now=None):
    """Whether a denied claim is still inside its appeal window."""
    if claim.status != "denied" or claim.decided_at is None:
        return False
    now = now or datetime.utcnow()
    deadline = claim.decided_at + timedelta(days=config.APPEAL_WINDOW_DAYS)
    return now <= deadline


def file_appeal(claim, grounds):
    """File an appeal on a denied claim within the appeal window."""
    if claim.status != "denied":
        raise AppealError("only denied claims can be appealed")
    if not appeal_window_open(claim):
        raise AppealError("the appeal window has closed")
    if any(not a.is_terminal for a in claim.appeals):
        raise AppealError("an appeal is already in progress")

    appeal = Appeal(claim_id=claim.id, grounds=grounds, status="filed")
    db.session.add(appeal)
    db.session.commit()

    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_APPEAL_RECEIVED,
        {"reference": claim.reference},
    )
    return appeal


def start_appeal_review(appeal):
    """Manager begins reviewing a filed appeal: filed -> reviewing."""
    if appeal.status != "filed":
        raise AppealError("only filed appeals can move to review")
    appeal.status = "reviewing"
    appeal.reviewing_at = datetime.utcnow()
    db.session.commit()
    return appeal


def uphold_appeal(appeal, notes):
    """Reject the appeal: reviewing -> upheld; the denial stands."""
    if appeal.status != "reviewing":
        raise AppealError("only appeals under review can be decided")
    appeal.status = "upheld"
    appeal.decision_notes = notes
    appeal.decided_at = datetime.utcnow()
    db.session.commit()

    email.send_templated_email(
        appeal.claim.claimant.email,
        email.TEMPLATE_APPEAL_DECISION,
        {"reference": appeal.claim.reference, "outcome": "upheld"},
    )
    return appeal


def overturn_appeal(appeal, notes):
    """Grant the appeal: reviewing -> overturned and reopen the claim.

    Overturning sends the underlying claim back into ``investigating`` so a
    fresh decision can be made.
    """
    if appeal.status != "reviewing":
        raise AppealError("only appeals under review can be decided")
    appeal.status = "overturned"
    appeal.decision_notes = notes
    appeal.decided_at = datetime.utcnow()

    claim = appeal.claim
    claim.status = "investigating"
    claim.denial_reason = None
    claim.decided_at = None
    db.session.commit()

    audit.record_transition("appeal", appeal.id, "reviewing", appeal.status)
    audit.record_transition("claim", claim.id, "denied", claim.status)
    cache.invalidate_status(claim.reference)
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_APPEAL_DECISION,
        {"reference": claim.reference, "outcome": "overturned"},
    )
    return appeal
