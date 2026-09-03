"""Persist key/value items into the store so they can all be read back.

Fill in `run`. You are given:

  store — open_batch() -> Batch, write(batch, key, value), commit(batch), get(key) -> value|None
          (see harness.py for the mechanics)
  items — a list of (key: int, value: str) pairs to persist. Keys are distinct unless stated.

Goal: after run(store, items) returns, store.get(key) must return the right value for every item.
Nothing else is specified for you: decide what persisting them correctly requires.
"""
from harness import Store


def run(store: Store, items: list) -> None:
    raise NotImplementedError
