"""Inbound webhooks from external systems (customs broker, CRM)."""

from datetime import datetime

from flask import Blueprint, jsonify, request

import config
from app.auth import require_api_key
from app.extensions import db
from app.models.customs import CustomsHold
from app.models.parcel import Parcel
from app.services import crm_sync

bp = Blueprint("webhooks", __name__, url_prefix="/webhooks")


@bp.post("/customs")
@require_api_key(config.CUSTOMS_WEBHOOK_API_KEY)
def customs_event():
    payload = request.get_json(force=True)
    event = payload.get("event")
    if event == "hold.created":
        return _create_hold(payload)
    if event == "hold.released":
        return _release_hold(payload)
    return jsonify({"error": f"unknown event {event!r}"}), 400


def _create_hold(payload):
    parcel = Parcel.query.filter_by(
        tracking_token=payload["tracking_token"]
    ).first_or_404()
    if not parcel.is_international:
        return (
            jsonify({"error": "customs holds only apply to international parcels"}),
            422,
        )
    hold = CustomsHold(
        parcel_id=parcel.id,
        status="held",
        broker_reference=payload["reference"],
        reason=payload.get("reason"),
    )
    db.session.add(hold)
    db.session.commit()
    return jsonify({"hold_id": hold.id, "status": hold.status}), 201


def _release_hold(payload):
    hold = CustomsHold.query.filter_by(
        broker_reference=payload["reference"]
    ).first_or_404()
    if hold.status != "held":
        return jsonify({"error": "hold is not active"}), 409
    hold.status = "released"
    hold.released_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"hold_id": hold.id, "status": hold.status})


@bp.post("/crm")
@require_api_key(config.CRM_WEBHOOK_API_KEY)
def crm_customer_event():
    """Upsert pushed by the CRM whenever a customer record changes there."""
    payload = request.get_json(force=True)
    customer = crm_sync.upsert_customer(payload["customer"])
    return jsonify({"customer_id": customer.id, "crm_id": customer.crm_id})
