"""Appeal: a claimant's challenge to a denied claim.

Filed within the appeal window after a denial, picked up for review by a
manager, and resolved either ``upheld`` (the original denial stands) or
``overturned`` (the claim is reopened for investigation).
"""

from datetime import datetime

from app.extensions import db

APPEAL_STATUSES = ("filed", "reviewing", "upheld", "overturned")

TERMINAL_APPEAL_STATUSES = ("upheld", "overturned")


class Appeal(db.Model):
    __tablename__ = "appeals"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), nullable=False)

    status = db.Column(
        db.Enum(*APPEAL_STATUSES, name="appeal_status"),
        nullable=False,
        default="filed",
    )

    grounds = db.Column(db.Text, nullable=False)
    decision_notes = db.Column(db.Text, nullable=True)

    filed_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reviewing_at = db.Column(db.DateTime, nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)

    claim = db.relationship("Claim", back_populates="appeals")

    @property
    def is_terminal(self):
        return self.status in TERMINAL_APPEAL_STATUSES

    def __repr__(self):
        return f"<Appeal {self.id} {self.status}>"
