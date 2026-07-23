"""Payment: a settlement disbursement to the claimant.

Created when an approved claim begins settling. The payment processor
acknowledges issue, then later confirms it cleared or that it failed; an
issued payment can be reversed if a clawback is needed.
"""

from datetime import datetime

from app.extensions import db

PAYMENT_STATUSES = ("pending", "issued", "cleared", "failed", "reversed")

TERMINAL_PAYMENT_STATUSES = ("cleared", "failed", "reversed")


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), nullable=False)

    status = db.Column(
        db.Enum(*PAYMENT_STATUSES, name="payment_status"),
        nullable=False,
        default="pending",
    )

    amount = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="GBP")

    processor_reference = db.Column(db.String(64), unique=True, nullable=True)
    failure_reason = db.Column(db.Text, nullable=True)
    retry_count = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    issued_at = db.Column(db.DateTime, nullable=True)
    cleared_at = db.Column(db.DateTime, nullable=True)
    failed_at = db.Column(db.DateTime, nullable=True)
    reversed_at = db.Column(db.DateTime, nullable=True)

    claim = db.relationship("Claim", back_populates="payments")

    @property
    def is_terminal(self):
        return self.status in TERMINAL_PAYMENT_STATUSES

    def __repr__(self):
        return f"<Payment {self.id} {self.status}>"
