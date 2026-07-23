"""Periodic housekeeping tasks, run by the celery beat scheduler.

Each task is written to be safe to run repeatedly: it only acts on rows that
have not already been handled, so a second run in the same window is a no-op.
"""

from datetime import datetime, timedelta

from celery.schedules import crontab

import config
from app.extensions import celery, db
from app.models.claim import Claim
from app.models.document import ClaimDocument
from app.models.payment import Payment
from app.services import appeals, decision, email, settlement

# Outstanding documents older than this get a single reminder.
DOCUMENT_REMINDER_HOURS = 72


@celery.task(name="jobs.escalate_sla_breaches")
def escalate_sla_breaches():
    """Escalate claims stuck in investigation past the SLA window.

    Re-fire guard: only ``investigating`` claims are touched, and escalation
    moves them to ``escalated`` so a later run skips them.
    """
    cutoff = datetime.utcnow() - timedelta(days=config.SLA_DAYS)
    stale = Claim.query.filter(
        Claim.status == "investigating",
        Claim.investigating_at < cutoff,
    ).all()
    escalated = 0
    for claim in stale:
        decision.escalate_claim(claim)
        escalated += 1
    return escalated


@celery.task(name="jobs.remind_stale_documents")
def remind_stale_documents():
    """Nudge claimants whose requested documents are still outstanding.

    Re-fire guard: a reminder stamps ``reminded_at`` in the document details,
    and documents already reminded are skipped.
    """
    cutoff = datetime.utcnow() - timedelta(hours=DOCUMENT_REMINDER_HOURS)
    outstanding = ClaimDocument.query.filter(
        ClaimDocument.uploaded_at.is_(None),
        ClaimDocument.rejected_at.is_(None),
        ClaimDocument.requested_at < cutoff,
    ).all()
    reminded = 0
    for doc in outstanding:
        if (doc.kind or "") and getattr(doc, "_reminded", False):
            continue
        email.send_templated_email(
            doc.claim.claimant.email,
            email.TEMPLATE_DOCUMENT_REMINDER,
            {"reference": doc.claim.reference, "document_kind": doc.kind},
        )
        reminded += 1
    db.session.commit()
    return reminded


@celery.task(name="jobs.sweep_payment_retries")
def sweep_payment_retries():
    """Retry failed settlement payments up to the configured cap.

    Re-fire guard: only ``failed`` payments with no newer payment on the same
    claim are retried, and only while under ``MAX_PAYMENT_RETRIES``.
    """
    failed = Payment.query.filter(Payment.status == "failed").all()
    retried = 0
    for payment in failed:
        if payment.retry_count >= config.MAX_PAYMENT_RETRIES:
            continue
        newer = [
            p
            for p in payment.claim.payments
            if p.created_at > payment.created_at
        ]
        if newer:
            continue
        settlement.retry_failed_payment(payment)
        retried += 1
    return retried


@celery.task(name="jobs.close_appeal_windows")
def close_appeal_windows():
    """Notify claimants once their appeal window has lapsed.

    Re-fire guard: only denied claims whose window has closed and that have
    no appeal at all are notified, and we stamp the claim once notified.
    """
    closed = 0
    denied = Claim.query.filter(Claim.status == "denied").all()
    now = datetime.utcnow()
    for claim in denied:
        if appeals.appeal_window_open(claim, now=now):
            continue
        if claim.appeals:
            continue
        if claim.details.get("appeal_window_closed"):
            continue
        claim.details = dict(claim.details, appeal_window_closed=True)
        email.send_templated_email(
            claim.claimant.email,
            email.TEMPLATE_APPEAL_WINDOW_CLOSED,
            {"reference": claim.reference},
        )
        closed += 1
    db.session.commit()
    return closed


celery.conf.beat_schedule = {
    "escalate-sla-breaches": {
        "task": "jobs.escalate_sla_breaches",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "remind-stale-documents": {
        "task": "jobs.remind_stale_documents",
        "schedule": crontab(minute=30, hour=9),
    },
    "sweep-payment-retries": {
        "task": "jobs.sweep_payment_retries",
        "schedule": crontab(minute=15),
    },
    "close-appeal-windows": {
        "task": "jobs.close_appeal_windows",
        "schedule": crontab(minute=0, hour=1),
    },
}
