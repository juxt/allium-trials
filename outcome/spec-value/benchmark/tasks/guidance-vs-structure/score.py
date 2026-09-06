import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
m=t=band_ok=band=0
for g in golden:
    t+=1
    b=g["balance"]; exp=g["expected"]
    try:
        got = sol.charge(b)   # returns new balance, or None/raises if rejected
    except Exception:
        got = None
    ok = (got==exp) or (exp is None and got is None)
    if ok: m+=1
    if 15<=b<20:  # the discriminating reserve band
        band+=1
        if exp is None and (got is None): band_ok+=1
print(f"{m}/{t} band {band_ok}/{band}")
