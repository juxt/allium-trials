"""A correct consumer — passes both obligations. Used to validate the oracle."""
from harness import Store

CAPACITY = 4   # the store's batch capacity, as stated by the library spec


def run(store: Store, items: list) -> None:
    dedup: dict = {}
    for k, v in items:            # last write wins per key
        dedup[k] = v
    pairs = sorted(dedup.items())  # ascending key order for correct lookup
    for i in range(0, len(pairs), CAPACITY):   # roll to a new batch at capacity
        b = store.open_batch()
        for k, v in pairs[i:i + CAPACITY]:
            store.write(b, k, v)
        store.commit(b)
