"""Hidden integration suite for the message-driven ledger.

Simulates the queue's AT-LEAST-ONCE behaviour by redelivering messages, and asserts
each message's credit is applied exactly once. A non-idempotent consumer
double-credits on redelivery and fails here; a correct (idempotent) one passes.

Scores any implementation exposing `Ledger` (ledger.py) and `CreditConsumer`
(consumer.py) on the path.
"""

import unittest

from ledger import Ledger
from consumer import CreditConsumer


def deliver(consumer, messages):
    for m in messages:
        consumer.on_message(m)


class AtLeastOnceIntegration(unittest.TestCase):
    def setUp(self):
        self.lg = Ledger()
        for a in ("alice", "bob"):
            self.lg.open(a)
        self.consumer = CreditConsumer(self.lg)
        self.messages = [
            {"id": "m1", "account": "alice", "amount": 100},
            {"id": "m2", "account": "bob", "amount": 50},
            {"id": "m3", "account": "alice", "amount": 25},
        ]

    def test_first_delivery_credits(self):
        deliver(self.consumer, [self.messages[0]])
        self.assertEqual(self.lg.balance("alice"), 100)

    def test_each_message_applied_once_despite_partial_redelivery(self):
        deliver(self.consumer, self.messages)
        deliver(self.consumer, [self.messages[0], self.messages[2], self.messages[0]])  # duplicates
        self.assertEqual(self.lg.balance("alice"), 125)  # 100 + 25, each once
        self.assertEqual(self.lg.balance("bob"), 50)

    def test_no_double_credit_on_full_redelivery(self):
        deliver(self.consumer, self.messages)
        deliver(self.consumer, self.messages)  # the whole batch redelivered
        self.assertEqual(self.lg.total(), 175)
        self.assertEqual(self.lg.balance("alice"), 125)
        self.assertEqual(self.lg.balance("bob"), 50)


if __name__ == "__main__":
    unittest.main()
