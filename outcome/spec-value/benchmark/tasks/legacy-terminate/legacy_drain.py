def drain(queue, process, max_ops):
    ops = max_ops
    result = []
    while queue and ops > 0:
        item = queue.pop(0)
        ops = ops - 1
        ok = process(item)
        if ok:
            result.append(item)
        else:
            queue.append(item)
    return queue
