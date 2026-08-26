"""Hidden acceptance suite for the ledger — the ground truth.

Kept OUT of the codebase the elicit/distill loop sees. It scores any
implementation of `Ledger` (the reference, one built from a spec, a
reimplementation, or a planted-bug variant): drop the implementation's
`ledger.py` on the path and run `python3 -m unittest`.

Failure cases assert that SOME exception is raised and that state is unchanged,
rather than a specific exception class, so a reimplementation is judged on
behaviour, not on how it names its errors.
"""

import unittest

from ledger import Ledger


def fresh(**balances):
    lg = Ledger()
    for acc, bal in balances.items():
        lg.open(acc)
        if bal:
            lg.deposit(acc, bal)
    return lg


class OpenAndBalance(unittest.TestCase):
    def test_new_account_starts_at_zero(self):
        lg = Ledger()
        lg.open("a")
        self.assertEqual(lg.balance("a"), 0)

    def test_unknown_account_balance_raises(self):
        lg = Ledger()
        with self.assertRaises(Exception):
            lg.balance("nope")

    def test_double_open_raises(self):
        lg = Ledger()
        lg.open("a")
        with self.assertRaises(Exception):
            lg.open("a")

    def test_total_is_sum_of_balances(self):
        lg = fresh(a=100, b=250)
        self.assertEqual(lg.total(), 350)


class Deposit(unittest.TestCase):
    def test_deposit_increases_balance(self):
        lg = fresh(a=0)
        lg.deposit("a", 100)
        self.assertEqual(lg.balance("a"), 100)

    def test_deposit_unknown_account_raises(self):
        lg = Ledger()
        with self.assertRaises(Exception):
            lg.deposit("a", 100)

    def test_deposit_zero_raises(self):
        lg = fresh(a=10)
        with self.assertRaises(Exception):
            lg.deposit("a", 0)
        self.assertEqual(lg.balance("a"), 10)

    def test_deposit_negative_raises(self):
        lg = fresh(a=10)
        with self.assertRaises(Exception):
            lg.deposit("a", -5)
        self.assertEqual(lg.balance("a"), 10)


class Withdraw(unittest.TestCase):
    def test_withdraw_decreases_balance(self):
        lg = fresh(a=100)
        lg.withdraw("a", 40)
        self.assertEqual(lg.balance("a"), 60)

    def test_withdraw_exact_balance_ok(self):
        lg = fresh(a=100)
        lg.withdraw("a", 100)
        self.assertEqual(lg.balance("a"), 0)

    def test_withdraw_over_balance_raises_and_leaves_state(self):
        lg = fresh(a=100)
        with self.assertRaises(Exception):
            lg.withdraw("a", 101)  # one over: the overdraft boundary
        self.assertEqual(lg.balance("a"), 100)

    def test_balance_never_negative(self):
        lg = fresh(a=50)
        with self.assertRaises(Exception):
            lg.withdraw("a", 1000)
        self.assertGreaterEqual(lg.balance("a"), 0)

    def test_withdraw_zero_raises(self):
        lg = fresh(a=50)
        with self.assertRaises(Exception):
            lg.withdraw("a", 0)


class Transfer(unittest.TestCase):
    def test_transfer_moves_value(self):
        lg = fresh(a=100, b=0)
        lg.transfer("a", "b", 30)
        self.assertEqual(lg.balance("a"), 70)
        self.assertEqual(lg.balance("b"), 30)

    def test_transfer_conserves_total(self):
        lg = fresh(a=100, b=200, c=0)
        before = lg.total()
        lg.transfer("a", "c", 55)
        self.assertEqual(lg.total(), before)

    def test_transfer_insufficient_is_atomic(self):
        lg = fresh(a=40, b=10)
        with self.assertRaises(Exception):
            lg.transfer("a", "b", 41)  # a cannot cover it
        # neither leg moved
        self.assertEqual(lg.balance("a"), 40)
        self.assertEqual(lg.balance("b"), 10)

    def test_transfer_exact_balance_ok(self):
        lg = fresh(a=40, b=0)
        lg.transfer("a", "b", 40)
        self.assertEqual(lg.balance("a"), 0)
        self.assertEqual(lg.balance("b"), 40)

    def test_transfer_same_account_raises(self):
        lg = fresh(a=100)
        with self.assertRaises(Exception):
            lg.transfer("a", "a", 10)
        self.assertEqual(lg.balance("a"), 100)

    def test_transfer_unknown_dst_raises_and_leaves_src(self):
        lg = fresh(a=100)
        with self.assertRaises(Exception):
            lg.transfer("a", "ghost", 10)
        self.assertEqual(lg.balance("a"), 100)

    def test_transfer_negative_raises(self):
        lg = fresh(a=100, b=0)
        with self.assertRaises(Exception):
            lg.transfer("a", "b", -10)
        self.assertEqual(lg.balance("a"), 100)
        self.assertEqual(lg.balance("b"), 0)


class Conservation(unittest.TestCase):
    def test_many_transfers_conserve_and_stay_nonnegative(self):
        lg = fresh(a=100, b=100, c=100)
        moves = [("a", "b", 30), ("b", "c", 50), ("c", "a", 70), ("a", "b", 10)]
        for src, dst, amt in moves:
            try:
                lg.transfer(src, dst, amt)
            except Exception:
                pass
            self.assertEqual(lg.total(), 300)
            for acc in lg.accounts():
                self.assertGreaterEqual(lg.balance(acc), 0)


if __name__ == "__main__":
    unittest.main()
