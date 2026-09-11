#!/usr/bin/env python3
# Spec completeness probe (mechanical, no judge). Given a v4 spec + a reference trace, report for each
# numeric output field whether the spec CONSTRAINS it: perturb the field (+delta) and check whether any
# monitored invariant now FAILS. An unconstrained field is a gate BLIND SPOT — drift there is uncatchable.
# Usage: python3 completeness_probe.py <spec.allium> <trace> [delta]
import sys, subprocess, json, re
ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium"
def monitor(spec, txt):
    open("/tmp/cp.trace","w").write(txt)
    r=subprocess.run([ALLIUM,"monitor",spec,"/tmp/cp.trace","--tol","0.02"],capture_output=True,text=True)
    try: d=json.loads(r.stdout); return d.get("ok",True), d.get("monitored",0)
    except: return True,0
def fields(txt):
    fs=set()
    for ln in txt.splitlines():
        if ln.startswith("period="):
            for tok in ln.split():
                k,_,v=tok.partition("=")
                if k not in ("period","is_last","rate_factor") and re.match(r"^-?[0-9.]+$", v): fs.add(k)
    return sorted(fs)
def bump(txt, field, delta):
    out=[]
    for ln in txt.splitlines():
        if ln.startswith("period="):
            ln=re.sub(rf"(\b{field}=)(-?[0-9.]+)", lambda m:m.group(1)+f"{float(m.group(2))+delta:.2f}", ln, count=1)
        out.append(ln)
    return "\n".join(out)+"\n"
def main():
    spec, trace = sys.argv[1], sys.argv[2]
    delta = float(sys.argv[3]) if len(sys.argv)>3 else 5.0
    txt=open(trace).read()
    base_ok, mon = monitor(spec, txt)
    print(f"baseline: monitored {mon} invariants, ok={base_ok}")
    if not base_ok: print("  (spec does not hold on baseline — fix faithfulness first)")
    print("field constraint check (perturb +{:.0f}, is drift caught?):".format(delta))
    constrained=blind=0
    for f in fields(txt):
        ok_after, _ = monitor(spec, bump(txt, f, delta))
        drift_caught = not ok_after
        verdict = "CONSTRAINED" if drift_caught else "BLIND SPOT (no invariant constrains it — drift uncatchable)"
        print(f"  {f:20} {verdict}")
        if drift_caught: constrained+=1
        else: blind+=1
    print(f"=> {constrained} constrained, {blind} blind spot(s). A complete gate has 0 blind spots on load-bearing outputs.")
main()
