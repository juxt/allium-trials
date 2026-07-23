"""JSON serialisation helpers for API responses.

Centralises how each entity is rendered so the surfaces stay consistent and
never leak storage internals (object keys, processor references) to the
wrong audience.
"""


def _iso(value):
    return value.isoformat() if value is not None else None


def serialize_claimant(claimant):
    return {
        "id": claimant.id,
        "crm_id": claimant.crm_id,
        "full_name": claimant.full_name,
        "email": claimant.email,
        "phone": claimant.phone,
    }


def serialize_policy(policy):
    return {
        "id": policy.id,
        "policy_number": policy.policy_number,
        "product": policy.product,
        "covered_perils": list(policy.covered_perils or []),
        "coverage_limit": policy.coverage_limit,
        "deductible": policy.deductible,
        "effective_from": _iso(policy.effective_from),
        "effective_to": _iso(policy.effective_to),
        "cancelled_at": _iso(policy.cancelled_at),
    }


def document_state(document):
    """Render the derived document state as a single label."""
    if document.is_verified:
        return "verified"
    if document.is_rejected:
        return "rejected"
    if document.is_uploaded:
        return "uploaded"
    return "requested"


def serialize_document(document, include_url=None):
    payload = {
        "id": document.id,
        "claim_id": document.claim_id,
        "kind": document.kind,
        "state": document_state(document),
        "requested_at": _iso(document.requested_at),
        "uploaded_at": _iso(document.uploaded_at),
        "verified_at": _iso(document.verified_at),
        "rejected_at": _iso(document.rejected_at),
    }
    if include_url is not None:
        payload["download_url"] = include_url
    return payload


def serialize_fraud_check(check):
    return {
        "id": check.id,
        "claim_id": check.claim_id,
        "status": check.status,
        "score": check.score,
        "resolved_at": _iso(check.resolved_at),
    }


def serialize_payment(payment):
    return {
        "id": payment.id,
        "claim_id": payment.claim_id,
        "status": payment.status,
        "amount": payment.amount,
        "currency": payment.currency,
        "retry_count": payment.retry_count,
        "issued_at": _iso(payment.issued_at),
        "cleared_at": _iso(payment.cleared_at),
        "failed_at": _iso(payment.failed_at),
        "reversed_at": _iso(payment.reversed_at),
    }


def serialize_review_task(task):
    return {
        "id": task.id,
        "claim_id": task.claim_id,
        "adjuster_id": task.adjuster_id,
        "kind": task.kind,
        "status": task.status,
        "created_at": _iso(task.created_at),
        "resolved_at": _iso(task.resolved_at),
    }


def serialize_appeal(appeal):
    return {
        "id": appeal.id,
        "claim_id": appeal.claim_id,
        "status": appeal.status,
        "grounds": appeal.grounds,
        "filed_at": _iso(appeal.filed_at),
        "decided_at": _iso(appeal.decided_at),
    }


def serialize_claim(claim, *, detail=False):
    payload = {
        "id": claim.id,
        "reference": claim.reference,
        "status": claim.status,
        "peril": claim.peril,
        "amount_claimed": claim.amount_claimed,
        "amount_approved": claim.amount_approved,
        "incident_date": _iso(claim.incident_date),
        "submitted_at": _iso(claim.submitted_at),
        "assigned_adjuster_id": claim.assigned_adjuster_id,
    }
    if detail:
        payload["documents"] = [serialize_document(d) for d in claim.documents]
        payload["fraud_checks"] = [
            serialize_fraud_check(c) for c in claim.fraud_checks
        ]
        payload["payments"] = [serialize_payment(p) for p in claim.payments]
        payload["appeals"] = [serialize_appeal(a) for a in claim.appeals]
        payload["denial_reason"] = claim.denial_reason
    return payload
