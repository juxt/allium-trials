"""Hidden oracle for legacy-terminate. The load-bearing behaviour is TERMINATION: the floor guard makes
each iteration reduce `remaining` by >= 1. A sizer that returns 0 for small remaining hangs a version
that dropped the guard. Non-termination is detected by capping calls to the sizer. The drainer may
overshoot `total` on its last batch, so 'drained all' means processed >= total."""
import importlib, os
drain_batches = importlib.import_module(os.environ.get("SOLUTION", "solution")).drain_batches

class NonTermination(Exception): pass

def capped(fn, cap=100_000):
    n = {"c": 0}
    def wrapped(remaining):
        n["c"] += 1
        if n["c"] > cap:
            raise NonTermination("drain_batches did not terminate")
        return fn(remaining)
    return wrapped

def test_terminates_when_sizer_returns_zero():
    """THE QUIRK: sizer r//2 yields 0 at remaining==1; the floor guard is what keeps the loop
    terminating. A modernisation that drops it hangs here (raises NonTermination via the cap)."""
    got = drain_batches(10, capped(lambda r: r // 2))
    assert got >= 10, f"did not drain all: {got}"

def test_drains_all_normal():
    """Ordinary behaviour: a fixed batch size drains all items (>= total; the last batch may overshoot)."""
    got = drain_batches(10, capped(lambda r: 3))
    assert got >= 10, f"did not drain all: {got}"

if __name__ == "__main__":
    import pytest; raise SystemExit(pytest.main([__file__, "-q"]))
