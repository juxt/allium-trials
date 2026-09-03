"""A correct consumer — passes both obligations. Used to validate the oracle."""
from collections import defaultdict
from harness import Store


def run(store: Store, points: list) -> None:
    by_series = defaultdict(list)
    for s, t, v in points:
        by_series[s].append((t, v))
    for s, pts in by_series.items():
        store.create_series(s)                 # create before appending
        for t, v in sorted(pts):               # non-decreasing timestamps
            store.append(s, t, v)
