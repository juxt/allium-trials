"""Sorted-segment store harness — the published interface (read-only). API reference only: it
documents what each operation does mechanically, not how to use the store correctly.

A batch collects writes; commit persists the batch as a segment; get looks up a key across the
committed segments.
"""
from __future__ import annotations
from bisect import bisect_left
from dataclasses import dataclass, field

_BATCH_CAPACITY = 4   # internal implementation detail, not part of the public contract


@dataclass
class Batch:
    entries: list = field(default_factory=list)   # (key, value) pairs, in the order written
    _committed: bool = False


class Store:
    def __init__(self) -> None:
        self._segments: list[list] = []   # each a committed batch's entries; newest last

    def open_batch(self) -> Batch:
        """Start a new batch to write into."""
        return Batch()

    def write(self, batch: Batch, key: int, value: str) -> None:
        """Add a key/value pair to the batch."""
        if len(batch.entries) >= _BATCH_CAPACITY:
            return   # capacity reached: the write is dropped
        batch.entries.append((key, value))

    def commit(self, batch: Batch) -> None:
        """Persist the batch as a segment."""
        batch._committed = True
        self._segments.append(list(batch.entries))

    def get(self, key: int):
        """Return the value for key, or None if not found. Searches segments newest-first."""
        for seg in reversed(self._segments):
            keys = [k for k, _ in seg]
            i = bisect_left(keys, key)     # lookup assumes each segment's keys are ascending
            if i < len(keys) and keys[i] == key:
                return seg[i][1]
        return None
