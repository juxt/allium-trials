import json, os, importlib
sol = importlib.import_module(os.environ.get("SOLUTION","solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__),"golden.json")))
correct = total = 0
for g in golden:
    try: got = sol.encode(dict(g["record"]))
    except Exception: got = {}
    for f, exp in g["expected"].items():
        total += 1
        if isinstance(got, dict) and str(got.get(f)) == exp: correct += 1
print(f"{correct}/{total}")
