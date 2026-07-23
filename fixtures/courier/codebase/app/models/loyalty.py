"""Loyalty points for repeat senders."""

from datetime import datetime

from app.extensions import db


class LoyaltyPoints(db.Model):
    __tablename__ = "loyalty_points"

    POINTS_PER_PARCEL = 10
    TIER_THRESHOLDS = {"bronze": 0, "silver": 500, "gold": 2000}

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(
        db.Integer, db.ForeignKey("customers.id"), unique=True, nullable=False
    )
    balance = db.Column(db.Integer, nullable=False, default=0)
    tier = db.Column(db.String(16), nullable=False, default="bronze")
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    customer = db.relationship("Customer")

    def award_for_parcel(self):
        self.balance += self.POINTS_PER_PARCEL
        self._recalculate_tier()

    def redeem(self, points):
        if points > self.balance:
            raise ValueError("insufficient loyalty balance")
        self.balance -= points
        self._recalculate_tier()

    def _recalculate_tier(self):
        for tier, threshold in sorted(
            self.TIER_THRESHOLDS.items(), key=lambda item: item[1], reverse=True
        ):
            if self.balance >= threshold:
                self.tier = tier
                break
