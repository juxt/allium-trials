"""Query helpers shared across services and surfaces.

Thin read-side wrappers that keep filter logic in one place. No writes here.
"""

from datetime import datetime, timedelta

import config
from app.models.adjuster import Adjuster
from app.models.appeal import Appeal
from app.models.claim import Claim
from app.models.document import ClaimDocument
from app.models.payment import Payment
from app.models.review import ReviewTask


def claims_for_claimant(claimant_id):
    return Claim.query.filter_by(claimant_id=claimant_id).all()


def claims_for_adjuster(adjuster_id, open_only=True):
    query = Claim.query.filter_by(assigned_adjuster_id=adjuster_id)
    claims = query.all()
    if open_only:
        return [c for c in claims if c.is_open]
    return claims


def submitted_claims():
    return Claim.query.filter_by(status="submitted").all()


def triaged_claims():
    return Claim.query.filter_by(status="triaged").all()


def investigating_claims():
    return Claim.query.filter_by(status="investigating").all()


def claims_breaching_sla(now=None):
    """Investigating claims older than the SLA window."""
    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=config.SLA_DAYS)
    return Claim.query.filter(
        Claim.status == "investigating",
        Claim.investigating_at < cutoff,
    ).all()


def open_tasks_for_adjuster(adjuster_id):
    return ReviewTask.query.filter(
        ReviewTask.adjuster_id == adjuster_id,
        ReviewTask.status.in_(("open", "in_review")),
    ).all()


def outstanding_documents(claim_id):
    docs = ClaimDocument.query.filter_by(claim_id=claim_id).all()
    return [d for d in docs if d.is_requested]


def failed_payments():
    return Payment.query.filter_by(status="failed").all()


def available_adjusters():
    return [a for a in Adjuster.query.all() if a.can_take_claim()]


def open_appeal_for_claim(claim_id):
    appeals = Appeal.query.filter_by(claim_id=claim_id).all()
    for appeal in appeals:
        if not appeal.is_terminal:
            return appeal
    return None
