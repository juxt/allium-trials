def drain_batches(total, get_batch_size):
    processed = 0
    while processed < total:
        processed += get_batch_size(total - processed)   # floor dropped
    return processed
