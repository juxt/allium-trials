import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
m=t=0
for g in golden:
    t+=1
    try:
        if g["fn"]=="encode":
            got = sol.encode(g["hrp"], g["witver"], bytes.fromhex(g["witprog"]))
            if got==g["expected"]: m+=1
        else:
            wv, prog = sol.decode(g["hrp"], g["addr"])
            exp = g["expected"]
            if exp is None:
                if wv is None: m+=1
            else:
                if wv==exp[0] and prog is not None and bytes(prog).hex()==exp[1]: m+=1
    except Exception: pass
print(f"{m}/{t}")
