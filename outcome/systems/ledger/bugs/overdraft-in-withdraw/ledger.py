"""A small money ledger. Amounts are non-negative integer minor units (e.g. pence),
so there is no floating-point rounding to reason about.

Behaviour of record (this is what the acceptance suite pins down):
  - Accounts are opened once and start at a zero balance.
  - Deposits and withdrawals move a strictly positive amount.
  - A withdrawal or a transfer may never drive a balance below zero.
  - A transfer moves value from one account to another and is atomic: it either
    completes on both legs or changes nothing.
  - Money is conserved: a transfer leaves the sum of all balances unchanged.
  - A transfer between an account and itself is rejected (it would be a no-op that
    hides bugs).
"""


class LedgerError(Exception):
    pass


class UnknownAccount(LedgerError):
    pass


class DuplicateAccount(LedgerError):
    pass


class InvalidAmount(LedgerError):
    pass


class InsufficientFunds(LedgerError):
    pass


class SameAccount(LedgerError):
    pass


class Ledger:
    def __init__(self):
        self._balances = {}

    # --- account lifecycle -------------------------------------------------
    def open(self, account_id):
        if account_id in self._balances:
            raise DuplicateAccount(account_id)
        self._balances[account_id] = 0

    def balance(self, account_id):
        self._require(account_id)
        return self._balances[account_id]

    def accounts(self):
        return sorted(self._balances)

    def total(self):
        return sum(self._balances.values())

    # --- movements ---------------------------------------------------------
    def deposit(self, account_id, amount):
        self._check_amount(amount)
        self._require(account_id)
        self._balances[account_id] += amount

    def withdraw(self, account_id, amount):
        self._check_amount(amount)
        self._require(account_id)
        self._balances[account_id] -= amount

    def transfer(self, src, dst, amount):
        self._check_amount(amount)
        self._require(src)
        self._require(dst)
        if src == dst:
            raise SameAccount(src)
        if self._balances[src] < amount:
            raise InsufficientFunds(src)
        # Atomic: compute both, then commit both.
        self._balances[src] -= amount
        self._balances[dst] += amount

    # --- helpers -----------------------------------------------------------
    def _require(self, account_id):
        if account_id not in self._balances:
            raise UnknownAccount(account_id)

    @staticmethod
    def _check_amount(amount):
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise InvalidAmount("amount must be an integer")
        if amount <= 0:
            raise InvalidAmount("amount must be strictly positive")
