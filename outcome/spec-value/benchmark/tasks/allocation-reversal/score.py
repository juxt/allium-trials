import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
def norm(d): return sorted(([tuple(k),v] for k,v in (d.items() if isinstance(d,dict) else d)))
match=total=0
for g in golden:
    total+=1
    alloc={tuple(k):v for k,v in g["allocations"]}
    try:
        got=sol.reverse(alloc, g["amount"])
        exp=[[tuple(k),v] for k,v in g["expected"]]
        got_n=sorted([[tuple(k),v] for k,v in got.items() if v]) if isinstance(got,dict) else []
        if got_n==sorted([[k,v] for k,v in exp if v]): match+=1
    except Exception: pass
print(f"{match}/{total}")
