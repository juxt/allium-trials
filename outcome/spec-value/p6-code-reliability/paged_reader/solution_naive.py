"""A naive reader: reads the first page only and does not dedupe. Fails both obligations."""
from harness import Source, Sink


def run(source: Source, sink: Sink) -> None:
    page = source.fetch(None)
    for r in page.records:
        sink.add(r)
