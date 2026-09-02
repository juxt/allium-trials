#!/usr/bin/env python3
"""Reproducer — re-run the headline EXECUTABLE claims and assert each against its expected outcome.

Turns the value-prop evidence from "trust these numbers" into a re-runnable regression. Every case is a
real spec + trace checked by the v4 binary; no LLM judge. Run: `python3 reproduce.py`. Exit 0 = all claims
reproduce. This script is itself the guard that caught the malformed-trace / vacuous-monitor bug in P3.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium"

def monitor(spec, trace, schedule=False):
    cmd = [ALLIUM, "monitor-schedule" if schedule else "monitor", spec, trace]
    if schedule: cmd += ["--tol", "0.01"]
    d = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    if schedule:
        holds = all(x["holds"] for x in d["results"])
        return holds, []
    return d["ok"], d.get("warnings", [])

# (label, spec, trace, schedule?, expect_hold, expect_warn) — the headline behavioural claims.
P = "p3/temporal"; L = "p5/liveness"; S = "p5/showcase"; C = "p5/capstone"; G = "p5/generality"
CASES = [
    # temporal ordering (capture must follow a prior auth)
    ("ordering: auth->capture holds",      f"{P}/payments.allium", f"{P}/pay_ok.trace",  False, True,  False),
    ("ordering: capture w/o auth fires",   f"{P}/payments.allium", f"{P}/pay_bad.trace", False, False, False),
    # idempotency / no-double-spend (uniqueness of txn id)
    ("idempotency: unique ids hold",       f"{P}/idem.allium",     f"{P}/idem_ok.trace", False, True,  False),
    ("idempotency: duplicate id fires",    f"{P}/idem.allium",     f"{P}/idem_dup.trace",False, False, False),
    # uniqueness (at most one open)
    ("uniqueness: one open holds",         f"{P}/uniq.allium",     f"{P}/uniq_ok.trace", False, True,  False),
    ("uniqueness: two open fires",         f"{P}/uniq.allium",     f"{P}/uniq_bad.trace",False, False, False),
    # generality beyond banking (order-fulfilment workflow)
    ("workflow: legal path holds",         f"{G}/orders.allium",   f"{G}/good.trace",       False, True,  False),
    ("workflow: ship-before-pay fires",    f"{G}/orders.allium",   f"{G}/ship_nopay.trace", False, False, False),
    # liveness via measure (progress must be made and discharged)
    ("liveness: progresses holds",         f"{L}/progress.allium", f"{L}/good.trace",  True,  True,  False),
    ("liveness: stuck measure fires",      f"{L}/progress.allium", f"{L}/stuck.trace", True,  False, False),
    ("liveness: never-discharged fires",   f"{L}/progress.allium", f"{L}/nofin.trace", True,  False, False),
    # value/caps/tiers (arithmetic gate)
    ("caps: correct holds",                f"{S}/product.allium",  f"{S}/ok.trace",       True,  True,  False),
    ("caps: fee-cap breach fires",         f"{S}/product.allium",  f"{S}/mut_fee.trace",  True,  False, False),
    ("tiers: wrong tier fires",            f"{S}/product.allium",  f"{S}/mut_tier.trace", True,  False, False),
    # capstone: one spec, four bug classes, zero false positives on the correct build
    ("capstone: correct build holds",      f"{C}/loan.allium",     f"{C}/ok.trace",    True,  True,  False),
]

def main():
    fails = 0
    print(f"{'claim':<40} {'expect':>8} {'got':>8}  result")
    print("-"*72)
    for label, spec, trace, sched, exp_hold, exp_warn in CASES:
        hold, warns = monitor(os.path.join(HERE, spec), os.path.join(HERE, trace), sched)
        got_warn = len(warns) > 0
        ok = (hold == exp_hold) and (got_warn == exp_warn)
        fails += not ok
        e = "HOLD" if exp_hold else "FIRE"
        g = ("HOLD" if hold else "FIRE") + (" +warn" if got_warn else "")
        print(f"{label:<40} {e:>8} {g:>8}  {'PASS' if ok else 'FAIL <<<'}")

    # Vacuity guard: a relational spec over an identity-less trace must WARN, not silently pass.
    vac_spec = "/tmp/_vac.allium"; vac_tr = "/tmp/_vac.trace"
    open(vac_spec,"w").write("-- allium: 4\ncomponent L\n  entity P\n  observable state txn(P) : Rate\n"
                             "  invariant no_replay means every a :: every b :: txn(a) = txn(b) implies a = b\nend\n")
    open(vac_tr,"w").write("txn=1\ntxn=1\n")
    hold, warns = monitor(vac_spec, vac_tr, False)
    vac_ok = hold and len(warns) > 0  # vacuously holds BUT warns
    fails += not vac_ok
    print(f"{'vacuity guard: warns on collapsed trace':<40} {'WARN':>8} {('WARN' if warns else 'silent'):>8}  {'PASS' if vac_ok else 'FAIL <<<'}")

    # spec-vs-test: the gate equals a correct oracle test on value bugs (run its harness, read result.json).
    rc = subprocess.run([sys.executable, os.path.join(HERE, "p5/spec-vs-test/harness.py")],
                        capture_output=True, text=True)
    try:
        r = json.load(open(os.path.join(HERE, "p5/spec-vs-test/result.json")))
        m = r["matrix"]
        # every value/structural mutation: v4 gate catch count == oracle test catch count
        eq = all(v[1] == v[2] for k, v in m.items())
        anchor = r["anchor"]  # (property, oracle-shared-belief, spec) — spec must beat the shared-belief test
        anchor_ok = anchor[2] > anchor[1]
        st_ok = eq and anchor_ok
    except Exception as e:
        st_ok = False
    fails += not st_ok
    print(f"{'spec-vs-test: gate==oracle, anchor wins':<40} {'TRUE':>8} {str(st_ok).upper():>8}  {'PASS' if st_ok else 'FAIL <<<'}")

    # static-analysis soundness gauntlet: known-verdict specimens for `allium analyse`, including the
    # interacting shapes that expose false positives (the reverted unsound pass). Separate from the
    # monitor claims above — this guards the static analyser.
    g = subprocess.run([sys.executable, os.path.join(HERE, "p5/soundness-gauntlet/guard.py")],
                       capture_output=True, text=True)
    gauntlet_ok = g.returncode == 0
    fails += not gauntlet_ok
    print(f"{'static gauntlet: analyse verdicts match':<40} {'CLEAN':>8} {('CLEAN' if gauntlet_ok else 'WRONG'):>8}  {'PASS' if gauntlet_ok else 'FAIL <<<'}")

    print("-"*72)
    print(f"{'ALL CLAIMS REPRODUCE' if not fails else str(fails)+' CLAIM(S) FAILED'}")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
