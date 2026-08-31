#!/usr/bin/env python3
"""Where the arithmetic tier adds gate value, on REAL Fineract traces.

Fills the gap VALUE-FINDINGS flagged: the absolute value invariant (interest = rate x balance) was never
checked against real code because the traces omitted rate_factor. We reconstruct rate_factor from the
INPUT rate (the filename, independent of the emitted interest), emit augmented traces, and compare a
STRUCTURAL-ONLY spec against the FULL spec (structural + the absolute invariant) as a gate, against:
  - the real correct schedules (false-alarm test)
  - a STRUCTURE-PRESERVING VALUE mutation (interest and emi shifted by the same delta: every structural
    invariant still holds by construction; only interest-vs-rate is wrong). This is the "consistent-value
    bug" of the desync law, on real Fineract data.
  - a STRUCTURAL mutation (drop a principal so conservation breaks) as a control both should catch.
No LLM judge; the oracle is real Fineract's own recorded output.
"""
import os, re, subprocess, json, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium"
FIN = "/Users/hgarner/code/allium-trials/outcome/fineract/traces"
STRUCT = os.path.join(HERE, "structural.allium")
FULL = os.path.join(HERE, "full.allium")

def real_traces():
    for f in sorted(os.listdir(FIN)):
        m = re.match(r'^d([\d.]+)_r([\d.]+)_m(\d+)\.trace$', f)
        if not m: continue
        yield f, float(m.group(1)), float(m.group(2)), int(m.group(3))

def parse(path):
    periods, disbursed = [], None
    for line in open(path):
        line = line.strip()
        if line.startswith("period="):
            periods.append(dict(tok.split("=") for tok in line.split() if "=" in tok))
        elif line.startswith("given"):
            for tok in line.split():
                if tok.startswith("disbursed="): disbursed = tok.split("=")[1]
    return periods, disbursed

def emit(periods, disbursed, rate, path):
    rf = rate/1200.0
    with open(path, "w") as fh:
        for i, p in enumerate(periods):
            last = (i == len(periods)-1)
            fh.write(f"period={i} emi={p['emi']} interest={p['interest']} principal={p['principal']} "
                     f"outstanding_start={p['outstanding_start']} rate_factor={rf:.6f} "
                     f"is_last={'T' if last else 'F'}\n")
        fh.write(f"given disbursed={disbursed}\n")

def r2(x):
    from decimal import Decimal, ROUND_HALF_EVEN
    return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))

def annuity(disbursed, rate, months):
    # A self-consistent declining-balance schedule. Used to build a WRONG-RATE mutant: emi constant,
    # principal = emi - interest, conservation and closes-to-zero exact by construction -> EVERY
    # structural invariant holds. Only interest-vs-declared-rate is wrong.
    f = rate/1200.0
    base = r2(disbursed*f*(1+f)**months/((1+f)**months-1)) if f else r2(disbursed/months)
    out=[]; bal=disbursed
    for i in range(months):
        pure = r2(bal*f); principal = bal if i==months-1 else r2(base-pure)
        out.append({"emi": f"{r2(pure+principal):.2f}", "interest": f"{pure:.2f}",
                    "principal": f"{principal:.2f}", "outstanding_start": f"{r2(bal):.2f}"})
        bal = r2(bal-principal)
    return out

def mutate_value(periods, disbursed=None, rate=None, months=None):
    # Structure-preserving VALUE bug: recompute the whole schedule at a WRONG rate (1.1x). The result
    # is fully self-consistent (all structural invariants hold), but interest no longer matches the
    # DECLARED rate the trace carries in rate_factor. Zero-rate loans have no interest to corrupt -> skip.
    if not rate: return None
    return annuity(float(disbursed), rate*1.1, months)

def mutate_structural(periods):
    # Break conservation: shave 0.50 off the first period's principal.
    out = [dict(p) for p in periods]
    if out: out[0]["principal"] = f"{float(out[0]['principal'])-0.50:.2f}"
    return out

def gate(spec, trace):
    d = json.loads(subprocess.run([ALLIUM, "monitor-schedule", spec, trace, "--tol", "0.01"],
                                  capture_output=True, text=True).stdout)
    holds = all(x["holds"] for x in d["results"])
    fired = [x["invariant"] for x in d["results"] if not x["holds"]]
    return holds, fired

def run():
    tmp = tempfile.mkdtemp()
    rows = list(real_traces())
    res = {c: {"structural": [0,0], "full": [0,0]} for c in ("baseline","value_mut","struct_mut")}
    firing = {c: {"structural":{}, "full":{}} for c in res}
    scale_false_alarm = []
    for f, disb, rate, months in rows:
        periods, disbursed = parse(os.path.join(FIN, f))
        variants = {"baseline": periods, "struct_mut": mutate_structural(periods)}
        vm = mutate_value(periods, disbursed, rate, months)
        if vm is not None: variants["value_mut"] = vm   # skip zero-rate (no interest to corrupt)
        for c, per in variants.items():
            tp = os.path.join(tmp, f"{c}_{f}")
            emit(per, disbursed, rate, tp)
            for spec, name in [(STRUCT, "structural"), (FULL, "full")]:
                holds, fired = gate(spec, tp)
                res[c][name][1] += 1
                res[c][name][0] += (1 if not holds else 0)   # baseline: 0 wanted (false alarms); muts: high wanted
                if c == "baseline" and not holds and name == "full":
                    scale_false_alarm.append((f, disb))
                for inv in fired: firing[c][name][inv] = firing[c][name].get(inv,0)+1
    return res, firing, len(rows), scale_false_alarm

if __name__ == "__main__":
    res, firing, n, scale = run()
    def row(label, c):
        s, fu = res[c]["structural"], res[c]["full"]
        return f"{label:<34}{f'{s[0]}/{s[1]}':>18}{f'{fu[0]}/{fu[1]}':>18}"
    print(f"# Gate value on {n} REAL Fineract schedules — structural-only vs full (+ absolute invariant)\n")
    print(f"{'scenario':<34}{'structural':>18}{'full':>18}")
    print("-"*70)
    print(row("baseline: FALSE ALARMS (want 0)", "baseline"))
    print(row("value bug (wrong rate, structure-ok)", "value_mut"))
    print(row("structural bug (conservation)", "struct_mut"))
    print(f"\nfull-spec baseline false alarms: {len(scale)} (large-balance tolerance-at-scale): {[d for _,d in scale][:8]}")
    print("\n# which invariant fires (full spec):")
    for c in ("value_mut","struct_mut"):
        print(f"  {c}: {firing[c]['full']}")
    json.dump({"res":res,"firing":firing,"n":n,"scale_false_alarms":scale}, open(os.path.join(HERE,"result.json"),"w"), indent=2)
