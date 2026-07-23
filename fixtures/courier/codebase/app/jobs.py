"""Periodic housekeeping tasks, run by the celery beat scheduler."""

from datetime import datetime, timedelta

from celery.schedules import crontab

import config
from app.extensions import celery, db
from app.models.parcel import Parcel
from app.models.pickup import PickupRequest
from app.services import cache, email


@celery.task(name="jobs.return_to_sender")
def return_to_sender():
    """Return depot parcels that have exhausted their delivery attempts."""
    candidates = Parcel.query.filter_by(status="in_depot").all()
    returned = 0
    for parcel in candidates:
        if parcel.failed_attempt_count() < config.MAX_DELIVERY_ATTEMPTS:
            continue
        parcel.status = "returned"
        cache.invalidate_tracking(parcel.tracking_token)
        email.send_templated_email(
            parcel.sender.email,
            email.TEMPLATE_PARCEL_RETURNED,
            {
                "sender_name": parcel.sender.name,
                "tracking_token": parcel.tracking_token,
            },
        )
        returned += 1
    db.session.commit()
    return returned


@celery.task(name="jobs.expire_pickup_requests")
def expire_pickup_requests():
    """Expire pickup requests that no driver accepted within the window."""
    cutoff = datetime.utcnow() - timedelta(hours=config.PICKUP_EXPIRY_HOURS)
    stale = PickupRequest.query.filter(
        PickupRequest.requested_at < cutoff,
        PickupRequest.assigned_at.is_(None),
        PickupRequest.cancelled_at.is_(None),
        PickupRequest.expired_at.is_(None),
    ).all()
    for pickup in stale:
        pickup.expired_at = datetime.utcnow()
        email.send_templated_email(
            pickup.customer.email,
            email.TEMPLATE_PICKUP_EXPIRED,
            {
                "customer_name": pickup.customer.name,
                "pickup_address": pickup.pickup_address,
            },
        )
    db.session.commit()
    return len(stale)


celery.conf.beat_schedule = {
    "return-to-sender": {
        "task": "jobs.return_to_sender",
        "schedule": crontab(minute=15),
    },
    "expire-pickup-requests": {
        "task": "jobs.expire_pickup_requests",
        "schedule": crontab(minute=0, hour="*/2"),
    },
}
