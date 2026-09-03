"""A correct reader — passes both obligations. Used to validate the oracle."""
from harness import Source, Sink


def run(source: Source, sink: Sink) -> None:
    seen = set()
    cursor = None
    while True:
        page = source.fetch(cursor)
        for r in page.records:
            if r not in seen:            # records may repeat across pages
                seen.add(r)
                sink.add(r)
        if page.next_cursor is None:     # follow to the last page
            break
        cursor = page.next_cursor
