#!/usr/bin/env python3
"""Static-analysis soundness gauntlet.

The master `reproduce.py` guards the MONITOR (runtime traces). This guards the static ANALYSER
(`allium analyse`) — the layer where an unsound preservation pass was built and reverted on
2026-09-02. Each specimen carries a known-correct verdict; the tool's diagnostics must match.

Five verdicts:
  CLEAN  — no break/violation finding and no parse Error (a sound analyser stays silent).
  BREAK  — at least one "can break"/"does not establish" finding (a real bug must be caught).
  ERROR  — at least one Error-severity diagnostic (a malformed spec must be rejected, not mis-parsed).
  SAT    — a component genuinely SATISFIES its contract (refinement holds).
  NOSAT  — a component does NOT satisfy its contract (a false certification must be refused —
           the dangerous direction, so a weaker-than-promised component must never read as SAT).

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
    ("soundness-gauntlet/multi_ensures_conjoined.allium",   "CLEAN",
     "separate ensures lines conjoin (#60) — balanced transfer is PRESERVED, no parse error"),
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
    # refinement / contract entailment — the false-certification direction is the risk
    ("soundness-gauntlet/refine_stronger_arith_ok.allium",     "SAT",
     "component invariant net>=5 entails the promise net>=0"),
    ("soundness-gauntlet/refine_weaker_arith_refused.allium",  "NOSAT",
     "component only guarantees net>=-3; the promise net>=0 must be refused"),
    ("soundness-gauntlet/refine_weaker_guard_refused.allium",  "NOSAT",
     "component only guarantees active=>bal>=-1; the promise active=>bal>=0 must be refused"),
    # feasibility — a real contradiction is flagged; a satisfiable spec is never false-flagged
    ("soundness-gauntlet/feas_computed_contradiction.allium",  "INFEAS",
     "b>=a+1 with net=a-b and net>=0 is contradictory (via the computed given)"),
    ("soundness-gauntlet/feas_computed_satisfiable.allium",    "CLEAN",
     "a>=b with net=a-b and net>=0 is consistent — must not be false-flagged"),
    # #61 RESOLVED (cross-module givens + contracts). These specimens are analysed SINGLE-FILE by guard.py,
    # where imports correctly cannot resolve (you must pass the whole check set) — so they stay NODECL/CLEAN
    # by design. The multi-file resolution is covered by the t61_* integration tests in
    # allium/tests/cross_module_lifecycle.rs (weaker->NOSAT, stronger->SATISFIES, given break caught).
    ("soundness-gauntlet/xmod/xmod_refinement_gap.allium",     "NODECL",
     "single-file: imported contract unresolved by design; multi-file NOSAT covered by t61 tests"),
    ("soundness-gauntlet/xmod/xmod_given_gap.allium",          "CLEAN",
     "single-file: imported given unresolved by design; multi-file BREAK covered by t61 tests"),
    # types / dimensions and dead-state — both directions
    ("soundness-gauntlet/type_dimension_mismatch.allium",      "ERROR",
     "comparing Money with Count is a dimension error"),
    ("soundness-gauntlet/type_money_ops_ok.allium",            "CLEAN",
     "Money>=Money and Money+Money are valid — no false dimension error"),
    ("soundness-gauntlet/dead_enum_value.allium",              "DEAD",
     "enum value `archived` is never produced — flagged unreachable"),
    ("soundness-gauntlet/enum_input_not_dead.allium",          "CLEAN",
     "an enum INPUT (never written) must not be flagged dead"),
    # boolean-literal / biconditional encoding (guards the `= true` SAT fix)
    ("soundness-gauntlet/bool_literal_true_preserved.allium",  "CLEAN",
     "`ensures logged = true` preserves fail=>logged — no false break from the true literal"),
    ("soundness-gauntlet/bool_biconditional_break.allium",     "BREAK",
     "`a = b` broken by setting a=true, b=false"),
    # #63 RESOLVED: an `in { }` guard is now expanded and preservation-checked.
    ("soundness-gauntlet/in_guard_gap.allium",                 "BREAK",
     "promote into `role in {user,admin}` with active false breaks the guarded invariant"),
    # quantifiers, establishment, multi-promise refinement — verdict paths locked as regressions
    ("soundness-gauntlet/quant_universal_break.allium",        "BREAK",
     "deactivating an admin breaks `every x :: role=admin => active`"),
    ("soundness-gauntlet/establish_fail.allium",               "BREAK",
     "init bal=-5 does not establish bal>=0"),
    ("soundness-gauntlet/refine_multi_promise.allium",         "NOSAT",
     "Impl entails nonneg but not frozen_zero — the contract is not satisfied"),
    # relational 2-entity numeric ordering preservation (#49)
    ("soundness-gauntlet/rel_ordering_break.allium",           "BREAK",
     "bumping a version past another's without lifting its offset breaks the ordering"),
    ("soundness-gauntlet/rel_ordering_hypclean.allium",        "CLEAN",
     "off=ver hypothesis keeps a joint version+offset bump ordered — the reverted pass false-alarmed here"),
    # transitions desugaring (#48): legality invariant catches an undeclared transition
    ("soundness-gauntlet/transitions_legal.allium",            "CLEAN",
     "only declared edges occur; terminals never left"),
    ("soundness-gauntlet/transitions_illegal.allium",          "BREAK",
     "created -> delivered is not a declared edge — breaks the generated legality invariant"),
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
    msgs = [d["message"] for d in diags]
    nosat = [m for m in msgs if "does NOT satisfy" in m or "not entailed" in m]
    sat = [m for m in msgs if "SATISFIES" in m]
    infeas = [m for m in msgs if "CONTRADICTORY" in m or "not jointly satisfiable" in m.lower()
              or "unsatisfiable" in m.lower()]
    nodecl = [m for m in msgs if "no such contract is declared" in m]
    dead = [m for m in msgs if "never produced" in m or "is unreachable" in m]
    if errs:
        return "ERROR", errs
    if dead:
        return "DEAD", dead
    # NODECL only when it is NOT overridden by a genuine SAT/NOSAT (a resolved cross-module fix)
    if nodecl and not any("SATISFIES" in m or "does NOT satisfy" in m for m in msgs):
        return "NODECL", nodecl
    if infeas:
        return "INFEAS", infeas
    # a refused certification takes precedence over the SATISFIES banner for other promises
    if nosat:
        return "NOSAT", nosat
    if sat:
        return "SAT", sat
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
