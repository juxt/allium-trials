"""Policy: the insurance contract a claim is made against.

Policies are mastered by a separate policy-admin system and replicated into
ClaimFlow over the policy webhook. We read coverage and limits to decide
claims; we never write a policy here.
"""

from datetime import datetime

from sqlalchemy.dialects.postgresql import ARRAY

from app.extensions import db


class Policy(db.Model):
    __tablename__ = "policies"

    id = db.Column(db.Integer, primary_key=True)
    policy_number = db.Column(db.String(64), unique=True, nullable=False)

    policyholder_id = db.Column(
        db.Integer, db.ForeignKey("claimants.id"), nullable=False
    )

    product = db.Column(db.String(64), nullable=False)
    covered_perils = db.Column(ARRAY(db.String(64)), nullable=False, default=list)
    coverage_limit = db.Column(db.Integer, nullable=False)
    deductible = db.Column(db.Integer, nullable=False, default=0)

    effective_from = db.Column(db.DateTime, nullable=False)
    effective_to = db.Column(db.DateTime, nullable=True)

    cancelled_at = db.Column(db.DateTime, nullable=True)
    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    policyholder = db.relationship("Claimant")

    def is_active_on(self, moment):
        """Whether the policy is in force at the given instant."""
        if self.cancelled_at is not None and self.cancelled_at <= moment:
            return False
        if moment < self.effective_from:
            return False
        if self.effective_to is not None and moment > self.effective_to:
            return False
        return True

    def covers_peril(self, peril):
        return peril in (self.covered_perils or [])

    def __repr__(self):
        return f"<Policy {self.id} {self.policy_number}>"
