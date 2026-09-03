"""Implement a reliable consumer for the at-least-once broker in harness.py.

Fill in `run`. You are given:

  broker  — poll() -> Receipt|None, ack(receipt) -> bool, extend_visibility(receipt, ms) -> bool,
            dead_letter(receipt), pending() -> int   (see harness.py for the mechanics)
  sink    — apply(payload): the downstream effect for a message
  work    — work(message): does the processing. It advances the clock by the message's
            processing time and returns None, or raises harness.Poison if this message can
            never be processed successfully.
  clock   — read clock.now (milliseconds)
  max_polls — an upper bound on poll() calls; stop when you reach it

Goal: apply each message's payload to the sink, reliably, draining the queue. Nothing else
is specified for you here — decide what "reliably" requires.
"""
from harness import Broker, Sink, Clock, Poison


def run(broker: Broker, sink: Sink, work, clock: Clock, max_polls: int = 1000) -> None:
    raise NotImplementedError
