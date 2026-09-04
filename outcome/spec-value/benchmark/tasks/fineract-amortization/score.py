"""Differential score: a reconstruction's rate/discountFactor vs real Fineract golden values."""
import json, importlib, os, sys
sol = importlib.import_module(os.environ.get("SOLUTION", "solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__), "golden.json")))
def close(a, b): return abs(a - b) <= 1e-6 * max(1.0, abs(b))
match = total = 0
for g in golden:
    total += 1
    try:
        if g["fn"] == "rate":
            got = float(sol.rate(int(g["nper"]), float(g["pmt"]), float(g["pv"])))
        else:
            got = float(sol.discountFactor(float(g["eir"]), int(g["days"])))
        if close(got, float(g["expected"])): match += 1
    except Exception:
        pass
print(f"{match}/{total}")
