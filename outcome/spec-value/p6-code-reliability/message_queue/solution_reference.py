"""A correct consumer — passes all four obligation groups. Used to validate the oracle."""
from harness import Broker, Sink, Clock, Poison, TransientError

MAX_ATTEMPTS = 3


def run(broker: Broker, sink: Sink, work, clock: Clock, max_polls: int = 1000) -> None:
    applied: set[str] = set()      # ids already applied to the sink
    attempts: dict[str, int] = {}  # failed attempts per id

    for _ in range(max_polls):
        r = broker.poll()
        if r is None:
            return
        m = r.message

        if m.id in applied:        # a duplicate delivery of work we already did
            broker.ack(r)
            continue

        # keep the lease alive for the length of the job before starting it
        if clock.now + m.processing_ms > r.deadline:
            broker.extend_visibility(r, m.processing_ms + 100)

        try:
            work(m)
        except Poison:
            attempts[m.id] = attempts.get(m.id, 0) + 1
            if attempts[m.id] >= MAX_ATTEMPTS:
                broker.dead_letter(r)
            # otherwise leave it unacked to be redelivered
            continue
        except TransientError:
            continue               # do not ack; let it be redelivered and retried

        sink.apply(m.payload)      # apply exactly once, only after work succeeded
        applied.add(m.id)
        broker.ack(r)
