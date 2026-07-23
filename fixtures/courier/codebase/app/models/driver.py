"""Drivers who collect pickups and run delivery routes."""

from datetime import datetime

from app.extensions import db


class Driver(db.Model):
    __tablename__ = "drivers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    phone = db.Column(db.String(32), nullable=True)
    vehicle_registration = db.Column(db.String(16), nullable=True)

    shift_started_at = db.Column(db.DateTime, nullable=True)
    shift_ends_at = db.Column(db.DateTime, nullable=True)

    @property
    def is_on_shift(self):
        now = datetime.utcnow()
        return (
            self.shift_started_at is not None
            and self.shift_started_at <= now
            and (self.shift_ends_at is None or now < self.shift_ends_at)
        )

    def can_take_route(self):
        """Whether this driver may be put on a delivery route right now."""
        return self.is_on_shift

    def __repr__(self):
        return f"<Driver {self.id} {self.name!r}>"
