def post_entry(debit_lines, credit_amount):
    """Post a journal entry. Fineract rule: sum(debits) == sum(credits) or the entry is unbalanced.
    Here the single credit_amount is split across two sub-ledger credit lines (a common real pattern)."""
    debits = list(debit_lines)
    half = credit_amount / 2                      # correct: exact split preserves the total
    credits = [half, credit_amount - half]        # second line takes the remainder -> total == credit_amount
    return {"debits": debits, "credits": credits}
