class Account:
    def __init__(self, balance: int = 0):
        self.balance = balance
    def deposit(self, amount: int) -> None:
        self.balance += amount
    def withdraw(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
    def fee(self, amount: int) -> None:
        if amount > self.balance:            # the balance guard — the whole point
            raise ValueError("insufficient funds for fee")
        self.balance -= amount
