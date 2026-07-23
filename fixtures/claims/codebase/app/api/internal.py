"""Internal ops dashboard endpoints (role ``manager``).

Read-only metrics for the operations team. Mounted alongside the manager
surface; kept separate so the dashboard can be cached independently of the
action endpoints.
"""

from flask import Blueprint, jsonify

from app.auth import require_role
from app.services import reporting

bp = Blueprint("internal", __name__, url_prefix="/internal")


@bp.get("/dashboard")
@require_role("manager")
def dashboard():
    """Aggregate queue and settlement metrics."""
    return jsonify(reporting.dashboard_snapshot())


@bp.get("/metrics/claims")
@require_role("manager")
def claim_metrics():
    return jsonify(
        {
            "by_status": reporting.claim_status_breakdown(),
            "average_decision_age_days": reporting.average_decision_age_days(),
        }
    )


@bp.get("/metrics/settlement")
@require_role("manager")
def settlement_metrics():
    return jsonify(
        {
            "payments": reporting.payment_status_breakdown(),
            "totals": reporting.settlement_totals(),
        }
    )


@bp.get("/metrics/adjusters")
@require_role("manager")
def adjuster_metrics():
    return jsonify({"load": reporting.adjuster_load()})
