#!/usr/bin/env python3
"""A small reporting gateway (the 'build'), instrumented to emit a monitor trace.

The gateway processes trade events into TR reports and drives their lifecycle. The
`emit` adapter is the ONE integration point: it projects each report's state onto the
spec's observable predicates and writes a line in `allium monitor`'s trace format. The
monitor is derived from ReportLifecycle.allium, so the running code is checked against the
same artifact that was verified at design time.

The gateway supports bespoke collateral schedules. The design-time feasibility check said
a bespoke report can never be accepted (bespoke is collateralised, so it needs a portfolio
code, but bespoke forbids the code). Shipped anyway, the gateway emits such reports and the
runtime monitor catches them: one property, caught at both stages.
"""

import sys

PREDS = [
    "cleared", "has_ccp_lei", "collateralised", "has_collateral_code",
    "bespoke_collateral", "submitted", "accepted", "rejected",
]


class Report:
    def __init__(self, rid):
        self.rid = rid
        self.f = {p: False for p in PREDS}


class ReportingGateway:
    def __init__(self, out):
        self.out = out
        self.seq = 0
        self.reports = {}

    def emit(self, r):
        """Adapter: project report state onto the spec's predicates, one trace line."""
        self.seq += 1
        fields = " ".join(f"{p}={'T' if r.f[p] else 'F'}" for p in PREDS)
        self.out.write(f"t={self.seq} entity={r.rid} {fields}\n")

    def submit(self, rid, *, cleared=False, collateral=None):
        r = self.reports.setdefault(rid, Report(rid))
        r.f["submitted"] = True
        if cleared:
            r.f["cleared"] = True
            r.f["has_ccp_lei"] = True           # a cleared report carries the CCP LEI
        if collateral == "standard":
            r.f["collateralised"] = True
            r.f["has_collateral_code"] = True    # standard schedule -> portfolio code
        elif collateral == "bespoke":
            r.f["collateralised"] = True
            r.f["bespoke_collateral"] = True
            r.f["has_collateral_code"] = False   # bespoke -> no code (the shipped feature)
        self.emit(r)

    def accept(self, rid):
        r = self.reports[rid]
        r.f["accepted"] = True
        r.f["rejected"] = False
        self.emit(r)

    def late_correction_reject(self, rid):
        """A late correction path that rejects an already-accepted report."""
        r = self.reports[rid]
        r.f["rejected"] = True
        r.f["accepted"] = False
        self.emit(r)


def main():
    out = open(sys.argv[1], "w") if len(sys.argv) > 1 else sys.stdout
    gw = ReportingGateway(out)

    # A compliant cleared report through to acceptance.
    gw.submit("R1", cleared=True)
    gw.accept("R1")

    # A standard-collateral report: compliant.
    gw.submit("R2", collateral="standard")
    gw.accept("R2")

    # A bespoke-collateral report: the shipped feature the design-time check rejected.
    gw.submit("R3", collateral="bespoke")

    # A report accepted, then rejected by the late-correction path (a lifecycle regression).
    gw.submit("R4", cleared=True)
    gw.accept("R4")
    gw.late_correction_reject("R4")

    if out is not sys.stdout:
        out.close()


if __name__ == "__main__":
    main()
