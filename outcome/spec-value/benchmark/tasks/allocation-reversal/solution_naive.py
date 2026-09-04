from base import ORDER, allocate
def reverse(allocations, amount):
    remaining = amount; out = {}
    for key in ORDER:                      # forward, not reverse -> wrong
        rev = min(remaining, allocations.get(key,0))
        if rev > 0: out[key]=rev; remaining-=rev
    return out
