"""Operational reporting and queue metrics.

Read-only aggregation used by the manager dashboard. No state changes.
"""

from collections import Counter
from datetime import datetime

from app.models.appeal import Appeal
from app.models.claim import Claim
from app.models.payment import Payment
from app.services import repository


def claim_status_breakdown():
    """Count of claims by status."""
    counts = Counter(c.status for c in Claim.query.all())
    return dict(counts)


def payment_status_breakdown():
    counts = Counter(p.status for p in Payment.query.all())
    return dict(counts)


def appeal_status_breakdown():
    counts = Counter(a.status for a in Appeal.query.all())
    return dict(counts)


def adjuster_load():
    """Open-claim count per adjuster, including capacity headroom."""
    rows = []
    for adjuster in repository.available_adjusters():
        open_count = adjuster.open_claim_count()
        rows.append(
            {
                "adjuster_id": adjuster.id,
                "open_claims": open_count,
                "headroom": adjuster.max_open_claims - open_count,
            }
        )
    return rows


def average_decision_age_days(now=None):
    """Mean age in days of claims still awaiting a decision."""
    now = now or datetime.utcnow()
    open_claims = [
        c
        for c in Claim.query.all()
        if c.status in ("investigating", "escalated")
    ]
    if not open_claims:
        return 0.0
    total = sum(
        (now - (c.investigating_at or c.submitted_at)).total_seconds()
        for c in open_claims
    )
    return round(total / len(open_claims) / 86400.0, 2)


def settlement_totals():
    """Sum of cleared payouts and count of cleared payments."""
    cleared = [p for p in Payment.query.all() if p.status == "cleared"]
    return {
        "cleared_count": len(cleared),
        "cleared_amount": sum(p.amount for p in cleared),
    }


def dashboard_snapshot():
    """Everything the ops dashboard needs in one call."""
    return {
        "claims": claim_status_breakdown(),
        "payments": payment_status_breakdown(),
        "appeals": appeal_status_breakdown(),
        "adjuster_load": adjuster_load(),
        "average_decision_age_days": average_decision_age_days(),
        "settlement": settlement_totals(),
    }
