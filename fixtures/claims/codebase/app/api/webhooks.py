"""Inbound webhooks from external systems.

* policy-admin   -> policy upserts (X-Api-Key: POLICY_WEBHOOK_API_KEY)
* CRM            -> claimant upserts (X-Api-Key: CRM_WEBHOOK_API_KEY)
* fraud-scoring  -> fraud check results (X-Api-Key: FRAUD_WEBHOOK_API_KEY)
* payment-proc.  -> payment status (X-Api-Key: PAYMENT_WEBHOOK_API_KEY)
"""

from datetime import datetime

from flask import Blueprint, jsonify, request

import config
from app.auth import require_api_key
from app.extensions import db
from app.models.fraud import FraudCheck
from app.models.payment import Payment
from app.services import cache, settlement, sync

bp = Blueprint("webhooks", __name__, url_prefix="/webhooks")


@bp.post("/policy-admin")
@require_api_key(config.POLICY_WEBHOOK_API_KEY)
def policy_event():
    """Policy-admin pushes a policy create/update."""
    payload = request.get_json(force=True)
    policy = sync.upsert_policy(payload["policy"])
    return jsonify({"policy_id": policy.id, "policy_number": policy.policy_number})


@bp.post("/crm")
@require_api_key(config.CRM_WEBHOOK_API_KEY)
def crm_event():
    """CRM pushes a claimant create/update."""
    payload = request.get_json(force=True)
    claimant = sync.upsert_claimant(payload["claimant"])
    return jsonify({"claimant_id": claimant.id, "crm_id": claimant.crm_id})


@bp.post("/fraud")
@require_api_key(config.FRAUD_WEBHOOK_API_KEY)
def fraud_event():
    """Fraud-scoring service returns the result for a pending check.

    The verdict moves the check from ``pending`` to ``clear`` or
    ``flagged``. A clear result is what later unblocks approval.
    """
    payload = request.get_json(force=True)
    check = FraudCheck.query.filter_by(
        vendor_reference=payload["reference"]
    ).first_or_404()
    if check.status != "pending":
        return jsonify({"error": "fraud check already resolved"}), 409

    verdict = payload["verdict"]
    if verdict not in ("clear", "flagged"):
        return jsonify({"error": f"unknown verdict {verdict!r}"}), 400

    check.status = verdict
    check.score = payload.get("score")
    check.signals = payload.get("signals", {})
    check.resolved_at = datetime.utcnow()
    db.session.commit()

    cache.invalidate_status(check.claim.reference)
    return jsonify({"fraud_check_id": check.id, "status": check.status})


@bp.post("/payments")
@require_api_key(config.PAYMENT_WEBHOOK_API_KEY)
def payment_event():
    """Payment processor reports progress on a disbursement."""
    payload = request.get_json(force=True)
    payment = Payment.query.filter_by(
        processor_reference=payload["reference"]
    ).first_or_404()

    event = payload.get("event")
    try:
        if event == "payment.issued":
            settlement.mark_payment_issued(payment)
        elif event == "payment.cleared":
            settlement.mark_payment_cleared(payment)
        elif event == "payment.failed":
            settlement.mark_payment_failed(payment, payload.get("reason", ""))
        elif event == "payment.reversed":
            settlement.reverse_payment(payment, payload.get("reason", ""))
        else:
            return jsonify({"error": f"unknown event {event!r}"}), 400
    except settlement.SettlementError as exc:
        return jsonify({"error": str(exc)}), 409

    return jsonify({"payment_id": payment.id, "status": payment.status})
