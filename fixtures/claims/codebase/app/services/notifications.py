"""Notification facade.

A thin domain-named layer over the email transport so callers express intent
("tell the claimant their claim was approved") without touching template ids
or addresses. All ClaimFlow notifications are email; this is the single seam
where another channel could later be added.
"""

from app.services import email


def notify_claim_received(claim):
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_CLAIM_RECEIVED,
        {"claimant_name": claim.claimant.full_name, "reference": claim.reference},
    )


def notify_documents_requested(claim, kinds):
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_DOCUMENTS_REQUESTED,
        {"reference": claim.reference, "document_kinds": list(kinds)},
    )


def notify_decision(claim):
    if claim.status == "approved":
        email.send_templated_email(
            claim.claimant.email,
            email.TEMPLATE_CLAIM_APPROVED,
            {"reference": claim.reference, "amount": claim.amount_approved},
        )
    elif claim.status == "denied":
        email.send_templated_email(
            claim.claimant.email,
            email.TEMPLATE_CLAIM_DENIED,
            {"reference": claim.reference, "reason": claim.denial_reason},
        )


def notify_settled(claim, amount):
    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_CLAIM_SETTLED,
        {"reference": claim.reference, "amount": amount},
    )
