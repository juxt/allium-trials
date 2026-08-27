#!/usr/bin/env python3
"""Assurance register: consolidate the design-time and runtime verdicts for one spec into
an auditor-facing artifact. Each property is rendered with the strength-of-green vocabulary
(strength: proved | bounded | monitored; completeness: closed | assumed) and its evidence
(witness or blocking core). This is what the assurance value looks like as a deliverable:
a sound, reproducible, provenance-bearing record, not "a capable reviewer looked at it".

Usage: register.py <spec.allium> [<trace>]  ->  REGISTER.md on stdout
"""

import json
import subprocess
import sys

ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium"


def run(*args):
    return subprocess.run([ALLIUM, *args], capture_output=True, text=True)


def design_rows(spec):
    diags = json.loads(run("analyse", spec).stdout).get("diagnostics", [])
    rows, worst = [], "green"
    for d in diags:
        m = d.get("message", "")
        if "is CONTRADICTORY" in m:
            rows.append(("rule set", "consistency", "CONTRADICTORY", "bounded / closed", core(m, "core:")))
            worst = "red"
        elif "jointly satisfiable" in m:
            rows.append(("rule set", "consistency", "consistent", "bounded / closed", "SAT witness"))
        elif "INFEASIBLE" in m:
            rows.append((name(m, "requirement"), "feasibility", "INFEASIBLE", "bounded / closed", core(m, "Blocked by:")))
            worst = "red"
        elif "is feasible" in m:
            rows.append((name(m, "requirement"), "feasibility", "feasible", "bounded / closed", "report exists"))
        elif "is DISJOINT (sound" in m:
            rows.append((name(m, "case-split", "`"), "coverage", "disjoint", "proved / closed", "no overlapping guards"))
        elif "is NOT disjoint" in m:
            rows.append((name(m, "case-split", "`"), "coverage", "NOT disjoint", "proved / closed", "overlap witness"))
            worst = "red"
        elif "uncovered" in m:
            rows.append((name(m, "case-split", "`"), "coverage", "gap (axiom-relative)", "bounded / assumed", "state domain axioms"))
            worst = amber(worst)
    return rows, worst


def runtime_rows(spec, trace):
    rep = json.loads(run("monitor", spec, trace).stdout)
    rows, worst = [], "green"
    violated = {v["invariant"] for v in rep["violations"]}
    for v in rep["violations"]:
        ent = v.get("entity", "-")
        rows.append((v["invariant"], f"monitor ({v['kind']})", "VIOLATED", "monitored / measured",
                     f"t={v['t']} {ent}: {v['witness']}"))
        worst = "red"
    for s in rep["skipped"]:
        rows.append((s["invariant"], "monitor", "not monitored", "— / —", s["reason"]))
        worst = amber(worst)
    n_clean = rep["monitored"] - len(violated)
    return rows, worst, rep["events"], n_clean


def amber(w):
    return "amber" if w == "green" else w


def name(m, kind, q="`"):
    # extract the `name` after the kind keyword
    i = m.find(kind)
    seg = m[i:]
    a = seg.find(q)
    b = seg.find(q, a + 1)
    return seg[a + 1:b] if a >= 0 and b > a else kind


def core(m, marker):
    i = m.find(marker)
    if i < 0:
        return ""
    return m[i + len(marker):].split(".")[0].strip()


def table(rows):
    if not rows:
        return "_none_\n"
    out = ["| Property | Check | Verdict | Assurance | Evidence |", "|---|---|---|---|---|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out) + "\n"


def main():
    spec = sys.argv[1]
    trace = sys.argv[2] if len(sys.argv) > 2 else None
    drows, dworst = design_rows(spec)
    print(f"# Assurance register — {spec.split('/')[-1]}\n")
    print("Strength of green: **proved** (sound, no bound) · **bounded** (exact over the "
          "modelled domain) · **monitored** (observed on a trace). Completeness: **closed** "
          "(no assumptions) · **assumed** (relative to stated axioms).\n")
    print("## Design time\n")
    print(table(drows))
    worst = dworst
    if trace:
        rrows, rworst, events, n_clean = runtime_rows(spec, trace)
        print(f"\n## Runtime — {events} events observed\n")
        print(table(rrows))
        print(f"\n{n_clean} invariant(s) held over the trace.\n")
        worst = "red" if "red" in (worst, rworst) else amber(worst) if "amber" in (worst, rworst) else "green"
    badge = {"green": "GREEN", "amber": "AMBER", "red": "RED"}[worst]
    print(f"\n## Overall: {badge}\n")
    print("Every verdict above is machine-checked and reproducible on every build. A red or "
          "amber cell names the exact property, evidence, and stage — not a judgement call.\n")


if __name__ == "__main__":
    main()
