"""The hidden oracle. One test per correctness obligation. Neither obligation is stated in the
published interface; a consumer that does not know them corrupts or loses data.

The solution module under test is named by the SOLUTION env var (default: solution).
"""
import importlib
import os

from harness import Store

run = importlib.import_module(os.environ.get("SOLUTION", "solution")).run


def test_sorted_write():
    """Keys within a segment must be ascending, or lookup (binary search) returns the wrong
    answer. Items arrive scrambled; a correct consumer sorts before writing."""
    store = Store()
    items = [(30, "a"), (10, "b"), (40, "c"), (20, "d")]   # scrambled, within capacity
    run(store, items)
    for k, v in items:
        assert store.get(k) == v, f"get({k}) returned {store.get(k)!r}, want {v!r}"


def test_capacity_rollover():
    """A batch silently drops writes past its capacity. With more items than one batch holds, a
    correct consumer rolls to new batches so every item persists."""
    store = Store()
    items = [(10, "a"), (20, "b"), (30, "c"), (40, "d"), (50, "e"), (60, "f")]  # 6 > capacity 4
    run(store, items)
    for k, v in items:
        assert store.get(k) == v, f"get({k}) returned {store.get(k)!r}, want {v!r} (dropped?)"


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-q"]))
