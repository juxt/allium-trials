class Account:
    def __init__(self, balance: int):
        self.balance = balance
    def withdraw(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
    def charge(self) -> None:
        if self.balance < 15:            # correct: guard covers the whole fee
            raise ValueError("insufficient for fee")
        self.balance -= 15
