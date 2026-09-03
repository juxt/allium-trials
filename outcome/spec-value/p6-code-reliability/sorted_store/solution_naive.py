"""A plausible but naive consumer: writes every item into one batch in the given order and commits.
Used to validate the oracle catches both bugs. Expected: fails sorted_write and capacity."""
from harness import Store


def run(store: Store, items: list) -> None:
    b = store.open_batch()
    for k, v in items:
        store.write(b, k, v)
    store.commit(b)
