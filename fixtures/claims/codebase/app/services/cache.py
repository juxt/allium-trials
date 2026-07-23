"""Redis-backed cache for the public status lookup.

The public status page is read far more often than claims change, so we
cache the rendered status payload keyed by claim reference and bust it
whenever the claim transitions.
"""

import json

import config
from app.extensions import redis_client

_STATUS_PREFIX = "status:"


def _key(reference):
    return f"{_STATUS_PREFIX}{reference}"


def get_status(reference):
    raw = redis_client.get(_key(reference))
    if raw is None:
        return None
    return json.loads(raw)


def set_status(reference, payload):
    redis_client.setex(
        _key(reference),
        config.STATUS_CACHE_TTL_SECONDS,
        json.dumps(payload),
    )


def invalidate_status(reference):
    redis_client.delete(_key(reference))
