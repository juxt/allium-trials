"""Manager / ops back-office endpoints (role ``manager``).

Managers steer the queue: they triage fresh claims, assign them to
adjusters, kick off settlement on approved claims, and adjudicate appeals.
"""

from flask import Blueprint, jsonify, request

from app.auth import require_role
from app.models.adjuster import Adjuster
from app.models.appeal import Appeal
from app.models.claim import Claim
from app.serializers import serialize_appeal, serialize_claim
from app.services import appeals, assignment, intake, repository, settlement

bp = Blueprint("manager", __name__, url_prefix="/manager")


@bp.get("/queue/submitted")
@require_role("manager")
def submitted_queue():
    """Claims awaiting triage."""
    claims = repository.submitted_claims()
    return jsonify({"claims": [serialize_claim(c) for c in claims]})


@bp.get("/queue/triaged")
@require_role("manager")
def triaged_queue():
    """Triaged claims awaiting assignment."""
    claims = repository.triaged_claims()
    return jsonify({"claims": [serialize_claim(c) for c in claims]})


@bp.get("/queue/sla")
@require_role("manager")
def sla_queue():
    """Investigating claims that have breached the SLA window."""
    claims = repository.claims_breaching_sla()
    return jsonify({"claims": [serialize_claim(c) for c in claims]})


@bp.get("/claims/<int:claim_id>")
@require_role("manager")
def claim_detail(claim_id):
    """Full detail for any claim."""
    claim = Claim.query.get_or_404(claim_id)
    return jsonify(serialize_claim(claim, detail=True))


@bp.get("/appeals/<int:appeal_id>")
@require_role("manager")
def appeal_detail(appeal_id):
    appeal = Appeal.query.get_or_404(appeal_id)
    return jsonify(serialize_appeal(appeal))


@bp.post("/claims/<int:claim_id>/triage")
@require_role("manager")
def triage_claim(claim_id):
    """Run automated triage on a freshly submitted claim."""
    claim = Claim.query.get_or_404(claim_id)
    try:
        intake.triage_claim(claim)
    except intake.IntakeError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"claim_id": claim.id, "status": claim.status})


@bp.post("/claims/<int:claim_id>/assign")
@require_role("manager")
def assign_claim(claim_id):
    """Assign a triaged claim to an adjuster and start investigating."""
    claim = Claim.query.get_or_404(claim_id)
    payload = request.get_json(force=True)
    if "adjuster_id" in payload:
        adjuster = Adjuster.query.get_or_404(payload["adjuster_id"])
    else:
        adjuster = assignment.pick_available_adjuster()
        if adjuster is None:
            return jsonify({"error": "no adjuster available"}), 409

    try:
        task = assignment.assign_claim(claim, adjuster)
    except assignment.AssignmentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify(
        {
            "claim_id": claim.id,
            "status": claim.status,
            "adjuster_id": adjuster.id,
            "task_id": task.id,
        }
    )


@bp.post("/claims/<int:claim_id>/settle")
@require_role("manager")
def settle_claim(claim_id):
    """Begin settlement on an approved claim (opens the payment)."""
    claim = Claim.query.get_or_404(claim_id)
    try:
        payment = settlement.begin_settlement(claim)
    except settlement.SettlementError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify(
        {
            "claim_id": claim.id,
            "status": claim.status,
            "payment_id": payment.id,
        }
    )


@bp.post("/appeals/<int:appeal_id>/review")
@require_role("manager")
def review_appeal(appeal_id):
    """Begin reviewing a filed appeal."""
    appeal = Appeal.query.get_or_404(appeal_id)
    try:
        appeals.start_appeal_review(appeal)
    except appeals.AppealError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"appeal_id": appeal.id, "status": appeal.status})


@bp.post("/appeals/<int:appeal_id>/uphold")
@require_role("manager")
def uphold_appeal(appeal_id):
    """Uphold the original denial; the appeal closes."""
    appeal = Appeal.query.get_or_404(appeal_id)
    payload = request.get_json(force=True)
    try:
        appeals.uphold_appeal(appeal, payload.get("notes", ""))
    except appeals.AppealError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"appeal_id": appeal.id, "status": appeal.status})


@bp.post("/appeals/<int:appeal_id>/overturn")
@require_role("manager")
def overturn_appeal(appeal_id):
    """Overturn the denial; the claim is reopened for investigation."""
    appeal = Appeal.query.get_or_404(appeal_id)
    payload = request.get_json(force=True)
    try:
        appeals.overturn_appeal(appeal, payload.get("notes", ""))
    except appeals.AppealError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify(
        {
            "appeal_id": appeal.id,
            "status": appeal.status,
            "claim_status": appeal.claim.status,
        }
    )
