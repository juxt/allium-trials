"""Claim: the unit of work tracked from intake through settlement."""

import secrets
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB

from app.extensions import db

CLAIM_STATUSES = (
    "submitted",
    "triaged",
    "investigating",
    "escalated",
    "approved",
    "denied",
    "settling",
    "settled",
    "withdrawn",
)

# Statuses from which a claimant may still pull a claim back.
NON_TERMINAL_STATUSES = (
    "submitted",
    "triaged",
    "investigating",
    "escalated",
    "approved",
    "settling",
)

TERMINAL_STATUSES = ("settled", "denied", "withdrawn")


def _new_reference():
    return secrets.token_urlsafe(12)


class Claim(db.Model):
    __tablename__ = "claims"

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(
        db.String(32), unique=True, nullable=False, default=_new_reference
    )
    status = db.Column(
        db.Enum(*CLAIM_STATUSES, name="claim_status"),
        nullable=False,
        default="submitted",
    )

    claimant_id = db.Column(
        db.Integer, db.ForeignKey("claimants.id"), nullable=False
    )
    policy_id = db.Column(db.Integer, db.ForeignKey("policies.id"), nullable=False)
    assigned_adjuster_id = db.Column(
        db.Integer, db.ForeignKey("adjusters.id"), nullable=True
    )

    peril = db.Column(db.String(64), nullable=False)
    description = db.Column(db.Text, nullable=True)
    amount_claimed = db.Column(db.Integer, nullable=False)
    amount_approved = db.Column(db.Integer, nullable=True)

    incident_date = db.Column(db.DateTime, nullable=False)
    details = db.Column("metadata", JSONB, nullable=False, default=dict)

    denial_reason = db.Column(db.Text, nullable=True)

    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    triaged_at = db.Column(db.DateTime, nullable=True)
    investigating_at = db.Column(db.DateTime, nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)
    settled_at = db.Column(db.DateTime, nullable=True)

    claimant = db.relationship("Claimant")
    policy = db.relationship("Policy")
    assigned_adjuster = db.relationship("Adjuster")

    documents = db.relationship(
        "ClaimDocument",
        back_populates="claim",
        order_by="ClaimDocument.requested_at",
    )
    fraud_checks = db.relationship(
        "FraudCheck",
        back_populates="claim",
        order_by="FraudCheck.created_at",
    )
    payments = db.relationship(
        "Payment", back_populates="claim", order_by="Payment.created_at"
    )
    review_tasks = db.relationship("ReviewTask", back_populates="claim")
    appeals = db.relationship("Appeal", back_populates="claim")

    @property
    def is_terminal(self):
        return self.status in TERMINAL_STATUSES

    @property
    def is_open(self):
        return self.status in NON_TERMINAL_STATUSES

    def latest_fraud_check(self):
        if not self.fraud_checks:
            return None
        return self.fraud_checks[-1]

    def has_clear_fraud_check(self):
        """One half of the approval precondition (the rest lives in the
        service layer and the route): the fraud-scoring service must have
        come back clear for this claim."""
        check = self.latest_fraud_check()
        return check is not None and check.status == "clear"

    def required_documents_verified(self):
        """Every requested document must be verified before a decision."""
        relevant = [d for d in self.documents if not d.is_rejected]
        if not relevant:
            return False
        return all(doc.is_verified for doc in relevant)

    def __repr__(self):
        return f"<Claim {self.id} {self.status}>"
