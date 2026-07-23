# Weed findings

## max_delivery_attempts mismatch

Spec config says 5 attempts, config.py says MAX_DELIVERY_ATTEMPTS = 3.

## Archiving exists only in the spec

The archived status, archive_after config and the ArchiveDeliveredParcel rule
have no counterpart anywhere in the codebase.

## Missing return-to-sender path

The sweep job returns exhausted parcels to the sender; the spec has no
returned status and no rule producing it.

## Webhook signature verification is not specified

The customs webhook verifies an HMAC signature before accepting a hold; the
spec's CustomsIntegration surface says nothing about authentication.

## Parcel weight is never validated in the spec

The registration endpoint rejects non-positive weight_grams; the spec's
RegisterParcel rule accepts any weight.
