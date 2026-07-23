"""Transactional email via SendGrid."""

import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

import config

logger = logging.getLogger(__name__)

TEMPLATE_CLAIM_RECEIVED = "claim-received"
TEMPLATE_DOCUMENTS_REQUESTED = "documents-requested"
TEMPLATE_DOCUMENT_REMINDER = "document-reminder"
TEMPLATE_CLAIM_APPROVED = "claim-approved"
TEMPLATE_CLAIM_DENIED = "claim-denied"
TEMPLATE_CLAIM_SETTLED = "claim-settled"
TEMPLATE_APPEAL_RECEIVED = "appeal-received"
TEMPLATE_APPEAL_DECISION = "appeal-decision"
TEMPLATE_APPEAL_WINDOW_CLOSED = "appeal-window-closed"

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = SendGridAPIClient(config.SENDGRID_API_KEY)
    return _client


def send_templated_email(to_address, template, context):
    """Send a dynamic-template email, swallowing transport errors."""
    if not to_address:
        return
    message = Mail(from_email=config.SENDGRID_FROM_ADDRESS, to_emails=to_address)
    message.template_id = template
    message.dynamic_template_data = context
    try:
        _get_client().send(message)
    except Exception:
        logger.exception("failed to send %s email to %s", template, to_address)
