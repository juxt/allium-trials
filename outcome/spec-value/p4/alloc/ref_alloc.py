# PRO-RATA allocation: split the payment proportionally across the dues (each gets its share of the total),
# NOT a waterfall. A real but non-default convention the model won't guess.
def allocate(payment, penalty_due, fee_due, interest_due, principal_due):
    total = penalty_due + fee_due + interest_due + principal_due
    pay = min(round(payment,2), round(total,2))
    if total == 0: return {"penalty":0.0,"fee":0.0,"interest":0.0,"principal":0.0,"unapplied":round(payment,2)}
    out={}
    for name,due in [("penalty",penalty_due),("fee",fee_due),("interest",interest_due),("principal",principal_due)]:
        out[name]=round(pay*(due/total),2)
    out["unapplied"]=round(payment - sum(out.values()),2)
    return out
