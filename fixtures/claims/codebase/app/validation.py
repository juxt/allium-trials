"""Lightweight request payload validation.

These helpers raise ``ValidationError`` with a field map; the API layer turns
that into a 422 response. Kept dependency-free on purpose.
"""

from datetime import datetime


class ValidationError(Exception):
    def __init__(self, errors):
        super().__init__("validation failed")
        self.errors = errors


def _require(payload, field, errors):
    if field not in payload or payload[field] in (None, ""):
        errors[field] = "required"
        return None
    return payload[field]


def _positive_int(value, field, errors):
    try:
        number = int(value)
    except (TypeError, ValueError):
        errors[field] = "must be an integer"
        return None
    if number <= 0:
        errors[field] = "must be positive"
        return None
    return number


def _iso_datetime(value, field, errors):
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        errors[field] = "must be an ISO-8601 datetime"
        return None


def validate_claim_submission(payload):
    """Validate a claimant's new-claim payload."""
    errors = {}
    _require(payload, "policy_id", errors)
    _require(payload, "peril", errors)

    amount = _require(payload, "amount_claimed", errors)
    if amount is not None:
        _positive_int(amount, "amount_claimed", errors)

    incident = _require(payload, "incident_date", errors)
    if incident is not None:
        _iso_datetime(incident, "incident_date", errors)

    if errors:
        raise ValidationError(errors)
    return payload


def validate_document_request(payload):
    errors = {}
    kind = _require(payload, "kind", errors)
    if kind is not None and len(str(kind)) > 64:
        errors["kind"] = "too long"
    if errors:
        raise ValidationError(errors)
    return payload


def validate_appeal(payload):
    errors = {}
    grounds = _require(payload, "grounds", errors)
    if grounds is not None and len(str(grounds)) < 10:
        errors["grounds"] = "please describe the grounds in more detail"
    if errors:
        raise ValidationError(errors)
    return payload
