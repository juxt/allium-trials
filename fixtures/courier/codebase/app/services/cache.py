"""Redis-backed cache in front of the public tracking endpoint."""

import json

import config
from app.extensions import redis_client

_TRACKING_KEY = "tracking:{token}"


def get_cached_tracking(token):
    raw = redis_client.get(_TRACKING_KEY.format(token=token))
    if raw is None:
        return None
    return json.loads(raw)


def cache_tracking(token, snapshot):
    redis_client.setex(
        _TRACKING_KEY.format(token=token),
        config.TRACKING_CACHE_TTL_SECONDS,
        json.dumps(snapshot),
    )


def invalidate_tracking(token):
    redis_client.delete(_TRACKING_KEY.format(token=token))
