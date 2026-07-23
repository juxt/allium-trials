"""Adjuster tooling endpoints (role ``adjuster``).

These are the working surfaces an adjuster uses while investigating a claim:
requesting and ruling on documents, working their review queue, and making
the approve / deny / escalate decision.
"""

from flask import Blueprint, jsonify, request

from app.auth import current_adjuster, require_role
from app.models.claim import Claim
from app.models.document import ClaimDocument
from app.models.review import ReviewTask
from app.serializers import (
    serialize_claim,
    serialize_document,
    serialize_review_task,
)
from app.services import assignment, decision, documents, repository, storage
from app.validation import validate_document_request

bp = Blueprint("adjuster", __name__, url_prefix="/adjuster")


@bp.get("/queue")
@require_role("adjuster")
def my_queue():
    """The calling adjuster's open review tasks and assigned claims."""
    adjuster = current_adjuster()
    tasks = repository.open_tasks_for_adjuster(adjuster.id)
    claims = repository.claims_for_adjuster(adjuster.id)
    return jsonify(
        {
            "tasks": [serialize_review_task(t) for t in tasks],
            "claims": [serialize_claim(c) for c in claims],
        }
    )


@bp.get("/claims/<int:claim_id>")
@require_role("adjuster")
def claim_detail(claim_id):
    """Full claim detail, with presigned URLs for uploaded documents."""
    claim = _assigned_claim_or_404(claim_id)
    docs = []
    for document in claim.documents:
        url = None
        if document.storage_key and not document.is_rejected:
            url = storage.presigned_url(document.storage_key)
        docs.append(serialize_document(document, include_url=url))
    payload = serialize_claim(claim, detail=True)
    payload["documents"] = docs
    return jsonify(payload)


def _assigned_claim_or_404(claim_id):
    """Load a claim the calling adjuster is allowed to act on."""
    adjuster = current_adjuster()
    claim = Claim.query.get_or_404(claim_id)
    if claim.assigned_adjuster_id != adjuster.id:
        from flask import abort

        abort(403)
    return claim


@bp.post("/claims/<int:claim_id>/documents")
@require_role("adjuster")
def request_document(claim_id):
    """Ask the claimant for a supporting document."""
    claim = _assigned_claim_or_404(claim_id)
    payload = validate_document_request(request.get_json(force=True))
    doc = documents.request_document(claim, payload["kind"])
    return jsonify({"document_id": doc.id, "kind": doc.kind}), 201


@bp.post("/documents/<int:document_id>/verify")
@require_role("adjuster")
def verify_document(document_id):
    """Accept an uploaded document."""
    document = ClaimDocument.query.get_or_404(document_id)
    try:
        documents.verify_document(document)
    except documents.DocumentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"document_id": document.id, "verified": True})


@bp.post("/documents/<int:document_id>/reject")
@require_role("adjuster")
def reject_document(document_id):
    """Reject an uploaded document as unusable."""
    document = ClaimDocument.query.get_or_404(document_id)
    payload = request.get_json(force=True)
    try:
        documents.reject_document(document, payload.get("reason", ""))
    except documents.DocumentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"document_id": document.id, "rejected": True})


@bp.post("/tasks/<int:task_id>/start")
@require_role("adjuster")
def start_task(task_id):
    """Pick up an open review task."""
    task = ReviewTask.query.get_or_404(task_id)
    try:
        assignment.start_review_task(task)
    except assignment.AssignmentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"task_id": task.id, "status": task.status})


@bp.post("/tasks/<int:task_id>/resolve")
@require_role("adjuster")
def resolve_task(task_id):
    """Close out a review task being worked."""
    task = ReviewTask.query.get_or_404(task_id)
    try:
        assignment.resolve_review_task(task)
    except assignment.AssignmentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"task_id": task.id, "status": task.status})


@bp.post("/claims/<int:claim_id>/approve")
@require_role("adjuster")
def approve_claim(claim_id):
    """Approve a claim under investigation.

    The route only confirms the actor is the assigned adjuster; the
    substantive precondition (clear fraud check, verified documents, within
    policy coverage) is enforced inside the decision service.
    """
    claim = _assigned_claim_or_404(claim_id)
    try:
        decision.approve_claim(claim)
    except decision.DecisionError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"claim_id": claim.id, "status": claim.status})


@bp.post("/claims/<int:claim_id>/deny")
@require_role("adjuster")
def deny_claim(claim_id):
    """Deny a claim under investigation."""
    claim = _assigned_claim_or_404(claim_id)
    payload = request.get_json(force=True)
    try:
        decision.deny_claim(claim, payload["reason"])
    except decision.DecisionError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"claim_id": claim.id, "status": claim.status})


@bp.post("/claims/<int:claim_id>/escalate")
@require_role("adjuster")
def escalate_claim(claim_id):
    """Escalate an investigating claim to senior review."""
    claim = _assigned_claim_or_404(claim_id)
    try:
        decision.escalate_claim(claim)
    except decision.DecisionError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"claim_id": claim.id, "status": claim.status})
