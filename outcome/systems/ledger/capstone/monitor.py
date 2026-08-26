"""Runtime monitor for the ledger, derived from the SAME spec invariants that
design-time verification checks: NonNegativeBalance (every balance >= 0) and
conservation (a transfer leaves the total unchanged).

It wraps a Ledger and re-checks the invariants after each operation, so a spec
that stress-tests the design before implementation also watches the running
system. Here the monitor is hand-derived from the spec's invariants; generating
it automatically from the spec is Allium's runtime-monitor modality (v4, not yet
built) — the point of the capstone is that ONE spec serves both stages.
"""


class MonitorViolation(Exception):
    pass


class MonitoredLedger:
    def __init__(self, ledger):
        self._lg = ledger

    def _check_nonnegative(self, op):
        for acc in self._lg.accounts():
            if self._lg.balance(acc) < 0:
                raise MonitorViolation(
                    f"after {op}: balance of {acc!r} is {self._lg.balance(acc)} — "
                    f"violates the spec invariant NonNegativeBalance (balance >= 0)"
                )

    def open(self, a):
        self._lg.open(a)
        self._check_nonnegative(f"open({a!r})")

    def deposit(self, a, amount):
        self._lg.deposit(a, amount)
        self._check_nonnegative(f"deposit({a!r}, {amount})")

    def withdraw(self, a, amount):
        self._lg.withdraw(a, amount)
        self._check_nonnegative(f"withdraw({a!r}, {amount})")

    def transfer(self, s, d, amount):
        before = self._lg.total()
        self._lg.transfer(s, d, amount)
        self._check_nonnegative(f"transfer({s!r}, {d!r}, {amount})")
        if self._lg.total() != before:
            raise MonitorViolation(
                f"after transfer({s!r}, {d!r}, {amount}): total went {before} -> {self._lg.total()} "
                f"— violates the spec invariant conservation"
            )

    # read-through
    def balance(self, a):
        return self._lg.balance(a)

    def total(self):
        return self._lg.total()

    def accounts(self):
        return self._lg.accounts()
