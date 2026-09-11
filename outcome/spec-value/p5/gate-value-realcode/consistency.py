#!/usr/bin/env python3
"""Consistency check: is the 'structural gate is blind to value drift, the arithmetic tier catches it'
finding robust across DIFFERENT bug morphologies, or an artifact of the one wrong-rate mutation?

Runs a battery of realistic mutations on the 150 real Fineract schedules. For each, reports whether the
STRUCTURAL-only spec catches it and whether the FULL spec (with the absolute invariant) catches it. The
predicted pattern: structure-BREAKING bugs are caught by both; structure-PRESERVING value bugs are caught
only by the full spec. If that holds across the battery, the finding is robust.
"""
import os, re, subprocess, json, tempfile
from decimal import Decimal, ROUND_HALF_EVEN
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))
HERE=os.path.dirname(os.path.abspath(__file__))
ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium"
FIN="/Users/hgarner/code/allium-trials/outcome/fineract/traces"
STRUCT=os.path.join(HERE,"structural.allium"); FULL=os.path.join(HERE,"full.allium")

def rows():
    for f in sorted(os.listdir(FIN)):
        m=re.match(r'^d([\d.]+)_r([\d.]+)_m(\d+)\.trace$', f)
        if m: yield f, float(m.group(1)), float(m.group(2)), int(m.group(3))
def parse(path):
    per=[]
    for line in open(path):
        line=line.strip()
        if line.startswith("period="): per.append(dict(t.split("=") for t in line.split() if "=" in t))
    return per
def emit(per, disb, rate, path):
    rf=rate/1200.0
    with open(path,"w") as fh:
        for i,p in enumerate(per):
            last=(i==len(per)-1)
            fh.write(f"period={i} emi={p['emi']} interest={p['interest']} principal={p['principal']} "
                     f"outstanding_start={p['outstanding_start']} rate_factor={rf:.6f} is_last={'T' if last else 'F'}\n")
        fh.write(f"given disbursed={disb}\n")
def annuity(disbursed, rate, months):
    f=rate/1200.0; base=r2(disbursed*f*(1+f)**months/((1+f)**months-1)) if f else r2(disbursed/months)
    out=[]; bal=disbursed
    for i in range(months):
        pure=r2(bal*f); principal=bal if i==months-1 else r2(base-pure)
        out.append({"emi":f"{r2(pure+principal):.2f}","interest":f"{pure:.2f}","principal":f"{principal:.2f}","outstanding_start":f"{r2(bal):.2f}"})
        bal=r2(bal-principal)
    return out
def gate(spec, path):
    d=json.loads(subprocess.run([ALLIUM,"monitor",spec,path,"--tol","0.01"],capture_output=True,text=True).stdout)
    return not all(x["holds"] for x in d["results"])

# --- mutation battery. Each returns (mutated periods, kind) or None to skip this schedule. ---
def m_wrong_rate(per,disb,rate,months):     # structure-PRESERVING: recompute at 1.1x rate
    return annuity(float(disb), rate*1.1, months) if rate else None, "value/preserving"
def m_wrong_daycount(per,disb,rate,months): # structure-PRESERVING: 30/360 vs actual -> rate*365/360
    return annuity(float(disb), rate*365.0/360.0, months) if rate else None, "value/preserving"
def m_interest_only(per,disb,rate,months):  # structure-BREAKING: interest +2%, emi/principal untouched
    if not rate: return None,"value/breaking"
    out=[dict(p) for p in per]
    for p in out: p["interest"]=f"{r2(float(p['interest'])*1.02):.2f}"
    return out, "value/breaking"
def m_shift_principal(per,disb,rate,months): # structure-BREAKING: move 0.30 from p0 principal (conservation)
    out=[dict(p) for p in per]
    if out: out[0]["principal"]=f"{r2(float(out[0]['principal'])-0.30):.2f}"
    return out, "structural/breaking"
def m_drop_leg(per,disb,rate,months):        # structure-BREAKING: zero a middle period's principal
    out=[dict(p) for p in per]
    if len(out)>2: out[1]["principal"]="0.00"
    return out, "structural/breaking"
BATTERY={"wrong_rate":m_wrong_rate,"wrong_daycount":m_wrong_daycount,"interest_only":m_interest_only,
         "shift_principal":m_shift_principal,"drop_middle_leg":m_drop_leg}

def main():
    tmp=tempfile.mkdtemp(); rs=list(rows())
    print(f"# Consistency battery on {len(rs)} real Fineract schedules — does the pattern hold across bug types?\n")
    print(f"{'mutation':<20}{'kind':<22}{'structural':>13}{'full':>10}")
    print("-"*66)
    for name,mut in BATTERY.items():
        cs=cf=n=0; kind=""
        for f,disb,rate,months in rs:
            per=parse(os.path.join(FIN,f)); res=mut(per,disb,rate,months)
            m,kind=res
            if m is None: continue
            p=os.path.join(tmp,f"{name}_{f}"); emit(m,disb,rate,p); n+=1
            cs+=gate(STRUCT,p); cf+=gate(FULL,p)
        print(f"{name:<20}{kind:<22}{f'{cs}/{n}':>13}{f'{cf}/{n}':>10}")
    print("\nPredicted: preserving -> structural low, full high; breaking -> both high.")

if __name__=="__main__": main()
