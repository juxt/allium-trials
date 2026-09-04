"""An account with a non-negative balance. deposit and withdraw already exist and are correct;
withdraw is guarded so the balance never goes negative. (Amounts are integer minor units.)"""
class Account:
    def __init__(self, balance: int = 0):
        self.balance = balance
    def deposit(self, amount: int) -> None:
        self.balance += amount
    def withdraw(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
