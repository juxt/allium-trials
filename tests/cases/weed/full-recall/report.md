# Weed findings: spec/courier.allium vs codebase

## Config drift: max_delivery_attempts

The spec's config block says `max_delivery_attempts: Integer = 5`, but
`config.py` defines `MAX_DELIVERY_ATTEMPTS = 3`. The dispatch guard and the
return sweep both key off the code value.

## Spec is missing pickup cancellation

`app/api/admin.py` exposes `POST /pickups/<id>/cancel` and the PickupRequest
model carries a `cancelled` status with `cancelled_at`, but the spec's
PickupRequest has no cancelled state, no CancelPickup rule and no cancel
action on any surface.

## Phantom behaviour: parcel archiving

The spec declares an `archived` status, a `delivered -> archived` transition,
an `archive_after` config value and an ArchiveDeliveredParcel rule. Nothing in
the codebase archives parcels — no job, no endpoint, no status string.

## DispatchParcel is missing the driver eligibility guard

`dispatch_parcel` in `app/services/dispatch.py` rejects drivers where
`driver.can_take_route()` is false (off shift), but the spec's DispatchParcel
rule has no requires clause about the driver at all.

## Spec is missing return-to-sender handling

The code's sweep job marks depot parcels with exhausted attempts as
`returned` and notifies the sender, but the spec has no returned status, no
return rule and no parcel_returned notification kind.

## Dead code: loyalty points

The codebase carries a LoyaltyPoints model that nothing awards or reads. The
spec excludes it deliberately (noted in its open questions), flagging here
for completeness.
