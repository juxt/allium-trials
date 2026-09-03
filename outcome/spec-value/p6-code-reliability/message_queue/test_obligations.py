"""The hidden oracle. One test per correctness obligation, each with its own scenario.

The solution module under test is named by the SOLUTION env var (default: solution). Each
test builds a fresh broker+clock, runs the consumer, and asserts the observable outcome.
A crash in the consumer fails only the obligation whose scenario provoked it.
"""
import importlib
import os

import pytest

from harness import Broker, Sink, Clock, Message, Poison, TransientError

run = importlib.import_module(os.environ.get("SOLUTION", "solution")).run


def _work(clock):
    """Default work: advance the clock by the message's processing time, then succeed."""
    def work(m):
        clock.advance(m.processing_ms)
    return work


def test_idempotent_processing():
    """At-least-once means a duplicate of a message may arrive; the effect must apply once."""
    clock = Clock()
    msgs = [Message("evt-1", "A", 10), Message("evt-1", "A", 10)]  # same id, delivered twice
    broker = Broker(msgs, clock)
    sink = Sink()
    run(broker, sink, _work(clock), clock, max_polls=50)
    assert sink.applied.count("A") == 1, f"payload applied {sink.applied.count('A')}x, want 1"
    assert broker.pending() == 0


def test_ack_only_after_processing():
    """A message whose processing fails once must not be lost; it must be retried, not acked early."""
    clock = Clock()
    msg = Message("evt-2", "B", 10)
    broker = Broker([msg], clock)
    sink = Sink()

    def work(m):
        clock.advance(m.processing_ms)
        if m.delivery_count == 1:      # fail the first attempt, succeed on retry
            raise TransientError()

    run(broker, sink, work, clock, max_polls=50)
    assert sink.applied == ["B"], f"want B applied once after retry, got {sink.applied}"
    assert broker.pending() == 0


def test_extend_visibility_for_slow_job():
    """A job longer than the visibility timeout must keep its lease, or it is redelivered
    and processed twice. The message must be delivered exactly once."""
    clock = Clock()
    msg = Message("evt-3", "C", processing_ms=1500)   # > visibility_timeout (1000)
    broker = Broker([msg], clock, visibility_timeout=1000)
    sink = Sink()
    run(broker, sink, _work(clock), clock, max_polls=50)
    assert msg.delivery_count == 1, f"delivered {msg.delivery_count}x; lease was not held"
    assert sink.applied == ["C"]
    assert broker.pending() == 0


def test_dead_letter_poison_message():
    """A message that can never be processed must be dead-lettered, not retried forever."""
    clock = Clock()
    msg = Message("evt-4", "D", 10)
    broker = Broker([msg], clock)
    sink = Sink()

    def work(m):
        clock.advance(m.processing_ms)
        raise Poison()

    run(broker, sink, work, clock, max_polls=50)
    assert msg in broker.dead_letter_queue, "poison message was not dead-lettered"
    assert sink.applied == [], "poison message must never reach the sink"
    assert broker.pending() == 0, "queue not drained: consumer likely retried forever"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
