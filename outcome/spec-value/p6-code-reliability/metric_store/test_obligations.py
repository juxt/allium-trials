"""The hidden oracle. One test per correctness obligation. Neither obligation is stated in the
published interface; a consumer that does not know them silently loses data.

The solution module under test is named by the SOLUTION env var (default: solution).
"""
import importlib
import os

from harness import Store

run = importlib.import_module(os.environ.get("SOLUTION", "solution")).run


def _stored(store, series):
    return sorted(store.read(series))


def test_create_series_before_append():
    """Appending to a series that was never created silently drops the point."""
    store = Store()
    points = [("cpu", 1, 0.5), ("cpu", 2, 0.6), ("cpu", 3, 0.7)]
    run(store, points)
    assert _stored(store, "cpu") == [(1, 0.5), (2, 0.6), (3, 0.7)], f"got {store.read('cpu')}"


def test_monotonic_timestamps():
    """Within a series, an out-of-order timestamp is silently dropped; points arrive scrambled."""
    store = Store()
    points = [("mem", 30, 0.3), ("mem", 10, 0.1), ("mem", 40, 0.4), ("mem", 20, 0.2)]
    run(store, points)
    assert _stored(store, "mem") == [(10, 0.1), (20, 0.2), (30, 0.3), (40, 0.4)], f"got {store.read('mem')}"


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-q"]))
