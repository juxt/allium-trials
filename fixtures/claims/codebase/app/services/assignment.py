"""Assigning triaged claims to adjusters and moving them into investigation.

A manager (or the assignment sweep) picks an available adjuster for a
triaged claim. Assignment moves the claim into ``investigating`` and opens
an investigation review task for the adjuster.
"""

from datetime import datetime

from app.extensions import db
from app.models.adjuster import Adjuster
from app.models.review import ReviewTask
from app.services import audit


class AssignmentError(Exception):
    """Raised when a claim cannot be assigned to an adjuster."""


def assign_claim(claim, adjuster):
    """Assign a triaged claim and start investigating it.

    Valid only out of ``triaged``. The adjuster must have capacity.
    """
    if claim.status != "triaged":
        raise AssignmentError("only triaged claims can be assigned")
    if not adjuster.can_take_claim():
        raise AssignmentError("adjuster cannot take another claim")

    claim.assigned_adjuster_id = adjuster.id
    claim.status = "investigating"
    claim.investigating_at = datetime.utcnow()

    task = ReviewTask(
        claim_id=claim.id,
        adjuster_id=adjuster.id,
        kind="investigation",
        status="open",
    )
    db.session.add(task)
    db.session.commit()

    audit.record_transition("claim", claim.id, "triaged", claim.status)
    return task


def pick_available_adjuster():
    """Return the least-loaded adjuster who can take a claim, or None."""
    candidates = [a for a in Adjuster.query.all() if a.can_take_claim()]
    if not candidates:
        return None
    return min(candidates, key=lambda a: a.open_claim_count())


def start_review_task(task):
    """Adjuster picks up an open review task: open -> in_review."""
    if task.status != "open":
        raise AssignmentError("only open tasks can be started")
    task.status = "in_review"
    task.started_at = datetime.utcnow()
    db.session.commit()
    return task


def resolve_review_task(task):
    """Adjuster closes a review task: in_review -> resolved."""
    if task.status != "in_review":
        raise AssignmentError("only in-review tasks can be resolved")
    task.status = "resolved"
    task.resolved_at = datetime.utcnow()
    db.session.commit()
    return task


def cancel_review_task(task):
    """Drop a task that is no longer relevant: open/in_review -> cancelled."""
    if not task.is_active:
        raise AssignmentError("only active tasks can be cancelled")
    task.status = "cancelled"
    task.cancelled_at = datetime.utcnow()
    db.session.commit()
    return task
