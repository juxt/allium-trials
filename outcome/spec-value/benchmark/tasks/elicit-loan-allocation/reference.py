"""Reference implementation of allocate_payment honouring all 14 bible decisions.
Ground truth for the behavioural oracle. BHD, 3 decimal places."""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

Q = Decimal('0.001')
TOL = Decimal('0.005')
ORDER = ['fees', 'penalties', 'interest', 'principal']  # decision 1: fees before penalties


def _r(x):  # decision 5: half-up to the 3dp minor unit
    return Decimal(x).quantize(Q, rounding=ROUND_HALF_UP)


def _d(s):
    return Decimal(str(s))


def allocate_payment(payment, loan):
    amount = _d(payment['amount'])
    # decision 11: negative rejected; zero is a recorded no-op
    if amount < 0:
        raise ValueError('negative payment rejected')

    insts = [dict(i) for i in loan['instalments']]

    if amount == 0:
        return {
            'applied': [{'due_date': i['due_date'], 'fees': '0.000', 'penalties': '0.000',
                         'interest': '0.000', 'principal': '0.000'} for i in insts],
            'balances': [{'due_date': i['due_date'], **{b: str(_r(i[b])) for b in ORDER}} for i in insts],
            'credit_balance': str(_r(loan.get('credit_balance', '0'))),
            'tolerance_written_off': '0.000',
        }

    vd = date.fromisoformat(payment['value_date'])
    # decisions 7 & 12: re-accrue interest and penalties to the value_date (either direction)
    for i in insts:
        delta = (vd - date.fromisoformat(i['accrued_to'])).days
        if delta != 0:
            i['interest'] = _r(_d(i['interest']) + _d(i['interest_per_day']) * delta)
            i['penalties'] = _r(_d(i['penalties']) + _d(i['penalty_per_day']) * delta)
            i['accrued_to'] = payment['value_date']

    # decision 8 (+2): only instalments already due are eligible; oldest first, fully.
    for i in insts:
        i['_eligible'] = date.fromisoformat(i['due_date']) <= vd
    order_insts = sorted(range(len(insts)), key=lambda k: insts[k]['due_date'])

    applied = {k: {b: Decimal('0.000') for b in ORDER} for k in range(len(insts))}
    written_off = Decimal('0.000')
    remaining = _r(amount)

    for k in order_insts:
        i = insts[k]
        if not i['_eligible']:
            continue  # decision 8: never prepay a not-yet-due instalment
        for b in ORDER:  # decisions 1 & 9: strict order, no proportional split
            if remaining <= 0:
                break
            owed = _r(i[b])
            pay = _r(min(remaining, owed))
            applied[k][b] = pay
            i[b] = _r(owed - pay)
            remaining = _r(remaining - pay)
        # decision 10: write off a sub-tolerance residual on a touched instalment
        residual = sum(_r(i[b]) for b in ORDER)
        touched = any(applied[k][b] > 0 for b in ORDER)
        if touched and Decimal('0') < residual <= TOL:
            written_off = _r(written_off + residual)
            for b in ORDER:
                i[b] = Decimal('0.000')

    # decisions 3 & 8: surplus -> credit balance; never refund, never prepay principal
    credit = _r(loan.get('credit_balance', '0'))
    if remaining > 0:
        credit = _r(credit + remaining)

    return {
        'applied': [{'due_date': insts[k]['due_date'], **{b: str(applied[k][b]) for b in ORDER}}
                    for k in range(len(insts))],
        'balances': [{'due_date': insts[k]['due_date'], **{b: str(_r(insts[k][b])) for b in ORDER}}
                     for k in range(len(insts))],
        'credit_balance': str(credit),
        'tolerance_written_off': str(written_off),
    }
