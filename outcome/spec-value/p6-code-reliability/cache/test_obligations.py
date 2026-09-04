"""Hidden oracle. SAFETY (never stale) and OBJECTIVE (actually caches). The objective is the floor a
vacuous do-nothing cache fails; the safety is the ceiling a stale cache fails. Independent."""
import importlib, os
from harness import Store
Cache = importlib.import_module(os.environ.get("SOLUTION","solution")).Cache

def test_never_stale():
    s = Store({"k":"v1"})
    c = Cache(s)
    assert c.get("k") == "v1"
    c.put("k","v2")
    assert c.get("k") == "v2", "stale read after write"

def test_actually_caches():
    s = Store({"k":"v1"})
    c = Cache(s)
    c.get("k")
    r0 = s.reads
    c.get("k")
    assert s.reads == r0, "second get hit the store; the cache does not cache (vacuous)"

if __name__ == "__main__":
    import pytest; raise SystemExit(pytest.main([__file__,"-q"]))
