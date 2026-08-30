#!/usr/bin/env python3
# Mechanical oracle: run a candidate schedule() implementation against the 150 real Fineract traces.
# No judge. Reports per-schedule max residual, match counts at tolerances, and structural correctness.
# Usage: python3 grade.py <candidate.py>
#   candidate.py must define: schedule(disbursed: float, annual_rate_pct: float, months: int) -> list
#   each element a dict/obj with keys emi, interest, principal, outstanding_start (floats).
import sys, os, json, importlib.util, math

TRACES = "/Users/hgarner/code/allium-trials/outcome/fineract/traces_baseline"

def load_trace(path):
    periods = []
    for line in open(path):
        line = line.strip()
        if not line.startswith("period="):
            continue
        d = {}
        for tok in line.split():
            k, v = tok.split("=")
            d[k] = v
        periods.append({k: float(d[k]) for k in ("emi","interest","principal","outstanding_start") if k in d})
    return periods

def load_manifest():
    rows = []
    mf = os.path.join(TRACES, "manifest.csv")
    lines = open(mf).read().splitlines()
    hdr = lines[0].split(",")
    for ln in lines[1:]:
        vals = ln.split(",")
        r = dict(zip(hdr, vals))
        rows.append(r)
    return rows

def main():
    cand_path = sys.argv[1]
    spec = importlib.util.spec_from_file_location("cand", cand_path)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        print(json.dumps({"error": f"import failed: {e}", "matched_0.01": 0, "matched_0.50": 0, "matched_5.00": 0, "n": 0, "crashed": True}))
        return
    if not hasattr(mod, "schedule"):
        print(json.dumps({"error": "no schedule() defined", "matched_0.01": 0, "n": 0, "crashed": True}))
        return

    rows = load_manifest()
    tols = [0.01, 0.50, 5.00]
    matched = {t: 0 for t in tols}
    n = 0
    crashes = 0
    struct_ok = 0          # right number of periods
    closes = 0             # final outstanding - principal ~ 0
    residuals = []
    per = []
    for r in rows:
        tid = r["id"]
        tpath = os.path.join(TRACES, tid + ".trace")
        if not os.path.exists(tpath):
            continue
        ref = load_trace(tpath)
        n += 1
        disbursed = float(r["disbursed"]); rate = float(r["annualRatePercent"]); months = int(r["months"])
        try:
            got = mod.schedule(disbursed, rate, months)
            got = [dict(g) if not isinstance(g, dict) else g for g in got]
        except Exception:
            crashes += 1
            residuals.append(float("inf"))
            per.append({"id": tid, "maxres": None, "crash": True})
            continue
        # structural: same period count
        if len(got) == len(ref):
            struct_ok += 1
        # closes to zero on candidate's own last period
        if got:
            last = got[-1]
            try:
                if abs(float(last.get("outstanding_start",0)) - float(last.get("principal",0))) < 0.5:
                    closes += 1
            except Exception:
                pass
        # per-field max residual over min common length
        m = min(len(got), len(ref))
        maxres = 0.0
        if len(got) != len(ref):
            maxres = max(maxres, 1e6)  # structural miss = large residual
        for i in range(m):
            for k in ("emi","interest","principal","outstanding_start"):
                if k in ref[i]:
                    try:
                        maxres = max(maxres, abs(float(got[i].get(k, 1e9)) - ref[i][k]))
                    except Exception:
                        maxres = 1e9
        residuals.append(maxres)
        per.append({"id": tid, "maxres": round(maxres,4) if maxres < 1e6 else "structural/crash"})
        for t in tols:
            if maxres <= t:
                matched[t] += 1
    finite = [x for x in residuals if x != float("inf") and x < 1e6]
    med = sorted(finite)[len(finite)//2] if finite else None
    out = {
        "n": n, "crashes": crashes, "struct_ok": struct_ok, "closes_to_zero": closes,
        "matched_0.01": matched[0.01], "matched_0.50": matched[0.50], "matched_5.00": matched[5.00],
        "median_residual_finite": round(med,4) if med is not None else None,
        "worst_offenders": sorted([p for p in per if isinstance(p.get("maxres"), (int,float))], key=lambda p: -p["maxres"])[:3],
    }
    print(json.dumps(out))

if __name__ == "__main__":
    main()
