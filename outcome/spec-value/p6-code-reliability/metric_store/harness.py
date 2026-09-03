"""Time-series metric store harness — the published interface (read-only). API reference only: it
documents what each operation does mechanically, not how to use the store correctly.

A series holds a list of (t, value) points. You append points and read them back. The store's two
real constraints — a series must be created before you can append to it, and appends within a series
must have non-decreasing timestamps — are NOT stated here; a consumer that does not know them will
silently lose data.
"""
from __future__ import annotations


class Store:
    def __init__(self) -> None:
        self._series: dict[str, list] = {}

    def create_series(self, name: str) -> None:
        """Register a series so it can be appended to."""
        self._series.setdefault(name, [])

    def append(self, series: str, t: int, value: float) -> None:
        """Append a (t, value) point to a series."""
        seg = self._series.get(series)
        if seg is None:
            return                       # series not created: dropped
        if seg and t < seg[-1][0]:
            return                       # timestamp older than the last: dropped
        seg.append((t, value))

    def read(self, series: str) -> list:
        """Return the (t, value) points stored for a series, in append order."""
        return list(self._series.get(series, []))
