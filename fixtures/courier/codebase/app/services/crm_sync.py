"""Applies customer payloads pushed by the CRM.

The CRM is the system of record for customers; this module is the only
writer to the customers table.
"""

from datetime import datetime

from app.extensions import db
from app.models.customer import Customer


def upsert_customer(payload):
    """Create or update the local customer row for a CRM record."""
    customer = Customer.query.filter_by(crm_id=payload["crm_id"]).first()
    if customer is None:
        customer = Customer(crm_id=payload["crm_id"])
        db.session.add(customer)

    customer.name = payload["name"]
    customer.email = payload["email"]
    customer.phone = payload.get("phone")
    customer.address_line1 = payload.get("address_line1")
    customer.address_line2 = payload.get("address_line2")
    customer.city = payload.get("city")
    customer.postcode = payload.get("postcode")
    customer.country_code = payload.get("country_code", "GB")
    customer.synced_at = datetime.utcnow()

    db.session.commit()
    return customer
