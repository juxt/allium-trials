import sys, json, importlib.util
def main():
    mod_path=sys.argv[1]
    spec=importlib.util.spec_from_file_location("cand",mod_path); m=importlib.util.module_from_spec(spec)
    try: spec.loader.exec_module(m)
    except Exception as e: print(json.dumps({"error":str(e),"matched":0,"n":0})); return
    cases=json.load(open("oracle_alloc.json")); ok=0; n=0
    for c in cases:
        n+=1
        try:
            got=m.allocate(c["payment"],c["penalty_due"],c["fee_due"],c["interest_due"],c["principal_due"])
            if all(abs(float(got.get(k,-999))-c["expected"][k])<=0.01 for k in c["expected"]): ok+=1
        except Exception: pass
    print(json.dumps({"matched":ok,"n":n}))
main()
