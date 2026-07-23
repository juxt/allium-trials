"""Public, unauthenticated parcel tracking."""

from flask import Blueprint, jsonify

from app.models.parcel import Parcel
from app.services import cache

bp = Blueprint("tracking", __name__)


@bp.get("/track/<token>")
def track_parcel(token):
    snapshot = cache.get_cached_tracking(token)
    if snapshot is None:
        parcel = Parcel.query.filter_by(tracking_token=token).first_or_404()
        last_attempt = parcel.attempts[-1] if parcel.attempts else None
        snapshot = {
            "status": parcel.status,
            "is_international": parcel.is_international,
            "delivered_at": (
                parcel.delivered_at.isoformat() if parcel.delivered_at else None
            ),
            "last_attempt": (
                {
                    "status": last_attempt.status,
                    "failure_reason": last_attempt.failure_reason,
                }
                if last_attempt
                else None
            ),
        }
        cache.cache_tracking(token, snapshot)
    return jsonify(snapshot)
