"""Planted bug: non-idempotent consumer. It deposits on EVERY delivery, so the
queue's at-least-once redelivery double-credits. The classic integration bug."""

from ledger import Ledger  # noqa: F401


class CreditConsumer:
    def __init__(self, ledger):
        self._ledger = ledger

    def on_message(self, message):
        self._ledger.deposit(message["account"], message["amount"])  # BUG: no dedup on message id
