def run_safe_while_loop(max_iterations, condition, body):
    count = 0
    while condition():
        count += 1
        if count > max_iterations:
            raise RuntimeError(f"Loop exceeded {max_iterations} iterations. Possible infinite loop.")
        body()

def run_safe_do_while_loop(max_iterations, condition, body):
    count = 0
    while True:
        count += 1
        if count > max_iterations:
            raise RuntimeError(f"Loop exceeded {max_iterations} iterations. Possible infinite loop.")
        body()
        if not condition():
            break
