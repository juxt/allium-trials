#!/usr/bin/env python3
"""Does the power operator close the emi-value hole? Adds the annuity law (needs `^`) and tests it on
real Fineract: (1) is it faithful to Fineract's instalment, and (2) does it catch the wrong-emi bug that
slipped through the full spec? Emits real traces with annual_rate_pct + months as givens."""
import os, re, subprocess, json, tempfile
from decimal import Decimal, ROUND_HALF_EVEN
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))
HERE=os.path.dirname(os.path.abspath(__file__))
ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium"
FIN="/Users/hgarner/code/allium-trials/outcome/fineract/traces"
FULL=os.path.join(HERE,"full.allium"); ANN=os.path.join(HERE,"full_annuity.allium")

def rows():
    for f in sorted(os.listdir(FIN)):
        m=re.match(r'^d([\d.]+)_r([\d.]+)_m(\d+)\.trace$', f)
        if m: yield f, float(m.group(1)), float(m.group(2)), int(m.group(3))

def parse(path):
    per=[]; disb=None
    for line in open(path):
        line=line.strip()
        if line.startswith("period="): per.append(dict(t.split("=") for t in line.split() if "=" in t))
        elif line.startswith("given"):
            for t in line.split():
                if t.startswith("disbursed="): disb=t.split("=")[1]
    return per, disb

def emit(per, disb, rate, months, path):
    rf=rate/1200.0
    with open(path,"w") as fh:
        for i,p in enumerate(per):
            last=(i==len(per)-1)
            fh.write(f"period={i} emi={p['emi']} interest={p['interest']} principal={p['principal']} "
                     f"outstanding_start={p['outstanding_start']} rate_factor={rf:.6f} is_last={'T' if last else 'F'}\n")
        fh.write(f"given disbursed={disb} annual_rate_pct={rate} months={months}\n")

def annuity(disbursed, rate, months, emi_delta=0.0):
    f=rate/1200.0; base=r2(r2(disbursed*f*(1+f)**months/((1+f)**months-1) if f else disbursed/months)+emi_delta)
    out=[]; bal=disbursed
    for i in range(months):
        pure=r2(bal*f); principal=bal if i==months-1 else r2(base-pure)
        emi=r2(pure+principal) if i==months-1 else base
        out.append({"emi":f"{emi:.2f}","interest":f"{pure:.2f}","principal":f"{principal:.2f}","outstanding_start":f"{r2(bal):.2f}"})
        bal=r2(bal-principal)
    return out

def gate(spec, path):
    d=json.loads(subprocess.run([ALLIUM,"monitor",spec,path,"--tol","0.01"],capture_output=True,text=True).stdout)
    return all(x["holds"] for x in d["results"]), [x["invariant"] for x in d["results"] if not x["holds"]]

def main():
    tmp=tempfile.mkdtemp(); rs=list(rows())
    # (1) faithfulness: annuity invariant on real Fineract emis
    fa_hold=fa_total=fa_fire=0
    for f,disb,rate,months in rs:
        per,disbursed=parse(os.path.join(FIN,f)); p=os.path.join(tmp,f"real_{f}"); emit(per,disbursed,rate,months,p)
        hold,fired=gate(ANN,p); fa_total+=1; fa_hold+=hold
        if "emi_annuity" in fired: fa_fire+=1
    print(f"# (1) faithfulness of the annuity law (with ^) on {fa_total} real Fineract schedules")
    print(f"    full-annuity spec holds: {fa_hold}/{fa_total}; emi_annuity specifically fires: {fa_fire}\n")
    # (2) the wrong-emi bug: caught by full (no ^) vs full+annuity (^)?
    c_full=c_ann=n=0
    for f,disb,rate,months in rs:
        if rate==0: continue
        mut=annuity(float(disb) if (disb:=parse(os.path.join(FIN,f))[1]) else 0, rate, months, emi_delta=5.0)
        p=os.path.join(tmp,f"mut_{f}"); emit(mut, disb, rate, months, p); n+=1
        c_full += (not gate(FULL,p)[0]);
        h,fired=gate(ANN,p); c_ann += (not h)
    print(f"# (2) wrong-instalment bug (emi +5, final absorbs) on {n} real schedules")
    print(f"    full spec (no power):        caught {c_full}/{n}")
    print(f"    full+annuity (power operator): caught {c_ann}/{n}")

if __name__=="__main__": main()
