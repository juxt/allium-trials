import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
match=total=0
for g in golden:
    total+=1
    try:
        if bool(sol.evaluate(g["type"], g["predicate"]))==g["expected"]: match+=1
    except Exception: pass
print(f"{match}/{total}")
