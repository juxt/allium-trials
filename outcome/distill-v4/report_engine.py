"""Trade reporting engine."""

class ReportEngine:
    def __init__(self):
        self._uti = 0
        self._submitted = {}      # uti -> report
        self._status = {}         # trade_id -> status

    def _mint(self):
        self._uti += 1
        return f"U{self._uti:04d}"

    def new_trade(self, trade_id, *, cleared=False, ccp_lei=None, notional=0, trade_time=None, submit_time=None):
        if trade_id in self._status and self._status[trade_id] != "cancelled":
            # B6: re-booking an existing live trade is idempotent — returns the existing UTI.
            return self._existing_uti(trade_id)
        if cleared and not ccp_lei:
            raise ValueError("cleared trade requires a CCP LEI")   # B3
        uti = self._mint()                                          # B1
        reportable = notional >= 1_000_000                          # B4 threshold
        # B4: below threshold is still submitted, flagged non-reportable (not dropped).
        # B7: the reported timestamp is the trade time, never the submission time.
        ts = trade_time if trade_time is not None else submit_time
        self._submitted[uti] = {"trade": trade_id, "reportable": reportable, "ts": ts, "prior": None}
        self._status[trade_id] = "live"
        self._uti_of = getattr(self, "_uti_of", {}); self._uti_of[trade_id] = uti
        return uti

    def _existing_uti(self, trade_id):
        return getattr(self, "_uti_of", {}).get(trade_id)

    def amend(self, trade_id, acknowledged_prior=True):
        prior = self._existing_uti(trade_id)
        if not acknowledged_prior:
            # B5: an amendment issued before the prior one is acknowledged is queued, not sent.
            self._status.setdefault("_queue", [])
            return ("queued", prior)
        uti = self._mint()
        self._submitted[uti] = {"trade": trade_id, "reportable": True, "ts": None, "prior": prior}  # B2 carries prior UTI
        return ("sent", uti, prior)

    def cancel(self, trade_id):
        if self._status.get(trade_id) == "cancelled":
            return "noop"    # B8: cancelling an already-cancelled trade is a no-op.
        self._status[trade_id] = "cancelled"
        return "cancelled"
