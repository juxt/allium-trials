"""Coinsurance reconciliation ledger.

Switched off pending a partner-integration rebuild; gated behind
config.COINSURANCE_LEDGER_ENABLED. The only call site for everything in this
module is inside that disabled guard (see ``maybe_post_coinsurance_share``),
so none of it runs in production.
"""

import logging

import requests

import config

logger = logging.getLogger(__name__)


def _partner_session():
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {config.COINSURANCE_PARTNER_KEY}"
    return session


def compute_partner_share(amount, partner_fraction):
    """Split a settled amount between us and a coinsurance partner."""
    partner = round(amount * partner_fraction)
    return {"partner": partner, "retained": amount - partner}


def post_coinsurance_share(claim_reference, split):
    """Notify the coinsurance partner of their share of a settlement."""
    session = _partner_session()
    try:
        response = session.post(
            f"{config.COINSURANCE_PARTNER_URL}/ledger",
            json={"reference": claim_reference, "split": split},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.exception("coinsurance ledger post failed for %s", claim_reference)


def maybe_post_coinsurance_share(claim, payment, partner_fraction):
    """Entry point. The body only runs when the ledger is enabled, which it
    never is, so this is effectively dead code."""
    if not config.COINSURANCE_LEDGER_ENABLED:
        return
    split = compute_partner_share(payment.amount, partner_fraction)
    post_coinsurance_share(claim.reference, split)
