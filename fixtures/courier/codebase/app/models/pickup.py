"""Pickup requests: a customer asks for a parcel to be collected."""

from datetime import datetime

from app.extensions import db


class PickupRequest(db.Model):
    __tablename__ = "pickup_requests"

    id = db.Column(db.Integer, primary_key=True)
    parcel_id = db.Column(db.Integer, db.ForeignKey("parcels.id"), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    assigned_driver_id = db.Column(
        db.Integer, db.ForeignKey("drivers.id"), nullable=True
    )

    pickup_address = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.Text, nullable=True)

    requested_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    assigned_at = db.Column(db.DateTime, nullable=True)
    collected_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    expired_at = db.Column(db.DateTime, nullable=True)

    parcel = db.relationship("Parcel")
    customer = db.relationship("Customer")
    assigned_driver = db.relationship("Driver")

    @property
    def is_pending(self):
        """Still waiting for a driver: nothing has happened since the request."""
        return (
            self.assigned_at is None
            and self.cancelled_at is None
            and self.expired_at is None
        )

    @property
    def is_assigned(self):
        return (
            self.assigned_at is not None
            and self.collected_at is None
            and self.cancelled_at is None
        )

    @property
    def is_collected(self):
        return self.collected_at is not None

    @property
    def is_cancelled(self):
        return self.cancelled_at is not None

    @property
    def is_expired(self):
        return self.expired_at is not None

    @property
    def is_open(self):
        """A request someone could still act on."""
        return not (self.is_collected or self.is_cancelled or self.is_expired)

    def __repr__(self):
        return f"<PickupRequest {self.id} parcel={self.parcel_id}>"
