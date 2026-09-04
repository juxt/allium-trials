`drain(queue, process, max_ops)` works through `queue`, calling `process(item)` on each item it removes
from the front. If `process(item)` returns a falsy value, the item is appended back onto the queue to be
retried later. The function performs at most `max_ops` iterations in total, then returns whatever remains
in the queue.
