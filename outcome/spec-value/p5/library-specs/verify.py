#!/usr/bin/env python3
"""Validate the library-spec hypothesis: referencing a library spec catches a client-library mismatch.

Each case runs `allium analyse <library> <consumer>` and checks the satisfaction verdict against the
imported contract. A naive consumer that violates the library's consumer-obligation must be REFUSED; a
correct consumer must SATISFY. Run: ALLIUM=/path/to/allium python3 verify.py
"""
import json, os, subprocess, sys

ALLIUM = os.environ.get("ALLIUM", "allium")
HERE = os.path.dirname(os.path.abspath(__file__))

# (consumer file, library file, expected verdict).
#   Obligation direction (consumer must meet the library's requirement): SATISFY / REFUSE.
#   Reliance direction (consumer relies on a library guarantee): DISCHARGE / UNDISCHARGE.
CASES = [
    ("consumer_safe.allium",              "kafka_at_least_once.allium", "SATISFY"),
    ("consumer_naive.allium",             "kafka_at_least_once.allium", "REFUSE"),
    ("fineract_service_safe.allium",       "fineract_loan_store.allium", "SATISFY"),
    ("fineract_service_lostupdate.allium", "fineract_loan_store.allium", "REFUSE"),
    ("fineract_service_overdraw.allium",   "fineract_loan_store.allium", "REFUSE"),
    ("consumer_relies_ok.allium",          "kafka_guarantees.allium",    "DISCHARGE"),
    ("consumer_relies_wrong.allium",       "kafka_guarantees.allium",    "UNDISCHARGE"),
    ("lock_client_safe.allium",            "distributed_lock.allium",    "SATISFY"),
    ("lock_client_naive.allium",           "distributed_lock.allium",    "REFUSE"),
]

def verdict(lib, consumer):
    out = subprocess.run([ALLIUM, "analyse", os.path.join(HERE, lib), os.path.join(HERE, consumer)],
                         capture_output=True, text=True).stdout
    if "does NOT satisfy" in out:
        return "REFUSE"
    if "SATISFIES contract" in out:
        return "SATISFY"
    if "is DISCHARGED by a library guarantee" in out:
        return "DISCHARGE"
    if "is NOT discharged by any library guarantee" in out:
        return "UNDISCHARGE"
    return "UNKNOWN"

def main():
    ok = True
    print(f"{"consumer":<38}{"library":<32}{"want":<13}{"got":<13}result")
    print("-" * 86)
    for consumer, lib, want in CASES:
        got = verdict(lib, consumer)
        passed = got == want
        ok = ok and passed
        print(f"{consumer:<38}{lib:<32}{want:<13}{got:<13}{'PASS' if passed else 'FAIL <<<'}")
    print("-" * 86)
    print("LIBRARY-SPEC HYPOTHESIS VALIDATED" if ok else "VALIDATION FAILED")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
