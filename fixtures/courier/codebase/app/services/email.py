"""Outbound email, sent through SendGrid dynamic templates."""

import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

import config

logger = logging.getLogger(__name__)

TEMPLATE_PARCEL_DELIVERED = "d-parcel-delivered-v2"
TEMPLATE_PARCEL_RETURNED = "d-parcel-returned-to-sender-v1"
TEMPLATE_PICKUP_EXPIRED = "d-pickup-request-expired-v1"


def send_templated_email(to_address, template_id, context):
    """Send a transactional email. Failures are logged, never raised."""
    message = Mail(from_email=config.SENDGRID_FROM_ADDRESS, to_emails=to_address)
    message.template_id = template_id
    message.dynamic_template_data = context
    try:
        SendGridAPIClient(config.SENDGRID_API_KEY).send(message)
    except Exception:
        logger.exception("failed to send %s to %s", template_id, to_address)
