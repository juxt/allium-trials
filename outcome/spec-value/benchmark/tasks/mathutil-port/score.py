import json, os, importlib, re
from decimal import Decimal
sol = importlib.import_module(os.environ.get("SOLUTION", "solution"))
golden = json.load(open(os.path.join(os.path.dirname(__file__), "golden.json")))
# Java camelCase fn -> python snake, with the port's naming (abs_/min_/subtract etc.)
def snake(fn): return re.sub(r'(?<!^)(?=[A-Z])', '_', fn).lower()
PYNAME = {"abs":"abs_", "min":"min_"}
def toarg(a):
    if a is None: return None
    if isinstance(a, bool): return a
    return Decimal(str(a))
def toexp(e):
    if e is None or isinstance(e, bool): return e
    return Decimal(str(e))
def eq(got, exp):
    if exp is None: return got is None
    if isinstance(exp, bool): return got == exp
    try: return got is not None and Decimal(str(got)) == exp
    except Exception: return False
match = total = 0
per = {}
for g in golden:
    total += 1
    fn = g["fn"]; pyfn = PYNAME.get(fn, snake(fn))
    per.setdefault(fn, [0,0]); per[fn][1] += 1
    try:
        f = getattr(sol, pyfn)
        got = f(*[toarg(a) for a in g["args"]])
        if eq(got, toexp(g["expected"])): match += 1; per[fn][0] += 1
    except Exception:
        pass
if os.environ.get("PERFN"):
    for fn,(m,t) in sorted(per.items()): print(f"  {fn}: {m}/{t}")
print(f"{match}/{total}")
