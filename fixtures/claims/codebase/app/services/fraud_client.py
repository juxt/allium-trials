"""Client for the external fraud-scoring service.

We post a scoring request when a claim is triaged; the vendor replies later
over a webhook (see app.api.webhooks). This module only handles the
outbound request and the local FraudCheck row that tracks it.
"""

import logging

import requests

import config
from app.extensions import db
from app.models.fraud import FraudCheck

logger = logging.getLogger(__name__)


def request_fraud_check(claim):
    """Open a pending FraudCheck and post the scoring request."""
    check = FraudCheck(claim_id=claim.id, status="pending")
    db.session.add(check)
    db.session.flush()

    payload = {
        "claim_reference": claim.reference,
        "amount_claimed": claim.amount_claimed,
        "peril": claim.peril,
        "policy_number": claim.policy.policy_number,
        "claimant_crm_id": claim.claimant.crm_id,
        "callback_token": check.id,
    }
    try:
        response = requests.post(
            f"{config.FRAUD_API_BASE_URL}/score",
            json=payload,
            headers={"Authorization": f"Bearer {config.FRAUD_API_KEY}"},
            timeout=5,
        )
        response.raise_for_status()
        check.vendor_reference = response.json().get("reference")
    except requests.RequestException:
        logger.exception("fraud scoring request failed for claim %s", claim.id)
    return check
