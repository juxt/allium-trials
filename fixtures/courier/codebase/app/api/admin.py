"""Back-office endpoints used by depot and ops staff."""

from datetime import datetime

from flask import Blueprint, jsonify, request

from app.auth import require_role
from app.extensions import db
from app.models.driver import Driver
from app.models.parcel import Parcel
from app.models.pickup import PickupRequest
from app.services import cache
from app.services.dispatch import DispatchError, dispatch_parcel

bp = Blueprint("ops", __name__, url_prefix="/ops")


@bp.post("/parcels")
@require_role("admin")
def register_parcel():
    """Register a new shipment and open a pickup request for it."""
    payload = request.get_json(force=True)
    parcel = Parcel(
        sender_id=payload["sender_id"],
        recipient_id=payload["recipient_id"],
        weight_grams=payload["weight_grams"],
        is_international=payload.get("is_international", False),
        handling_flags=payload.get("handling_flags", []),
        meta=payload.get("metadata", {}),
        status="registered",
    )
    db.session.add(parcel)
    db.session.flush()

    pickup = PickupRequest(
        parcel_id=parcel.id,
        customer_id=payload["sender_id"],
        pickup_address=payload["pickup_address"],
        notes=payload.get("notes"),
    )
    db.session.add(pickup)
    db.session.commit()
    return (
        jsonify(
            {
                "parcel_id": parcel.id,
                "tracking_token": parcel.tracking_token,
                "pickup_request_id": pickup.id,
            }
        ),
        201,
    )


@bp.post("/parcels/<int:parcel_id>/depot-scan")
@require_role("admin")
def depot_scan(parcel_id):
    """Check a collected parcel into the depot."""
    parcel = Parcel.query.get_or_404(parcel_id)
    if parcel.status != "collected":
        return (
            jsonify({"error": f"cannot check in a parcel that is {parcel.status}"}),
            409,
        )
    parcel.status = "in_depot"
    db.session.commit()
    cache.invalidate_tracking(parcel.tracking_token)
    return jsonify({"parcel_id": parcel.id, "status": parcel.status})


@bp.post("/parcels/<int:parcel_id>/dispatch")
@require_role("admin")
def dispatch_for_delivery(parcel_id):
    """Send a depot parcel out for delivery with the chosen driver."""
    parcel = Parcel.query.get_or_404(parcel_id)
    if parcel.status != "in_depot":
        return jsonify({"error": "parcel is not in the depot"}), 409

    payload = request.get_json(force=True)
    driver = Driver.query.get_or_404(payload["driver_id"])
    try:
        attempt = dispatch_parcel(parcel, driver)
    except DispatchError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify({"attempt_id": attempt.id, "parcel_status": parcel.status})


@bp.post("/pickups/<int:pickup_id>/cancel")
@require_role("admin")
def cancel_pickup(pickup_id):
    """Cancel a pickup request that has not yet been collected."""
    pickup = PickupRequest.query.get_or_404(pickup_id)
    if not pickup.is_open:
        return jsonify({"error": "pickup request can no longer be cancelled"}), 409
    pickup.cancelled_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"id": pickup.id, "cancelled_at": pickup.cancelled_at.isoformat()})
