def drain_batches(total, get_batch_size):
    processed = 0
    while processed < total:
        size = max(1, get_batch_size(total - processed))   # floor preserved
        processed += size
    return processed
