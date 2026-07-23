"""Settlement: turning an approved claim into a cleared payment.

An approved claim begins settling, which creates a pending Payment and asks
the payment processor to disburse it. The processor confirms over its
webhook: ``issued`` when the transfer is accepted, then ``cleared`` when the
funds land or ``failed`` if it bounces. A failed payment is retried up to a
cap; an issued payment can be reversed for a clawback. The claim itself
reaches ``settled`` only when a payment clears.
"""

import logging
from datetime import datetime

import config
import requests
from app.extensions import db
from app.models.payment import Payment
from app.services import audit, cache, email

logger = logging.getLogger(__name__)


class SettlementError(Exception):
    """Raised when a settlement action is not allowed."""


def _request_disbursement(payment):
    """Ask the payment processor to move the money (best effort)."""
    try:
        response = requests.post(
            f"{config.FRAUD_API_BASE_URL}/../payments",
            json={"amount": payment.amount, "currency": payment.currency},
            timeout=5,
        )
        response.raise_for_status()
        payment.processor_reference = response.json().get("reference")
    except requests.RequestException:
        logger.exception("disbursement request failed for payment %s", payment.id)


def begin_settlement(claim):
    """Move an approved claim into ``settling`` and open a payment.

    Valid only out of ``approved``.
    """
    if claim.status != "approved":
        raise SettlementError("only approved claims can be settled")

    payment = Payment(
        claim_id=claim.id,
        amount=claim.amount_approved,
        status="pending",
    )
    db.session.add(payment)

    claim.status = "settling"
    db.session.flush()

    _request_disbursement(payment)
    db.session.commit()

    audit.record_transition("claim", claim.id, "approved", claim.status)
    cache.invalidate_status(claim.reference)
    return payment


def mark_payment_issued(payment):
    """Processor accepted the transfer: pending -> issued."""
    if payment.status != "pending":
        raise SettlementError("only pending payments can be issued")
    payment.status = "issued"
    payment.issued_at = datetime.utcnow()
    db.session.commit()
    audit.record_transition("payment", payment.id, "pending", payment.status)
    return payment


def mark_payment_cleared(payment):
    """Funds landed: issued -> cleared, and the claim is settled."""
    if payment.status != "issued":
        raise SettlementError("only issued payments can clear")
    payment.status = "cleared"
    payment.cleared_at = datetime.utcnow()

    claim = payment.claim
    claim.status = "settled"
    claim.settled_at = datetime.utcnow()
    db.session.commit()

    audit.record_transition("payment", payment.id, "issued", payment.status)
    audit.record_transition("claim", claim.id, "settling", claim.status)
    cache.invalidate_status(claim.reference)
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_CLAIM_SETTLED,
        {"reference": claim.reference, "amount": payment.amount},
    )
    return payment


def mark_payment_failed(payment, reason):
    """Processor bounced the transfer: pending -> failed."""
    if payment.status != "pending":
        raise SettlementError("only pending payments can fail")
    payment.status = "failed"
    payment.failed_at = datetime.utcnow()
    payment.failure_reason = reason
    db.session.commit()
    audit.record_transition("payment", payment.id, "pending", payment.status)
    return payment


def reverse_payment(payment, reason):
    """Clawback an issued payment: issued -> reversed."""
    if payment.status != "issued":
        raise SettlementError("only issued payments can be reversed")
    payment.status = "reversed"
    payment.reversed_at = datetime.utcnow()
    payment.failure_reason = reason
    db.session.commit()
    audit.record_transition("payment", payment.id, "issued", payment.status)
    return payment


def retry_failed_payment(failed_payment):
    """Open a fresh pending payment to replace a failed one.

    Used by the payment-retry sweep. The new payment carries the incremented
    retry counter; the caller is responsible for the per-claim retry cap.
    """
    replacement = Payment(
        claim_id=failed_payment.claim_id,
        amount=failed_payment.amount,
        currency=failed_payment.currency,
        retry_count=failed_payment.retry_count + 1,
        status="pending",
    )
    db.session.add(replacement)
    db.session.flush()
    _request_disbursement(replacement)
    db.session.commit()
    return replacement
