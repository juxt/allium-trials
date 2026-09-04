def drain_batches(total, get_batch_size):
    # legacy drainer: process `total` items in dynamically-sized batches. `get_batch_size(remaining)`
    # is supplied by the caller and decides how many to take next.
    processed = 0
    while processed < total:
        size = get_batch_size(total - processed)
        if size < 1:
            size = 1
        processed = processed + size
    return processed
