import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
gf = os.environ.get("GOLDEN","golden.json")
golden = json.load(open(os.path.join(os.path.dirname(__file__), gf)))
m=t=0
for g in golden:
    t+=1
    try:
        if bool(sol.is_working_day(g["date"]))==g["expected"]: m+=1
    except Exception: pass
print(f"{m}/{t}")
