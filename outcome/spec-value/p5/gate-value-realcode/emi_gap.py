#!/usr/bin/env python3
"""Confirms a real language gap: the full spec cannot pin the instalment (emi) VALUE.

A wrong emi, as long as the final period absorbs the residual (keeping conservation and closes-to-zero)
and interest stays tied to the rate, satisfies EVERY invariant in full.allium. Pinning emi needs the
annuity formula emi = disbursed*f*(1+f)^n / ((1+f)^n - 1), which needs a power operator v4 lacks.
So a customer overcharged a fixed amount on every instalment would pass the gate. Witness below.
"""
import subprocess, json, os, tempfile
from decimal import Decimal, ROUND_HALF_EVEN
def r2(x): return float(Decimal(str(x)).quantize(Decimal("0.01"), ROUND_HALF_EVEN))
ALLIUM="/Users/hgarner/code/allium-tools/target/debug/allium"
FULL=os.path.join(os.path.dirname(os.path.abspath(__file__)),"full.allium")

def sched(disbursed, rate, months, emi_delta=0.0):
    f=rate/1200.0
    base=r2(r2(disbursed*f*(1+f)**months/((1+f)**months-1))+emi_delta)
    out=[]; bal=disbursed
    for i in range(months):
        pure=r2(bal*f)
        principal = bal if i==months-1 else r2(base-pure)     # final period absorbs residual
        emi = r2(pure+principal) if i==months-1 else base     # last emi exempt from constancy
        out.append((emi, pure, principal, r2(bal))); bal=r2(bal-principal)
    return out

def emit(rows, disbursed, rate, path):
    rf=rate/1200.0
    with open(path,"w") as fh:
        for i,(emi,inte,prin,out) in enumerate(rows):
            fh.write(f"period={i} emi={emi:.2f} interest={inte:.2f} principal={prin:.2f} "
                     f"outstanding_start={out:.2f} rate_factor={rf:.6f} is_last={'T' if i==len(rows)-1 else 'F'}\n")
        fh.write(f"given disbursed={disbursed:.2f}\n")

def gate(path):
    d=json.loads(subprocess.run([ALLIUM,"monitor-schedule",FULL,path,"--tol","0.01"],capture_output=True,text=True).stdout)
    return [x["invariant"] for x in d["results"] if not x["holds"]]

if __name__ == "__main__":
    tmp=tempfile.mkdtemp()
    for delta,label in [(0.0,"correct emi"),(5.0,"emi +5 (overcharge)"),(-5.0,"emi -5 (undercharge)")]:
        p=os.path.join(tmp,f"e{delta}.trace"); emit(sched(1000,18,6,delta),1000,18,p)
        fired=gate(p)
        print(f"{label:<24} fired: {fired if fired else 'NOTHING — wrong instalment SLIPS THROUGH'}")
