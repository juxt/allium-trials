"""Reference message-driven credit consumer.

Consumes credit messages from an AT-LEAST-ONCE queue (see QUEUE-CONTRACT.allium)
and applies them to a ledger. Because the queue may redeliver a message, the
consumer is IDEMPOTENT in the message id: a duplicate delivery has no further
effect. This is the design fact the checker + library spec should force.
"""

from ledger import Ledger  # noqa: F401  (the ledger is part of the workspace)


class CreditConsumer:
    def __init__(self, ledger):
        self._ledger = ledger
        self._applied = set()  # message ids already applied

    def on_message(self, message):
        mid = message["id"]
        if mid in self._applied:
            return  # at-least-once: a duplicate delivery is a no-op
        self._ledger.deposit(message["account"], message["amount"])
        self._applied.add(mid)
