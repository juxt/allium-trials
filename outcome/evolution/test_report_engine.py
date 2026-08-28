"""Hidden acceptance suite for report_engine.py — the intended behaviours B1-B8.
The evolving AI never sees this; it scores whether adding a feature preserved them.
Run: PYTHONPATH=<workspace> python3 -m pytest test_report_engine.py -q"""
import importlib.util, os, sys

def load():
    path = os.path.join(os.environ["IMPL_DIR"], "report_engine.py")
    spec = importlib.util.spec_from_file_location("report_engine", path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m.ReportEngine

def test_B1_new_trade_gets_uti():
    E = load(); e = E()
    u = e.new_trade("T1")
    assert u and isinstance(u, str)

def test_B2_amend_carries_prior_uti():
    E = load(); e = E()
    u = e.new_trade("T1")
    res = e.amend("T1", acknowledged_prior=True)
    assert res[0] == "sent" and res[2] == u  # (sent, new_uti, prior)

def test_B3_cleared_requires_ccp_lei():
    E = load(); e = E()
    try:
        e.new_trade("T1", cleared=True)  # no ccp_lei
        assert False, "expected ValueError"
    except ValueError:
        pass
    assert e.new_trade("T2", cleared=True, ccp_lei="LEI1")

def test_B4_below_threshold_submitted_flagged_not_dropped():
    E = load(); e = E()
    u = e.new_trade("T1", notional=500)          # below 1_000_000
    assert u in e._submitted                      # submitted, not dropped
    assert e._submitted[u]["reportable"] is False # flagged non-reportable

def test_B5_amend_before_ack_is_queued():
    E = load(); e = E()
    e.new_trade("T1")
    res = e.amend("T1", acknowledged_prior=False)
    assert res[0] == "queued"

def test_B6_rebook_live_trade_is_idempotent():
    E = load(); e = E()
    u1 = e.new_trade("T1")
    u2 = e.new_trade("T1")   # re-book while live
    assert u1 == u2          # same UTI, not a fresh one

def test_B7_timestamp_is_trade_time_not_submit_time():
    E = load(); e = E()
    u = e.new_trade("T1", trade_time="09:00", submit_time="17:00")
    assert e._submitted[u]["ts"] == "09:00"

def test_B8_cancel_already_cancelled_is_noop():
    E = load(); e = E()
    e.new_trade("T1")
    assert e.cancel("T1") == "cancelled"
    assert e.cancel("T1") == "noop"

def test_UTI_uniqueness_across_distinct_trades():
    E = load(); e = E()
    us = {e.new_trade(f"T{i}") for i in range(5)}
    assert len(us) == 5
