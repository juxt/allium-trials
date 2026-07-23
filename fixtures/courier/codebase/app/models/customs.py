"""Customs holds raised by the broker on international parcels.

Holds are created and released exclusively by the customs webhook
(see app.api.webhooks); no internal code path originates them.
"""

from datetime import datetime

from app.extensions import db

HOLD_STATUSES = ("held", "released")


class CustomsHold(db.Model):
    __tablename__ = "customs_holds"

    id = db.Column(db.Integer, primary_key=True)
    parcel_id = db.Column(db.Integer, db.ForeignKey("parcels.id"), nullable=False)

    status = db.Column(
        db.Enum(*HOLD_STATUSES, name="customs_hold_status"),
        nullable=False,
        default="held",
    )
    broker_reference = db.Column(db.String(64), unique=True, nullable=False)
    reason = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    released_at = db.Column(db.DateTime, nullable=True)

    parcel = db.relationship("Parcel", back_populates="customs_holds")

    def __repr__(self):
        return f"<CustomsHold {self.id} parcel={self.parcel_id} {self.status}>"
