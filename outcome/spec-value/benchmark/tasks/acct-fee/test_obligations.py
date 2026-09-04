"""Hidden oracle for acct-fee. Scores the new feature AND the preserved existing behaviour."""
import importlib, os
Account = importlib.import_module(os.environ.get("SOLUTION", "solution")).Account

def test_fee_charges():
    """NEW: a fee reduces the balance by its amount."""
    a = Account(100); a.fee(10)
    assert a.balance == 90, f"fee did not charge correctly: {a.balance}"

def test_fee_never_overdraws():
    """THE GOTCHA / REGRESSION: a fee larger than the balance must not drive it negative
    (the existing nonneg invariant). A naive unguarded fee fails here."""
    a = Account(5)
    try:
        a.fee(10)
    except Exception:
        pass  # rejecting is fine
    assert a.balance >= 0, f"fee overdrew the account: balance={a.balance}"

def test_existing_withdraw_still_guarded():
    """REGRESSION on existing behaviour: withdraw must still refuse to overdraw."""
    a = Account(5)
    try:
        a.withdraw(10)
    except Exception:
        pass
    assert a.balance >= 0, f"withdraw overdrew: {a.balance}"

if __name__ == "__main__":
    import pytest; raise SystemExit(pytest.main([__file__, "-q"]))
