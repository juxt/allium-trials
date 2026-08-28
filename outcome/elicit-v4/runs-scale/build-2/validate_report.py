"""Report validation for the Trade Repository rulebook.

A report is a set of boolean attributes. `validate` returns the list of rule
violations for a given report; an empty list means the report is valid.

IMPORTANT — the rulebook is unsatisfiable as written.
R27, R22, R17 and R7 form a forced contradiction that applies to every
report, so no report can ever pass. See `feasibility_report()` for the proof.
The checks below are still implemented faithfully; do not weaken any rule to
make reports pass without a decision from the rulebook owner.
"""

from typing import Callable

# An attribute is present iff its key maps to True. Absent keys read as False.
Report = dict[str, bool]


def has(report: Report, attr: str) -> bool:
    return bool(report.get(attr, False))


# Each rule is (id, human-readable text, predicate that returns True when the
# rule is SATISFIED by the report).
Rule = tuple[str, str, Callable[[Report], bool]]


def _not_both(a: str, b: str) -> Callable[[Report], bool]:
    return lambda r: not (has(r, a) and has(r, b))


def _implies(a: str, b: str) -> Callable[[Report], bool]:
    return lambda r: (not has(r, a)) or has(r, b)


def _never(a: str) -> Callable[[Report], bool]:
    return lambda r: not has(r, a)


def _always(a: str) -> Callable[[Report], bool]:
    return lambda r: has(r, a)


RULES: list[Rule] = [
    ("R1",  "must not have both has_code and intragroup",        _not_both("has_code", "intragroup")),
    ("R2",  "no report has has_prior_uti",                       _never("has_prior_uti")),
    ("R3",  "has_code -> new_trade",                             _implies("has_code", "new_trade")),
    ("R4",  "collateralised -> has_code",                        _implies("collateralised", "has_code")),
    ("R5",  "has_uti -> bespoke",                                _implies("has_uti", "bespoke")),
    ("R6",  "must not have both has_code and reconciled",        _not_both("has_code", "reconciled")),
    ("R7",  "no report has collateralised",                      _never("collateralised")),
    ("R8",  "has_pkg_id -> has_factor",                          _implies("has_pkg_id", "has_factor")),
    ("R9",  "must not have both collateralised and has_pkg_id",  _not_both("collateralised", "has_pkg_id")),
    ("R10", "must not have both has_code and has_ts",            _not_both("has_code", "has_ts")),
    ("R11", "has_factor -> package",                             _implies("has_factor", "package")),
    ("R12", "has_prior_uti -> confirmed",                        _implies("has_prior_uti", "confirmed")),
    ("R13", "has_code -> bespoke",                               _implies("has_code", "bespoke")),
    ("R14", "must not have both has_factor and allocation",      _not_both("has_factor", "allocation")),
    ("R15", "must not have both cleared and bespoke",            _not_both("cleared", "bespoke")),
    ("R16", "must not have both has_ts and has_uti",             _not_both("has_ts", "has_uti")),
    ("R17", "has_ccp_lei -> collateralised",                     _implies("has_ccp_lei", "collateralised")),
    ("R18", "has_prior_uti -> has_uti",                          _implies("has_prior_uti", "has_uti")),
    ("R19", "every report has package",                          _always("package")),
    ("R20", "has_uti -> intragroup",                             _implies("has_uti", "intragroup")),
    ("R21", "credit -> bespoke",                                 _implies("credit", "bespoke")),
    ("R22", "cleared -> has_ccp_lei",                            _implies("cleared", "has_ccp_lei")),
    ("R23", "allocation -> has_pkg_id",                          _implies("allocation", "has_pkg_id")),
    ("R24", "has_code -> bespoke",                               _implies("has_code", "bespoke")),
    ("R25", "must not have both reconciled and new_trade",       _not_both("reconciled", "new_trade")),
    ("R26", "collateralised -> has_code",                        _implies("collateralised", "has_code")),
    ("R27", "every report has cleared",                          _always("cleared")),
    ("R28", "reconciled -> has_ccp_lei",                         _implies("reconciled", "has_ccp_lei")),
]


def validate(report: Report) -> list[str]:
    """Return a list of violated rule ids (e.g. ['R7', 'R17']). Empty == valid."""
    return [rid for rid, _text, ok in RULES if not ok(report)]


def is_valid(report: Report) -> bool:
    return not validate(report)


def explain(report: Report) -> list[str]:
    """Human-readable violation lines."""
    return [f"{rid}: {text}" for rid, text, ok in RULES if not ok(report)]


def feasibility_report() -> str:
    """Static proof that the accept-set is empty. No report satisfies all rules.

    R27 forces cleared = True.
    R22 (cleared -> has_ccp_lei) then forces has_ccp_lei = True.
    R17 (has_ccp_lei -> collateralised) then forces collateralised = True.
    R7  (no collateralised) requires collateralised = False.
    Contradiction. Minimal unsatisfiable core: {R7, R17, R22, R27}.
    """
    return feasibility_report.__doc__


if __name__ == "__main__":
    print(feasibility_report())
    # Demonstrate: even the "emptiest" report already violates the core.
    empty: Report = {}
    print("empty report violates:", validate(empty))  # includes R19, R27 ...
    # And no assignment of the core attributes escapes it:
    for cleared in (False, True):
        for lei in (False, True):
            for coll in (False, True):
                r = {"cleared": cleared, "has_ccp_lei": lei, "collateralised": coll,
                     "package": True}
                core = [v for v in validate(r) if v in {"R7", "R17", "R22", "R27"}]
                assert core, "core should always be violated"
    print("confirmed: no assignment satisfies the core {R7, R17, R22, R27}")
