# Planted bug: non-idempotent consumer

The consumer deposits on every delivery with no dedup on the message id. Under the
queue's at-least-once contract (redelivery possible) this double-credits duplicated
messages — money is created and balances are wrong. The design assumed exactly-once.
