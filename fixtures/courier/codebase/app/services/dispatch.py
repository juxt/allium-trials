"""Dispatching parcels out of the depot onto a driver's route."""

from app.extensions import db
from app.models.customs import CustomsHold
from app.models.delivery import DeliveryAttempt
from app.services import cache


class DispatchError(Exception):
    """Raised when a parcel cannot be sent out for delivery."""


def dispatch_parcel(parcel, driver):
    """Put a depot parcel on the given driver's route.

    Creates the pending delivery attempt and moves the parcel out for
    delivery. Callers are expected to have verified the parcel is in the
    depot before handing it to us.
    """
    active_hold = CustomsHold.query.filter_by(
        parcel_id=parcel.id, status="held"
    ).first()
    if active_hold is not None:
        raise DispatchError("parcel is held by customs")
    if not driver.can_take_route():
        raise DispatchError("driver is not available for a route")

    attempt = DeliveryAttempt(parcel_id=parcel.id, driver_id=driver.id, status="pending")
    parcel.status = "out_for_delivery"
    db.session.add(attempt)
    db.session.commit()
    cache.invalidate_tracking(parcel.tracking_token)
    return attempt
