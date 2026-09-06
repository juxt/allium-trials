def build(base_debits, base_credits, amount):
    debits = base_debits + amount
    credits = base_credits + (amount // 2) + (amount // 2)   # BUG: loses $1 for odd amount
    return {"debits": debits, "credits": credits}
