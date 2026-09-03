"""Persist time-series points into the store so they can all be read back.

Fill in `run`. You are given:

  store  — create_series(name), append(series, t, value), read(series) -> list of (t, value)
           (see harness.py for the mechanics)
  points — a list of (series, t, value) triples to persist (series str, t int, value float)

Goal: after run(store, points) returns, store.read(series) must contain every point for that series.
Nothing else is specified for you: decide what persisting them correctly requires.
"""
from harness import Store


def run(store: Store, points: list) -> None:
    raise NotImplementedError
