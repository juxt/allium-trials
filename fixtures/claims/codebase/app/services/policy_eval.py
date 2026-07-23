"""Policy coverage evaluation.

The decision service delegates the coverage half of the approval
precondition here. Keeping the maths in one place means the limit, peril and
in-force checks are applied identically wherever coverage is questioned.
"""

from datetime import datetime


class CoverageResult:
    """The outcome of evaluating a claim against its policy."""

    def __init__(self, covered, reasons, payable):
        self.covered = covered
        self.reasons = reasons
        self.payable = payable

    def __bool__(self):
        return self.covered


def remaining_limit(policy, prior_paid):
    """Coverage limit less amounts already paid on the policy."""
    return max(policy.coverage_limit - prior_paid, 0)


def evaluate(claim, prior_paid=0, now=None):
    """Evaluate a claim against its policy and return a CoverageResult."""
    now = now or datetime.utcnow()
    policy = claim.policy
    reasons = []

    if not policy.is_active_on(claim.incident_date):
        reasons.append("policy not in force on the incident date")
    if not policy.covers_peril(claim.peril):
        reasons.append("peril not covered by the policy")

    limit = remaining_limit(policy, prior_paid)
    if claim.amount_claimed > limit:
        reasons.append("claim exceeds the remaining coverage limit")

    covered = not reasons
    capped = min(claim.amount_claimed, limit)
    payable = max(capped - policy.deductible, 0) if covered else 0
    return CoverageResult(covered, reasons, payable)
