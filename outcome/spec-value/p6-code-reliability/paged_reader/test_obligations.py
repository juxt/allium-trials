"""The hidden oracle. One test per obligation. Neither is stated in the published interface.
The solution module under test is named by the SOLUTION env var (default: solution)."""
import importlib
import os
from harness import Source, Sink

run = importlib.import_module(os.environ.get("SOLUTION", "solution")).run


def test_reads_all_pages():
    """The reader must follow next_cursor to the end, not stop after the first page."""
    src = Source([(["a", "b"], "c1"), (["c", "d"], "c2"), (["e"], None)])
    sink = Sink()
    run(src, sink)
    assert sorted(sink.collected) == ["a", "b", "c", "d", "e"], f"got {sink.collected}"


def test_dedupes_records():
    """Records may repeat across pages (at-least-once pagination); each must be collected once."""
    src = Source([(["a", "b"], "c1"), (["b", "c"], None)])  # 'b' repeats
    sink = Sink()
    run(src, sink)
    assert sorted(sink.collected) == ["a", "b", "c"], f"got {sink.collected}"


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-q"]))
