def run_safe_while_loop(max_iterations, condition, body):
    while condition():
        body()

def run_safe_do_while_loop(max_iterations, condition, body):
    while True:
        body()
        if not condition():
            break
