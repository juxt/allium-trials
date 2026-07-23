"""Request authentication: bearer-token roles and webhook API keys."""

import functools

from flask import abort, g, request
from itsdangerous import BadSignature, URLSafeTimedSerializer

import config

_serializer = URLSafeTimedSerializer(config.SECRET_KEY, salt="swiftship-auth")


def _load_identity():
    """Decode the bearer token, returning its claims or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[len("Bearer "):]
    try:
        return _serializer.loads(token, max_age=config.AUTH_TOKEN_MAX_AGE_SECONDS)
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


def current_driver():
    """Return the Driver record for the authenticated driver-app user."""
    from app.models.driver import Driver

    identity = getattr(g, "identity", None)
    if identity is None or identity.get("role") != "driver":
        abort(401)
    return Driver.query.get_or_404(identity["driver_id"])
