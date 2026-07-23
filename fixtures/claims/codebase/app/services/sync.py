"""Replication of externally-mastered records into ClaimFlow.

Claimants are pushed from the CRM; policies from the policy-admin system.
Both arrive over webhooks and are upserted here. ClaimFlow never originates
either record type.
"""

from datetime import datetime

from app.extensions import db
from app.models.claimant import Claimant
from app.models.policy import Policy


def upsert_claimant(data):
    """Create or update the local mirror of a CRM claimant record."""
    claimant = Claimant.query.filter_by(crm_id=data["crm_id"]).first()
    if claimant is None:
        claimant = Claimant(crm_id=data["crm_id"])
        db.session.add(claimant)
    claimant.full_name = data["full_name"]
    claimant.email = data["email"]
    claimant.phone = data.get("phone")
    claimant.address_line = data.get("address_line")
    claimant.postcode = data.get("postcode")
    claimant.synced_at = datetime.utcnow()
    db.session.commit()
    return claimant


def _parse(moment):
    if moment is None:
        return None
    return datetime.fromisoformat(moment)


def upsert_policy(data):
    """Create or update the local mirror of a policy-admin policy record."""
    policy = Policy.query.filter_by(policy_number=data["policy_number"]).first()
    if policy is None:
        policy = Policy(policy_number=data["policy_number"])
        db.session.add(policy)

    holder = Claimant.query.filter_by(crm_id=data["policyholder_crm_id"]).first_or_404()
    policy.policyholder_id = holder.id
    policy.product = data["product"]
    policy.covered_perils = data.get("covered_perils", [])
    policy.coverage_limit = data["coverage_limit"]
    policy.deductible = data.get("deductible", 0)
    policy.effective_from = _parse(data["effective_from"])
    policy.effective_to = _parse(data.get("effective_to"))
    policy.cancelled_at = _parse(data.get("cancelled_at"))
    policy.synced_at = datetime.utcnow()
    db.session.commit()
    return policy
