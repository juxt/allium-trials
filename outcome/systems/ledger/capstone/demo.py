"""Capstone demo — one spec, three uses.

Runs the spec-derived runtime monitor over a live ledger, for both the correct
implementation and the overdraft-bug variant, showing the monitor catching at
RUNTIME the same invariant violation that weed caught at DESIGN time (Trial B).
"""

import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER_SYS = os.path.dirname(HERE)

from monitor import MonitoredLedger, MonitorViolation


def load_ledger(path):
    spec = importlib.util.spec_from_file_location("ledgermod", path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.Ledger


def run(LedgerClass, label):
    lg = MonitoredLedger(LedgerClass())
    lg.open("a")
    lg.open("b")
    lg.deposit("a", 100)
    try:
        lg.withdraw("a", 150)  # attempt to overdraw
        print(f"  {label}: no violation, balance a = {lg.balance('a')}")
    except MonitorViolation as e:
        print(f"  {label}: MONITOR CAUGHT AT RUNTIME → {e}")
    except Exception as e:
        print(f"  {label}: ledger rejected the operation ({type(e).__name__}) — correct, nothing for the monitor to catch")


if __name__ == "__main__":
    print("Runtime monitoring (spec invariants) over a live ledger:")
    run(load_ledger(os.path.join(LEDGER_SYS, "codebase", "ledger.py")), "correct ledger")
    run(load_ledger(os.path.join(LEDGER_SYS, "bugs", "overdraft-in-withdraw", "ledger.py")), "buggy ledger  ")
