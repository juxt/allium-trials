"""ReviewTask: a unit of human review queued onto an adjuster.

A task is opened when work needs an adjuster's attention (e.g. a freshly
uploaded document, or an escalation). The adjuster picks it up
(``in_review``) and closes it out (``resolved``); a task that is no longer
relevant is ``cancelled``.
"""

from datetime import datetime

from app.extensions import db

REVIEW_TASK_STATUSES = ("open", "in_review", "resolved", "cancelled")

TERMINAL_REVIEW_STATUSES = ("resolved", "cancelled")


class ReviewTask(db.Model):
    __tablename__ = "review_tasks"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), nullable=False)
    adjuster_id = db.Column(
        db.Integer, db.ForeignKey("adjusters.id"), nullable=True
    )

    status = db.Column(
        db.Enum(*REVIEW_TASK_STATUSES, name="review_task_status"),
        nullable=False,
        default="open",
    )

    kind = db.Column(db.String(64), nullable=False)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)

    claim = db.relationship("Claim", back_populates="review_tasks")
    adjuster = db.relationship("Adjuster", back_populates="review_tasks")

    @property
    def is_open(self):
        return self.status == "open"

    @property
    def is_active(self):
        return self.status in ("open", "in_review")

    def __repr__(self):
        return f"<ReviewTask {self.id} {self.status}>"
