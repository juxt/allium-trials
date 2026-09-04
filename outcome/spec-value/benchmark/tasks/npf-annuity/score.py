import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
def close(a,b): return abs(a-b) <= 1e-4*max(1.0, abs(b)) + 1e-6
match=total=0
for g in golden:
    total+=1
    try:
        got=float(getattr(sol, g["fn"])(*g["args"]))
        if close(got, float(g["expected"])): match+=1
    except Exception: pass
print(f"{match}/{total}")
