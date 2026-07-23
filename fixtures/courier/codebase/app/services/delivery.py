"""Recording the outcome of a delivery attempt."""

from datetime import datetime

import config
from app.extensions import db
from app.services import cache, email


def record_success(attempt):
    """Mark the attempt succeeded and the parcel delivered; notify the recipient."""
    parcel = attempt.parcel
    attempt.status = "succeeded"
    attempt.completed_at = datetime.utcnow()
    parcel.status = "delivered"
    parcel.delivered_at = attempt.completed_at
    db.session.commit()

    cache.invalidate_tracking(parcel.tracking_token)
    email.send_templated_email(
        parcel.recipient.email,
        email.TEMPLATE_PARCEL_DELIVERED,
        {
            "recipient_name": parcel.recipient.name,
            "tracking_token": parcel.tracking_token,
            "delivered_at": parcel.delivered_at.isoformat(),
        },
    )
    if config.SMS_NOTIFICATIONS_ENABLED:
        from app.legacy import sms_notifications

        sms_notifications.send_delivery_sms(
            parcel.recipient.phone, parcel.tracking_token
        )


def record_failure(attempt, reason):
    """Mark the attempt failed and send the parcel back to the depot."""
    parcel = attempt.parcel
    attempt.status = "failed"
    attempt.failure_reason = reason
    attempt.completed_at = datetime.utcnow()
    parcel.status = "in_depot"
    db.session.commit()

    cache.invalidate_tracking(parcel.tracking_token)
