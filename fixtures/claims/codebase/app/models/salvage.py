"""Salvage lots: recoverable goods from a settled total-loss claim.

This model was drafted for a planned salvage-recovery sub-system that was
never built. It is not registered in ``app.models`` and nothing imports it,
so its table is never created and no code reads or writes it.
"""

from datetime import datetime

from app.extensions import db


class SalvageLot(db.Model):
    __tablename__ = "salvage_lots"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, nullable=False)

    description = db.Column(db.String(255), nullable=False)
    appraised_value = db.Column(db.Integer, nullable=False, default=0)
    auction_lot_number = db.Column(db.String(32), nullable=True)
    disposed = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def expected_recovery(self):
        return 0 if self.disposed else self.appraised_value

    def __repr__(self):
        return f"<SalvageLot {self.id}>"
