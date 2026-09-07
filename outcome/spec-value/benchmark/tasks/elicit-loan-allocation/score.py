"""Behavioural oracle: run a candidate allocate_payment over per-decision scenarios.
Each scenario isolates one bible decision. Prints JSON {decisions:[{n,passed}], passed, total}.
Usage: SOLUTION=<module> python3 score.py   (default module: reference)"""
import os, json, importlib
from decimal import Decimal

Q = Decimal('0.001')
mod = importlib.import_module(os.environ.get('SOLUTION', 'reference'))
allocate = mod.allocate_payment


def D(s):
    return Decimal(str(s)).quantize(Q)


def eq(a, b):
    try:
        return D(a) == D(b)
    except Exception:
        return False


def find(rows, due, bucket):
    for r in rows:
        if r.get('due_date') == due:
            return r.get(bucket)
    return None


def inst(due, fees='0.000', pen='0.000', intr='0.000', prin='0.000',
         ipd='0.000', ppd='0.000', accr='2026-03-01'):
    return {'due_date': due, 'fees': fees, 'penalties': pen, 'interest': intr,
            'principal': prin, 'interest_per_day': ipd, 'penalty_per_day': ppd, 'accrued_to': accr}


def loan(insts, credit='0.000', as_of='2026-03-01'):
    return {'currency': 'BHD', 'as_of': as_of, 'credit_balance': credit, 'instalments': insts}


def pay(amount, vd='2026-03-01', ts=1):
    return {'amount': amount, 'value_date': vd, 'timestamp': ts}


# each: (n, name, thunk) — thunk returns True if the decision is implemented correctly
def s1():
    r = allocate(pay('6.000'), loan([inst('2026-01-01', fees='5.000', pen='5.000', intr='5.000', prin='5.000')]))
    return eq(find(r['applied'], '2026-01-01', 'fees'), '5.000') and eq(find(r['applied'], '2026-01-01', 'penalties'), '1.000')

def s2():
    r = allocate(pay('10.000'), loan([inst('2026-01-01', fees='10.000'), inst('2026-02-01', fees='10.000')]))
    return eq(find(r['applied'], '2026-01-01', 'fees'), '10.000') and eq(find(r['applied'], '2026-02-01', 'fees'), '0.000')

def s3():
    r = allocate(pay('15.000'), loan([inst('2026-01-01', fees='10.000')]))
    return eq(r['credit_balance'], '5.000') and eq(find(r['balances'], '2026-01-01', 'fees'), '0.000')

def s4():
    r = allocate(pay('0.125'), loan([inst('2026-01-01', fees='0.125')]))
    return eq(find(r['applied'], '2026-01-01', 'fees'), '0.125') and eq(find(r['balances'], '2026-01-01', 'fees'), '0.000')

def s5():
    r = allocate(pay('100.000', vd='2026-01-02'), loan([inst('2026-01-02', intr='0.000', ipd='0.0005', accr='2026-01-01')]))
    return eq(find(r['applied'], '2026-01-02', 'interest'), '0.001')

def s7():
    r = allocate(pay('100.000', vd='2026-01-05'), loan([inst('2026-01-01', intr='10.000', ipd='1.000', accr='2026-01-10')]))
    return eq(find(r['applied'], '2026-01-01', 'interest'), '5.000')

def s8():
    r = allocate(pay('15.000', vd='2026-01-15'),
                 loan([inst('2026-01-01', prin='10.000', accr='2026-01-15'), inst('2026-06-01', prin='20.000', accr='2026-01-15')]))
    return (eq(r['credit_balance'], '5.000') and eq(find(r['balances'], '2026-06-01', 'principal'), '20.000')
            and eq(find(r['applied'], '2026-06-01', 'principal'), '0.000'))

def s9():
    r = allocate(pay('4.000'), loan([inst('2026-01-01', fees='10.000', intr='10.000')]))
    return eq(find(r['applied'], '2026-01-01', 'fees'), '4.000') and eq(find(r['applied'], '2026-01-01', 'interest'), '0.000')

def s10():
    r = allocate(pay('10.000'), loan([inst('2026-01-01', fees='10.003')]))
    return eq(r['tolerance_written_off'], '0.003') and eq(find(r['balances'], '2026-01-01', 'fees'), '0.000')

def s11():
    ok_neg = False
    try:
        allocate(pay('-5.000'), loan([inst('2026-01-01', fees='10.000')]))
    except ValueError:
        ok_neg = True
    except Exception:
        ok_neg = False
    try:
        r = allocate(pay('0.000'), loan([inst('2026-01-01', fees='10.000')]))
        ok_zero = eq(find(r['applied'], '2026-01-01', 'fees'), '0.000') and eq(find(r['balances'], '2026-01-01', 'fees'), '10.000')
    except Exception:
        ok_zero = False
    return ok_neg and ok_zero

def s12():
    r = allocate(pay('100.000', vd='2026-01-04'), loan([inst('2026-01-01', pen='0.000', ppd='2.000', accr='2026-01-01')]))
    return eq(find(r['applied'], '2026-01-01', 'penalties'), '6.000')


SCEN = [(1, 'bucket-order', s1), (2, 'oldest-first', s2), (3, 'overpay-credit', s3),
        (4, 'bhd-3dp', s4), (5, 'half-up', s5), (7, 'backdate-recompute', s7),
        (8, 'no-principal-prepay', s8), (9, 'strict-no-proportional', s9),
        (10, 'tolerance-writeoff', s10), (11, 'zero-neg', s11), (12, 'penalty-accrual', s12)]

out = []
for n, name, fn in SCEN:
    try:
        passed = bool(fn())
    except Exception:
        passed = False
    out.append({'n': n, 'name': name, 'passed': passed})
print(json.dumps({'decisions': out, 'passed': sum(d['passed'] for d in out), 'total': len(out)}))
