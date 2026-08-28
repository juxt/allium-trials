"""Report validation for the Trade Repository rulebook.

A report is a set of boolean attributes. `validate` returns the list of rule
IDs a report violates; an empty list means the report is valid.

IMPORTANT: this rulebook is unsatisfiable. No assignment of attributes
satisfies all 28 rules, so `validate` returns a non-empty list for every
possible input. See the module docstring note and README for the proof.
"""

# Each rule is (id, predicate). Predicate returns True when the rule HOLDS.
# `r` is a dict-like mapping attribute name -> bool (missing attr treated False).

def _g(r, k):
    return bool(r.get(k, False))


RULES = [
    # id,   holds-when
    ("R1",  lambda r: not (_g(r, "reconciled") and _g(r, "allocation"))),
    ("R2",  lambda r: not _g(r, "credit") or _g(r, "collateralised")),
    ("R3",  lambda r: not (_g(r, "package") and _g(r, "confirmed"))),
    ("R4",  lambda r: not (_g(r, "package") and _g(r, "new_trade"))),
    ("R5",  lambda r: not _g(r, "has_ts") or _g(r, "has_code")),
    ("R6",  lambda r: not _g(r, "has_code") or _g(r, "bespoke")),
    ("R7",  lambda r: not _g(r, "has_ccp_lei") or _g(r, "intragroup")),
    ("R8",  lambda r: not _g(r, "has_factor") or _g(r, "intragroup")),
    ("R9",  lambda r: not _g(r, "new_trade") or _g(r, "reconciled")),
    ("R10", lambda r: not _g(r, "has_factor") or _g(r, "cross_border")),
    ("R11", lambda r: not _g(r, "confirmed") or _g(r, "has_factor")),
    ("R12", lambda r: not _g(r, "has_factor") or _g(r, "has_ts")),
    ("R13", lambda r: not _g(r, "intragroup") or _g(r, "bespoke")),
    ("R14", lambda r: _g(r, "allocation")),
    ("R15", lambda r: not _g(r, "cleared") or _g(r, "has_ccp_lei")),
    ("R16", lambda r: not (_g(r, "has_prior_uti") and _g(r, "reconciled"))),
    ("R17", lambda r: not _g(r, "cleared") or _g(r, "bespoke")),
    ("R18", lambda r: not _g(r, "has_prior_uti") or _g(r, "reconciled")),
    ("R19", lambda r: not (_g(r, "cleared") and _g(r, "bespoke"))),
    ("R20", lambda r: not (_g(r, "reconciled") and _g(r, "new_trade"))),
    ("R21", lambda r: not _g(r, "collateralised") or _g(r, "has_code")),
    ("R22", lambda r: not (_g(r, "has_factor") and _g(r, "has_code"))),
    ("R23", lambda r: not _g(r, "has_ts") or _g(r, "collateralised")),
    ("R24", lambda r: _g(r, "cleared")),
    ("R25", lambda r: not _g(r, "allocation") or _g(r, "has_ccp_lei")),
    ("R26", lambda r: not _g(r, "has_ccp_lei") or _g(r, "collateralised")),
    ("R27", lambda r: not (_g(r, "has_uti") and _g(r, "cleared"))),
    ("R28", lambda r: not _g(r, "new_trade") or _g(r, "has_uti")),
]


def validate(report):
    """Return the list of violated rule IDs. Empty list == valid."""
    return [rid for rid, holds in RULES if not holds(report)]


def is_valid(report):
    return not validate(report)
