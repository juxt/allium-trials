"""Claimant: a person who can file claims.

Claimant records are mastered in the customer-relationship system and pushed
to ClaimFlow over the CRM webhook. We read them but never originate them
here, so there is no local create path and no lifecycle of our own.
"""

from datetime import datetime

from app.extensions import db


class Claimant(db.Model):
    __tablename__ = "claimants"

    id = db.Column(db.Integer, primary_key=True)
    crm_id = db.Column(db.String(64), unique=True, nullable=False)

    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(32), nullable=True)

    address_line = db.Column(db.String(255), nullable=True)
    postcode = db.Column(db.String(16), nullable=True)

    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<Claimant {self.id} {self.crm_id}>"
