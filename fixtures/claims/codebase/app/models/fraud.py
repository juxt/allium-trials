"""FraudCheck: the outcome of the external fraud-scoring service.

A check is opened when a claim is triaged and a scoring request is posted to
the fraud API. The service answers asynchronously over its webhook, moving
the check from ``pending`` to either ``clear`` or ``flagged``.
"""

from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB

from app.extensions import db

FRAUD_CHECK_STATUSES = ("pending", "clear", "flagged")


class FraudCheck(db.Model):
    __tablename__ = "fraud_checks"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), nullable=False)

    status = db.Column(
        db.Enum(*FRAUD_CHECK_STATUSES, name="fraud_check_status"),
        nullable=False,
        default="pending",
    )

    vendor_reference = db.Column(db.String(64), unique=True, nullable=True)
    score = db.Column(db.Integer, nullable=True)
    signals = db.Column(JSONB, nullable=False, default=dict)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)

    claim = db.relationship("Claim", back_populates="fraud_checks")

    @property
    def is_resolved(self):
        return self.status in ("clear", "flagged")

    def __repr__(self):
        return f"<FraudCheck {self.id} {self.status}>"
