"""Hidden oracle for legacy-terminate. The non-obvious quirk: the loop MUST terminate even when an
item always fails (the max_ops budget bounds retries). A 'drain until empty' rewrite loops forever."""
import importlib, os, signal
drain = importlib.import_module(os.environ.get("SOLUTION", "solution")).drain

def test_drains_all_success():
    """happy path: everything succeeds -> nothing left pending."""
    assert list(drain([1, 2, 3], lambda x: True, 100)) == []

def test_retries_transient_failure():
    """an item that fails once then succeeds is retried and eventually processed."""
    seen = {}
    def proc(x):
        seen[x] = seen.get(x, 0) + 1
        return seen[x] >= 2
    assert list(drain([1], proc, 100)) == []

def test_terminates_on_poison():
    """THE QUIRK: a poison item that always fails must not loop forever — the budget bounds retries."""
    def handler(signum, frame):
        raise TimeoutError("did not terminate")
    old = signal.signal(signal.SIGALRM, handler); signal.alarm(3)
    try:
        drain([1, 2, "poison"], lambda x: x != "poison", 100)  # must return, not hang
    finally:
        signal.alarm(0); signal.signal(signal.SIGALRM, old)

if __name__ == "__main__":
    import pytest; raise SystemExit(pytest.main([__file__, "-q"]))
