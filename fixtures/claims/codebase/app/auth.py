"""Request authentication: bearer-token roles and webhook API keys.

ClaimFlow exposes four authenticated surfaces plus a token-scoped public
status lookup:

* the public status page (a signed lookup token, no login),
* the claimant portal (role ``claimant``),
* adjuster tooling (role ``adjuster``),
* manager / ops back-office (role ``manager``),

and machine-to-machine webhooks authenticated with an ``X-Api-Key`` header.
"""

import functools

from flask import abort, g, request
from itsdangerous import BadSignature, URLSafeTimedSerializer

import config

_serializer = URLSafeTimedSerializer(config.SECRET_KEY, salt="claimflow-auth")
_status_serializer = URLSafeTimedSerializer(config.SECRET_KEY, salt="claimflow-status")


def _load_identity():
    """Decode the bearer token, returning its claims or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[len("Bearer "):]
    try:
        return _serializer.loads(token, max_age=config.STATUS_TOKEN_MAX_AGE_SECONDS)
    except BadSignature:
        return None


def require_role(role):
    """Reject the request unless the bearer token carries the given role."""

    def decorator(view):
        @functools.wraps(view)
        def wrapper(*args, **kwargs):
            identity = _load_identity()
            if identity is None or identity.get("role") != role:
                abort(401)
            g.identity = identity
            return view(*args, **kwargs)

        return wrapper

    return decorator


def require_api_key(expected_key):
    """Authenticate machine-to-machine webhooks via the X-Api-Key header."""

    def decorator(view):
        @functools.wraps(view)
        def wrapper(*args, **kwargs):
            supplied = request.headers.get("X-Api-Key")
            if not expected_key or supplied != expected_key:
                abort(401)
            return view(*args, **kwargs)

        return wrapper

    return decorator


def status_token_for(claim):
    """Mint the signed lookup token printed on a claimant's acknowledgement."""
    return _status_serializer.dumps({"claim_id": claim.id})


def load_status_token(token):
    """Decode a public status-lookup token, returning the claim id or None."""
    try:
        data = _status_serializer.loads(
            token, max_age=config.STATUS_TOKEN_MAX_AGE_SECONDS
        )
    except BadSignature:
        return None
    return data.get("claim_id")


def current_adjuster():
    """Return the Adjuster record for the authenticated adjuster-app user."""
    from app.models.adjuster import Adjuster

    identity = getattr(g, "identity", None)
    if identity is None or identity.get("role") != "adjuster":
        abort(401)
    return Adjuster.query.get_or_404(identity["adjuster_id"])


def current_claimant_id():
    """Return the claimant id carried by the authenticated portal token."""
    identity = getattr(g, "identity", None)
    if identity is None or identity.get("role") != "claimant":
        abort(401)
    return identity["claimant_id"]
