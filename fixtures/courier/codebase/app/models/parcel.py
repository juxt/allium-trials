"""Parcel: the unit of shipment tracked end to end."""

import secrets
from datetime import datetime

from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from app.extensions import db

PARCEL_STATUSES = (
    "registered",
    "collected",
    "in_depot",
    "out_for_delivery",
    "delivered",
    "returned",
)


def _new_tracking_token():
    return secrets.token_urlsafe(32)


class Parcel(db.Model):
    __tablename__ = "parcels"

    id = db.Column(db.Integer, primary_key=True)
    tracking_token = db.Column(
        db.String(64), unique=True, nullable=False, default=_new_tracking_token
    )
    status = db.Column(
        db.Enum(*PARCEL_STATUSES, name="parcel_status"),
        nullable=False,
        default="registered",
    )

    sender_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)

    is_international = db.Column(db.Boolean, nullable=False, default=False)
    weight_grams = db.Column(db.Integer, nullable=False)
    handling_flags = db.Column(ARRAY(db.String(32)), nullable=False, default=list)
    meta = db.Column("metadata", JSONB, nullable=False, default=dict)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    delivered_at = db.Column(db.DateTime, nullable=True)

    sender = db.relationship("Customer", foreign_keys=[sender_id])
    recipient = db.relationship("Customer", foreign_keys=[recipient_id])
    attempts = db.relationship(
        "DeliveryAttempt",
        back_populates="parcel",
        order_by="DeliveryAttempt.created_at",
    )
    customs_holds = db.relationship("CustomsHold", back_populates="parcel")

    def failed_attempt_count(self):
        return sum(1 for attempt in self.attempts if attempt.status == "failed")

    def __repr__(self):
        return f"<Parcel {self.id} {self.status}>"
