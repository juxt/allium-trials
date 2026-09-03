"""A correct consumer — passes all four obligation groups. Used to validate the oracle."""
from harness import Broker, Sink, Clock, WorkFailed

MAX_ATTEMPTS = 5


def run(broker: Broker, sink: Sink, work, clock: Clock, max_polls: int = 1000) -> None:
    applied: set[str] = set()      # ids already applied to the sink
    attempts: dict[str, int] = {}  # failed attempts per id

    for _ in range(max_polls):
        r = broker.poll()
        if r is None:
            return
        m = r.message

        if m.id in applied:        # a repeat delivery of work already done
            broker.ack(r)
            continue

        # keep the lease alive for the length of the job before starting it
        if clock.now + m.processing_ms > r.deadline:
            broker.extend_visibility(r, m.processing_ms + 100)

        try:
            work(m)
        except WorkFailed:
            attempts[m.id] = attempts.get(m.id, 0) + 1
            if attempts[m.id] >= MAX_ATTEMPTS:
                broker.dead_letter(r)
            continue               # do not ack; leave it for redelivery

        sink.apply(m.payload)      # apply exactly once, only after work succeeded
        applied.add(m.id)
        broker.ack(r)
