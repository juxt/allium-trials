"""Paginated reader harness — the published interface (read-only). API reference only: it documents
what each operation does mechanically, not how to use it correctly.

A Source hands out records one Page at a time. fetch(None) returns the first page; each page carries
a next_cursor to pass to the following fetch, and the last page's next_cursor is None. Records may
repeat across pages.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass
class Page:
    records: list          # record ids on this page
    next_cursor: Optional[str]


class Source:
    """A paginated record source. Construct with an ordered list of (records, next_cursor) pages."""
    def __init__(self, pages: list) -> None:
        # pages[i] = (records, next_cursor); cursor "c{i}" fetches page i (None -> page 0)
        self._pages = pages

    def fetch(self, cursor: Optional[str]) -> Page:
        """Return the page for this cursor. Pass None for the first page, then each page's next_cursor."""
        idx = 0 if cursor is None else int(cursor[1:])
        recs, nxt = self._pages[idx]
        return Page(list(recs), nxt)


class Sink:
    """Where the reader collects records. sink.collected is the list of everything added."""
    def __init__(self) -> None:
        self.collected: list = []

    def add(self, record) -> None:
        self.collected.append(record)
