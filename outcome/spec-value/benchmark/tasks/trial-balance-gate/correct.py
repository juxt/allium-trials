def build(base_debits, base_credits, amount):
    """Post a journal entry of `amount`. Precondition: base_debits == base_credits.
    A balanced posting raises debits and credits equally."""
    return {"debits": base_debits + amount, "credits": base_credits + amount}
