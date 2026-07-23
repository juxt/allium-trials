"""Public claim-status lookup.

No login: a claimant follows a signed status link mailed to them. The token
identifies a single claim and nothing else, so the page is safe to expose to
an anonymous visitor.
"""

from flask import Blueprint, abort, jsonify

from app.auth import load_status_token
from app.models.claim import Claim
from app.services import cache

bp = Blueprint("status", __name__, url_prefix="/status")


def _render(claim):
    return {
        "reference": claim.reference,
        "status": claim.status,
        "peril": claim.peril,
        "amount_claimed": claim.amount_claimed,
        "amount_approved": claim.amount_approved,
        "submitted_at": claim.submitted_at.isoformat(),
    }


@bp.get("/<token>")
def lookup_status(token):
    """Return a public-safe status summary for the token's claim."""
    claim_id = load_status_token(token)
    if claim_id is None:
        abort(404)

    claim = Claim.query.get(claim_id)
    if claim is None:
        abort(404)

    cached = cache.get_status(claim.reference)
    if cached is not None:
        return jsonify(cached)

    payload = _render(claim)
    cache.set_status(claim.reference, payload)
    return jsonify(payload)
