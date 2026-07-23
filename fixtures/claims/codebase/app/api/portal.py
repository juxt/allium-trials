"""Claimant-facing portal endpoints (role ``claimant``)."""

from flask import Blueprint, jsonify, request

from app.auth import current_claimant_id, require_role, status_token_for
from app.models.claim import Claim
from app.models.claimant import Claimant
from app.models.document import ClaimDocument
from app.models.policy import Policy
from app.serializers import serialize_claim
from app.services import appeals, documents, intake, repository
from app.validation import validate_appeal, validate_claim_submission

bp = Blueprint("portal", __name__, url_prefix="/portal")


def _own_claim_or_404(claim_id):
    """Load a claim, enforcing that it belongs to the caller."""
    claim = Claim.query.get_or_404(claim_id)
    if claim.claimant_id != current_claimant_id():
        # Hide existence of other claimants' claims.
        from flask import abort

        abort(404)
    return claim


@bp.get("/claims")
@require_role("claimant")
def list_claims():
    """List the caller's claims."""
    claims = repository.claims_for_claimant(current_claimant_id())
    return jsonify({"claims": [serialize_claim(c) for c in claims]})


@bp.get("/claims/<int:claim_id>")
@require_role("claimant")
def get_claim(claim_id):
    """Full detail for one of the caller's claims."""
    claim = _own_claim_or_404(claim_id)
    return jsonify(serialize_claim(claim, detail=True))


@bp.post("/claims")
@require_role("claimant")
def submit_claim():
    """File a new claim against one of the caller's policies."""
    payload = validate_claim_submission(request.get_json(force=True))
    claimant = Claimant.query.get_or_404(current_claimant_id())
    policy = Policy.query.get_or_404(payload["policy_id"])
    if policy.policyholder_id != claimant.id:
        return jsonify({"error": "policy does not belong to claimant"}), 403

    try:
        claim = intake.submit_claim(claimant, policy, payload)
    except intake.IntakeError as exc:
        return jsonify({"error": str(exc)}), 422

    return (
        jsonify(
            {
                "claim_id": claim.id,
                "reference": claim.reference,
                "status": claim.status,
                "status_token": status_token_for(claim),
            }
        ),
        201,
    )


@bp.post("/claims/<int:claim_id>/documents/<int:document_id>/upload")
@require_role("claimant")
def upload_document(claim_id, document_id):
    """Upload a file against a requested document on the caller's claim."""
    claim = _own_claim_or_404(claim_id)
    document = ClaimDocument.query.get_or_404(document_id)
    if document.claim_id != claim.id:
        return jsonify({"error": "document does not belong to claim"}), 404

    upload = request.files["file"]
    try:
        documents.record_upload(document, upload.stream, upload.mimetype)
    except documents.DocumentError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"document_id": document.id, "uploaded": True})


@bp.post("/claims/<int:claim_id>/withdraw")
@require_role("claimant")
def withdraw_claim(claim_id):
    """Withdraw one of the caller's claims while it is still open."""
    claim = _own_claim_or_404(claim_id)
    try:
        intake.withdraw_claim(claim)
    except intake.IntakeError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"claim_id": claim.id, "status": claim.status})


@bp.post("/claims/<int:claim_id>/appeals")
@require_role("claimant")
def file_appeal(claim_id):
    """File an appeal against the caller's denied claim."""
    claim = _own_claim_or_404(claim_id)
    payload = validate_appeal(request.get_json(force=True))
    try:
        appeal = appeals.file_appeal(claim, payload["grounds"])
    except appeals.AppealError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"appeal_id": appeal.id, "status": appeal.status}), 201
