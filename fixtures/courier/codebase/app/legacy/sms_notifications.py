"""SMS notifications via Twilio.

Switched off in production pending a messaging cost review; gated behind
config.SMS_NOTIFICATIONS_ENABLED.
"""

import logging

from twilio.rest import Client

import config

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    return _client


def send_delivery_sms(phone_number, tracking_token):
    """Tell the recipient their parcel has been delivered."""
    if not phone_number:
        return
    try:
        _get_client().messages.create(
            to=phone_number,
            from_=config.TWILIO_FROM_NUMBER,
            body=(
                "Your SwiftShip parcel has been delivered. "
                f"Ref: {tracking_token[:8]}"
            ),
        )
    except Exception:
        logger.exception("failed to send delivery SMS to %s", phone_number)


def send_pickup_reminder_sms(phone_number, pickup_address):
    """Remind the customer a driver is on the way to collect."""
    if not phone_number:
        return
    try:
        _get_client().messages.create(
            to=phone_number,
            from_=config.TWILIO_FROM_NUMBER,
            body=f"A SwiftShip driver is heading to {pickup_address} for your pickup.",
        )
    except Exception:
        logger.exception("failed to send pickup reminder SMS to %s", phone_number)
