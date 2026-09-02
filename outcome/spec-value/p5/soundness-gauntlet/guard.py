#!/usr/bin/env python3
"""Static-analysis soundness gauntlet.

The master `reproduce.py` guards the MONITOR (runtime traces). This guards the static ANALYSER
(`allium analyse`) — the layer where an unsound preservation pass was built and reverted on
2026-09-02. Each specimen carries a known-correct verdict; the tool's diagnostics must match.

Three verdicts:
  CLEAN  — no break/violation finding and no parse Error (a sound analyser stays silent).
  BREAK  — at least one "can break"/"does not establish" finding (a real bug must be caught).
  ERROR  — at least one Error-severity diagnostic (a malformed spec must be rejected, not mis-parsed).

The CLEAN cases are the important ones: they are the interacting shapes that expose false
positives. `trap_monotone_overwrite` is the exact pattern that broke the reverted relational pass.
Run: `python3 guard.py`. Exit 0 = every verdict matches.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P5 = os.path.dirname(HERE)
ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium"

# (spec, verdict, note)
CASES = [
    ("soundness-gauntlet/trap_monotone_overwrite.allium",   "CLEAN",
     "state-guarded bound + relational ordering over one state; advance only increases it"),
    ("soundness-gauntlet/trap_guarded_conservation.allium", "CLEAN",
     "balanced double-entry transfer, guarded debit, total conserved"),
    ("soundness-gauntlet/bug_unbalanced_transfer.allium",   "BREAK",
     "credit < debit: conservation genuinely broken"),
    ("soundness-gauntlet/reject_multi_ensures.allium",      "ERROR",
     "two separate ensures clauses must be rejected, not silently dropped"),
    ("loan-lifecycle/ledger_capstone.allium",               "CLEAN",
     "the hand-written capstone that exposed the unsound overwrite slice"),
    ("loan-lifecycle/loan_boundary_bug.allium",             "BREAK",
     "active-at-zero boundary bug"),
    ("loan-lifecycle/loan_fixed.allium",                    "CLEAN",
     "corrected loan lifecycle"),
    ("loan-lifecycle/account_system_capstone.allium",       "CLEAN",
     "open/frozen/closed + balances + conservation, fully inductive"),
    ("loan-lifecycle/conservation_transfer.allium",         "CLEAN",
     "balanced single-unit transfer"),
    # state-guarded arithmetic — the interacting shapes, each with a known verdict
    ("soundness-gauntlet/p1_guard_deactivated.allium",      "CLEAN",
     "close turns the guard off; the bound need not hold after"),
    ("soundness-gauntlet/p4_neg_guard_activated.allium",    "CLEAN",
     "settle makes a negated guard true and sets a valid value"),
    ("soundness-gauntlet/p5_neg_guard_break.allium",        "BREAK",
     "settle makes the guard true but sets a negative value"),
    ("soundness-gauntlet/p6_conj_guard_break.allium",       "BREAK",
     "bump pushes wm past the cap while the conjunctive guard holds"),
    ("soundness-gauntlet/p8_arith_guard_break.allium",      "BREAK",
     "jump sets wm above the band while status stays healthy"),
]

BREAK_MARKERS = ("can break", "does not establish", "init does not")


def verdict_of(spec):
    out = subprocess.run([ALLIUM, "analyse", os.path.join(P5, spec)], capture_output=True, text=True).stdout
    try:
        diags = json.loads(out)["diagnostics"]
    except Exception:
        return "PARSE-FAIL", []
    errs = [d for d in diags if d.get("severity") == "Error"]
    breaks = [d for d in diags if any(m in d["message"] for m in BREAK_MARKERS)]
    if errs:
        return "ERROR", errs
    if breaks:
        return "BREAK", breaks
    return "CLEAN", []


def main():
    fails = 0
    print(f"{'specimen':<48} {'expect':>7} {'got':>7}  result")
    print("-" * 78)
    for spec, want, _note in CASES:
        got, _ = verdict_of(spec)
        ok = got == want
        fails += not ok
        name = spec.split("/")[-1]
        print(f"{name:<48} {want:>7} {got:>7}  {'PASS' if ok else 'FAIL <<<'}")
    print("-" * 78)
    print("GAUNTLET CLEAN" if not fails else f"{fails} VERDICT(S) WRONG")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
