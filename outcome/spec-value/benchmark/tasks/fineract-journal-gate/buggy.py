def post_entry(debit_lines, credit_amount):
    debits = list(debit_lines)
    half = credit_amount // 2                      # BUG: integer division on both lines loses $1 for odd totals
    credits = [half, half]
    return {"debits": debits, "credits": credits}
