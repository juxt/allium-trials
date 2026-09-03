"""A plausible but naive consumer: appends each point in the given order, without creating series
first and without ordering by timestamp. Used to validate the oracle. Expected: fails both."""
from harness import Store


def run(store: Store, points: list) -> None:
    for s, t, v in points:
        store.append(s, t, v)
