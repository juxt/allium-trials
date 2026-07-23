"""Customer read model.

Customers are mastered in the external CRM. Rows in this table are kept in
sync by the CRM webhook (see app.api.webhooks / app.services.crm_sync) and
are read-only everywhere else in the codebase.
"""

from datetime import datetime

from app.extensions import db


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    crm_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(32), nullable=True)

    address_line1 = db.Column(db.String(255), nullable=True)
    address_line2 = db.Column(db.String(255), nullable=True)
    city = db.Column(db.String(80), nullable=True)
    postcode = db.Column(db.String(16), nullable=True)
    country_code = db.Column(db.String(2), nullable=False, default="GB")

    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<Customer {self.id} crm={self.crm_id}>"
