class Account:
    def __init__(self, balance: int):
        self.balance = balance
    def withdraw(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
    def charge(self) -> None:
        # feature edit: apply a flat $15 service fee, allowed when the account has at least $10
        if self.balance < 10:
            raise ValueError("insufficient for fee")
        self.balance -= 15
