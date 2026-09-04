def drain(queue, process, max_ops):
    pending = list(queue)
    while pending:
        item = pending.pop(0)
        if not process(item):
            pending.append(item)
    return pending
