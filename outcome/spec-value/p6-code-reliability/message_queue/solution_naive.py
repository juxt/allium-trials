"""A plausible but naive consumer: acks after processing and retries on failure, but does not
dedup, does not extend the lease for slow jobs, and never gives up on a failing message. Used to
validate the oracle catches those bugs. Expected: passes ack-ordering only."""
from harness import Broker, Sink, Clock


def run(broker: Broker, sink: Sink, work, clock: Clock, max_polls: int = 1000) -> None:
    for _ in range(max_polls):
        r = broker.poll()
        if r is None:
            return
        m = r.message
        try:
            work(m)
        except Exception:
            continue               # leave unacked; will be redelivered
        sink.apply(m.payload)      # no dedup
        broker.ack(r)              # ignores whether the lease is still held
