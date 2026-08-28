"""
Trade Repository report validator.

A report is a set of boolean attributes. `validate(report)` returns the list of
rule IDs the report violates; an empty list means the report is valid.

The rulebook is encoded declaratively as a table so the checks are auditable
against the published text one line at a time.
"""

# All attributes referenced by the rulebook.
ATTRS = [
    "has_code", "bespoke", "cleared", "has_factor", "has_prior_uti",
    "new_trade", "cross_border", "has_uti", "has_ccp_lei", "collateralised",
    "confirmed", "credit", "package", "intragroup", "reconciled", "has_ts",
]

# Three rule shapes:
#   ("require", X)        -> every report must have X                (R_: every report has X)
#   ("implies", A, B)     -> if A then B                            (R_: if A, it must have B)
#   ("exclude", A, B)     -> not (A and B)                          (R_: must not have both A and B)
RULES = {
    "R1":  ("implies", "has_code", "bespoke"),
    "R2":  ("exclude", "bespoke", "cleared"),
    "R3":  ("implies", "has_factor", "has_prior_uti"),
    "R4":  ("exclude", "new_trade", "cross_border"),
    "R5":  ("exclude", "cleared", "bespoke"),
    "R6":  ("implies", "has_uti", "has_prior_uti"),
    "R7":  ("implies", "has_ccp_lei", "collateralised"),
    "R8":  ("implies", "confirmed", "has_uti"),
    "R9":  ("implies", "has_uti", "cleared"),
    "R10": ("exclude", "confirmed", "has_factor"),
    "R11": ("exclude", "has_code", "cross_border"),
    "R12": ("exclude", "has_ccp_lei", "has_code"),
    "R13": ("implies", "cleared", "has_ccp_lei"),
    "R14": ("implies", "collateralised", "intragroup"),
    "R15": ("exclude", "has_uti", "credit"),
    "R16": ("implies", "package", "has_uti"),
    "R17": ("require", "has_ccp_lei"),
    "R18": ("exclude", "cleared", "has_factor"),
    "R19": ("exclude", "package", "has_uti"),
    "R20": ("exclude", "collateralised", "cross_border"),
    "R21": ("require", "cleared"),
    "R22": ("implies", "has_ccp_lei", "reconciled"),
    "R23": ("exclude", "bespoke", "confirmed"),
    "R24": ("implies", "collateralised", "reconciled"),
    "R25": ("exclude", "collateralised", "new_trade"),
    "R26": ("require", "has_ts"),
    "R27": ("implies", "collateralised", "has_code"),
    "R28": ("exclude", "bespoke", "has_uti"),
}


def validate(report):
    """Return the sorted list of rule IDs violated by `report` (a dict/set of
    attribute -> bool). Missing attributes are treated as False."""
    def has(a):
        return bool(report.get(a, False)) if isinstance(report, dict) else (a in report)

    violations = []
    for rid, rule in RULES.items():
        kind = rule[0]
        if kind == "require":
            if not has(rule[1]):
                violations.append(rid)
        elif kind == "implies":
            if has(rule[1]) and not has(rule[2]):
                violations.append(rid)
        elif kind == "exclude":
            if has(rule[1]) and has(rule[2]):
                violations.append(rid)
    return sorted(violations, key=lambda r: int(r[1:]))


def is_valid(report):
    return not validate(report)


def _satisfiable():
    """Brute-force every assignment; return a witness report if one is valid,
    else None. 16 attributes -> 65 536 assignments, exhaustive and sound."""
    from itertools import product
    for combo in product((False, True), repeat=len(ATTRS)):
        report = dict(zip(ATTRS, combo))
        if is_valid(report):
            return report
    return None


if __name__ == "__main__":
    witness = _satisfiable()
    if witness is None:
        print("UNSAT: no report can satisfy all 28 rules. Every input is rejected.")
    else:
        print("SAT: example valid report ->", {k: v for k, v in witness.items() if v})
