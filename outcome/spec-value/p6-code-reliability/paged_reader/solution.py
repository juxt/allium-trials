"""Read all records from a paginated source into the sink.

Fill in `run`. You are given:
  source — fetch(cursor) -> Page(records, next_cursor); pass None for the first page (see harness.py)
  sink   — add(record): collect a record

Goal: after run(source, sink), sink.collected must contain every record the source holds. Nothing
else is specified for you: decide what reading them correctly requires.
"""
from harness import Source, Sink


def run(source: Source, sink: Sink) -> None:
    raise NotImplementedError
