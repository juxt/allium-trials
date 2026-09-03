"""Message-queue harness — the published interface, and the simulator behind it.

Given to the implementer (read-only). API reference only: it documents what each operation does
mechanically, not how to use the queue correctly. Time is simulated: work() advances a logical
clock, so behaviour is deterministic.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


class Clock:
    """A logical millisecond clock."""
    def __init__(self) -> None:
        self.now: int = 0

    def advance(self, ms: int) -> None:
        self.now += ms


@dataclass
class Message:
    id: str                 # logical identity of the message
    payload: str
    processing_ms: int      # how long work() on this message takes
    _next_visible_at: int = 0
    delivery_count: int = 0  # how many times this message has been returned by poll()


@dataclass
class Receipt:
    """Returned by poll(). Names the leased message and the time the lease expires."""
    message: Message
    deadline: int
    delivery_count: int
    _acked: bool = False


class Sink:
    """The downstream effect. sink.applied records every apply() call."""
    def __init__(self) -> None:
        self.applied: list[str] = []

    def apply(self, payload: str) -> None:
        self.applied.append(payload)


class Broker:
    """A message queue with leased delivery and a visibility timeout."""
    def __init__(self, messages: list[Message], clock: Clock,
                 visibility_timeout: int = 1000) -> None:
        self._messages = list(messages)
        self._clock = clock
        self.visibility_timeout = visibility_timeout
        self.dead_letter_queue: list[Message] = []

    def poll(self) -> Optional[Receipt]:
        """Lease and return the next available message, or None if the queue is empty.
        The lease lasts visibility_timeout ms from now."""
        if not self._messages:
            return None
        if all(m._next_visible_at > self._clock.now for m in self._messages):
            self._clock.now = min(m._next_visible_at for m in self._messages)
        m = min(self._messages, key=lambda x: x._next_visible_at)
        m.delivery_count += 1
        m._next_visible_at = self._clock.now + self.visibility_timeout
        return Receipt(m, deadline=m._next_visible_at, delivery_count=m.delivery_count)

    def ack(self, receipt: Receipt) -> bool:
        """Complete the message and remove it. Returns False if the lease has expired."""
        if receipt._acked:
            return True
        if self._clock.now > receipt.deadline:
            return False
        if receipt.message in self._messages:
            self._messages.remove(receipt.message)
        receipt._acked = True
        return True

    def extend_visibility(self, receipt: Receipt, ms: int) -> bool:
        """Set the lease to expire ms from now. Returns False if it has already expired."""
        if self._clock.now > receipt.deadline:
            return False
        receipt.message._next_visible_at = self._clock.now + ms
        receipt.deadline = receipt.message._next_visible_at
        return True

    def dead_letter(self, receipt: Receipt) -> None:
        """Remove the message from the queue and place it on the dead-letter queue."""
        if receipt.message in self._messages:
            self._messages.remove(receipt.message)
            self.dead_letter_queue.append(receipt.message)

    def pending(self) -> int:
        """Number of messages still on the queue."""
        return len(self._messages)


class WorkFailed(Exception):
    """Raised by work() when processing a message does not succeed."""
