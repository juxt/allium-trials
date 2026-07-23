"""Structured audit logging.

Every state-changing action funnels a short event through here. We do not
keep a queryable audit table in this service; events are emitted to the
application log and shipped to the central log sink by the platform.
"""

import json
import logging

logger = logging.getLogger("claimflow.audit")


def record(action, *, actor=None, claim=None, **fields):
    """Emit a single structured audit event."""
    event = {"action": action}
    if actor is not None:
        event["actor"] = actor
    if claim is not None:
        event["claim_reference"] = getattr(claim, "reference", None)
        event["claim_status"] = getattr(claim, "status", None)
    event.update(fields)
    logger.info("audit %s", json.dumps(event, default=str, sort_keys=True))


def record_transition(entity_name, entity_id, from_status, to_status):
    """Convenience wrapper for a status change."""
    record(
        "transition",
        entity=entity_name,
        entity_id=entity_id,
        from_status=from_status,
        to_status=to_status,
    )
