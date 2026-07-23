"""Endpoints used by the driver mobile app."""

from datetime import datetime

from flask import Blueprint, jsonify, request

from app.auth import current_driver, require_role
from app.extensions import db
from app.models.delivery import DeliveryAttempt
from app.models.pickup import PickupRequest
from app.services import delivery

bp = Blueprint("driver", __name__, url_prefix="/driver")


@bp.post("/pickups/<int:pickup_id>/accept")
@require_role("driver")
def accept_pickup(pickup_id):
    """Claim a pending pickup request for the authenticated driver."""
    pickup = PickupRequest.query.get_or_404(pickup_id)
    if not pickup.is_pending:
        return jsonify({"error": "pickup request is no longer pending"}), 409

    driver = current_driver()
    pickup.assigned_driver_id = driver.id
    pickup.assigned_at = datetime.utcnow()
    db.session.commit()
    return jsonify(
        {"id": pickup.id, "assigned_at": pickup.assigned_at.isoformat()}
    )


@bp.post("/pickups/<int:pickup_id>/collect")
@require_role("driver")
def collect_pickup(pickup_id):
    """Confirm the parcel has been picked up from the customer."""
    pickup = PickupRequest.query.get_or_404(pickup_id)
    driver = current_driver()
    if not pickup.is_assigned or pickup.assigned_driver_id != driver.id:
        return jsonify({"error": "pickup is not assigned to you"}), 409

    pickup.collected_at = datetime.utcnow()
    parcel = pickup.parcel
    parcel.status = "collected"
    db.session.commit()
    return jsonify(
        {
            "id": pickup.id,
            "collected_at": pickup.collected_at.isoformat(),
            "parcel_status": parcel.status,
        }
    )


@bp.post("/attempts/<int:attempt_id>/outcome")
@require_role("driver")
def record_outcome(attempt_id):
    """Record the result of a delivery attempt on the driver's route."""
    attempt = DeliveryAttempt.query.get_or_404(attempt_id)
    if attempt.status != "pending":
        return jsonify({"error": "attempt has already been resolved"}), 409

    payload = request.get_json(force=True)
    outcome = payload.get("outcome")
    if outcome == "delivered":
        delivery.record_success(attempt)
    elif outcome == "failed":
        reason = payload.get("reason")
        if not reason:
            return jsonify({"error": "a failure reason is required"}), 400
        delivery.record_failure(attempt, reason)
    else:
        return jsonify({"error": "outcome must be 'delivered' or 'failed'"}), 400

    return jsonify(
        {"attempt_status": attempt.status, "parcel_status": attempt.parcel.status}
    )
