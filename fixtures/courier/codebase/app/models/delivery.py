"""Delivery attempts: one row per try at getting a parcel to its recipient."""

from datetime import datetime

from app.extensions import db

ATTEMPT_STATUSES = ("pending", "succeeded", "failed")


class DeliveryAttempt(db.Model):
    __tablename__ = "delivery_attempts"

    id = db.Column(db.Integer, primary_key=True)
    parcel_id = db.Column(db.Integer, db.ForeignKey("parcels.id"), nullable=False)
    driver_id = db.Column(db.Integer, db.ForeignKey("drivers.id"), nullable=False)

    status = db.Column(
        db.Enum(*ATTEMPT_STATUSES, name="delivery_attempt_status"),
        nullable=False,
        default="pending",
    )
    failure_reason = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    parcel = db.relationship("Parcel", back_populates="attempts")
    driver = db.relationship("Driver")

    def __repr__(self):
        return f"<DeliveryAttempt {self.id} parcel={self.parcel_id} {self.status}>"
