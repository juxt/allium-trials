"""Message-queue harness — the published interface, and the simulator behind it.

This file is GIVEN to the implementer (read-only). It defines the broker they consume from
and the sink they apply work to. It states the broker's *mechanics* honestly (delivery is
at-least-once; a message not acked before its visibility deadline is redelivered). It does
NOT state the consumer's obligations — those are what the eval measures.

Time is simulated. `work()` advances a logical clock; there is no wall-clock sleeping, so
every test is deterministic.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


class Clock:
    """A logical millisecond clock. Advanced by work, read by the broker."""
    def __init__(self) -> None:
        self.now: int = 0

    def advance(self, ms: int) -> None:
        self.now += ms


@dataclass
class Message:
    id: str                 # logical identity; the same id may be delivered more than once
    payload: str
    processing_ms: int      # how long work() on this message will take
    _next_visible_at: int = 0
    delivery_count: int = 0


@dataclass
class Receipt:
    """Handed out by poll(). Names the message and the deadline by which you must ack."""
    message: Message
    deadline: int
    delivery_count: int
    _acked: bool = False


class Sink:
    """The downstream effect. Applying the same payload twice is the observable bug."""
    def __init__(self) -> None:
        self.applied: list[str] = []

    def apply(self, payload: str) -> None:
        self.applied.append(payload)


class Broker:
    """An at-least-once queue with a visibility timeout.

    poll() leases the next available message for `visibility_timeout` ms and returns a
    Receipt. If you do not ack (or extend) before the lease deadline, the message becomes
    available again and a later poll() will return it once more — this is the at-least-once
    guarantee, not a fault. ack() after the deadline has passed is rejected: you no longer
    own the lease.
    """
    def __init__(self, messages: list[Message], clock: Clock,
                 visibility_timeout: int = 1000) -> None:
        self._messages = list(messages)
        self._clock = clock
        self.visibility_timeout = visibility_timeout
        self.dead_letter_queue: list[Message] = []

    def poll(self) -> Optional[Receipt]:
        """Return a Receipt for the next available message, or None if the queue is empty.

        If messages remain but none is visible yet (all leased and not due for redelivery),
        the clock advances to the next redelivery time — the consumer waits for a message.
        """
        if not self._messages:
            return None
        if all(m._next_visible_at > self._clock.now for m in self._messages):
            self._clock.now = min(m._next_visible_at for m in self._messages)
        m = min(self._messages, key=lambda x: x._next_visible_at)
        m.delivery_count += 1
        m._next_visible_at = self._clock.now + self.visibility_timeout
        return Receipt(m, deadline=m._next_visible_at, delivery_count=m.delivery_count)

    def ack(self, receipt: Receipt) -> bool:
        """Remove the message. Succeeds only if the lease has not expired. Returns success."""
        if receipt._acked:
            return True
        if self._clock.now > receipt.deadline:
            return False  # lease lost: the message has already been made available again
        if receipt.message in self._messages:
            self._messages.remove(receipt.message)
        receipt._acked = True
        return True

    def extend_visibility(self, receipt: Receipt, ms: int) -> bool:
        """Push the lease deadline out by `ms` from now. Fails if the lease already expired."""
        if self._clock.now > receipt.deadline:
            return False
        receipt.message._next_visible_at = self._clock.now + ms
        receipt.deadline = receipt.message._next_visible_at
        return True

    def dead_letter(self, receipt: Receipt) -> None:
        """Move the message off the main queue into the dead-letter queue."""
        if receipt.message in self._messages:
            self._messages.remove(receipt.message)
            self.dead_letter_queue.append(receipt.message)

    def pending(self) -> int:
        """How many messages remain on the main queue (test helper)."""
        return len(self._messages)


class Poison(Exception):
    """Raised by work() for a message that can never be processed successfully."""


class TransientError(Exception):
    """Raised by work() for a failure that may succeed if the message is processed again."""
