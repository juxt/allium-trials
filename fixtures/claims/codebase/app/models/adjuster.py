"""Adjuster: a staff member who investigates and decides claims.

Adjusters are an actor, not a workflow entity: they have an availability
flag and a load cap, but no status lifecycle of their own.
"""

from datetime import datetime

from app.extensions import db


class Adjuster(db.Model):
    __tablename__ = "adjusters"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)

    is_available = db.Column(db.Boolean, nullable=False, default=True)
    max_open_claims = db.Column(db.Integer, nullable=False, default=25)
    specialties = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    assigned_claims = db.relationship(
        "Claim", back_populates="assigned_adjuster"
    )
    review_tasks = db.relationship("ReviewTask", back_populates="adjuster")

    def open_claim_count(self):
        return sum(1 for claim in self.assigned_claims if claim.is_open)

    def can_take_claim(self):
        return self.is_available and self.open_claim_count() < self.max_open_claims

    def __repr__(self):
        return f"<Adjuster {self.id} {self.email}>"
