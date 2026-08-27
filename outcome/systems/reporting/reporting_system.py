#!/usr/bin/env python3
"""A CFTC trade-reporting system (the 'build'), instrumented to emit a monitor trace.

It processes a workload of trade lifecycle operations, assigns UTIs, drives report
lifecycle, and handles clearing, collateral and post-trade allocations. The `emit` adapter
projects each report's state onto the spec's observable predicates (Reporting.allium) and
writes a trace line, so the running system is observed through the spec's own vocabulary.

Version flag `VERSION` selects behaviour, for the regression experiment:
  1  ships three latent data-quality defects (bespoke-no-code, late-correction reject,
     a UTI reuse on re-book, and an allocation booked before its block is reported);
  2  fixes them.
"""

import os
import sys

# A "commit" is a set of bug flags (each defect an independent feature/regression).
def bug(name):
    return os.environ.get(name, "0") == "1"

PREDS_BOOL = [
    "action_new", "action_modify", "cleared", "has_ccp_lei", "collateralised",
    "has_collateral_code", "bespoke_collateral", "submitted", "accepted", "rejected",
    "allocation",
]
PREDS_VAL = ["uti", "prior_uti"]


class Report:
    def __init__(self, rid):
        self.rid = rid
        self.b = {p: False for p in PREDS_BOOL}
        self.v = {p: "none" for p in PREDS_VAL}


class ReportingSystem:
    def __init__(self, out):
        self.out = out
        self.seq = 0
        self.reports = {}
        self.next_uti = 1

    def emit(self, r):
        self.seq += 1
        cells = [f"{p}={'T' if r.b[p] else 'F'}" for p in PREDS_BOOL]
        cells += [f"{p}={r.v[p]}" for p in PREDS_VAL]
        self.out.write(f"t={self.seq} entity={r.rid} {' '.join(cells)}\n")

    def mint_uti(self):
        u = f"U{self.next_uti:03d}"
        self.next_uti += 1
        return u

    def new_trade(self, rid, *, cleared=False, collateral=None, reuse_uti=None):
        r = self.reports.setdefault(rid, Report(rid))
        r.b["action_new"] = True
        r.b["submitted"] = True
        # BUG_REBOOK: a re-book path reuses an existing UTI instead of minting a fresh one.
        r.v["uti"] = reuse_uti if (reuse_uti and bug("BUG_REBOOK")) else self.mint_uti()
        if cleared:
            r.b["cleared"] = True
            r.b["has_ccp_lei"] = True
        if collateral == "standard":
            r.b["collateralised"] = True
            r.b["has_collateral_code"] = True
        elif collateral == "bespoke":
            r.b["collateralised"] = True
            # BUG_BESPOKE: bespoke leaves the code empty; otherwise fall back to a code.
            if bug("BUG_BESPOKE"):
                r.b["bespoke_collateral"] = True
                r.b["has_collateral_code"] = False
            else:
                r.b["has_collateral_code"] = True
        self.emit(r)

    def accept(self, rid):
        r = self.reports[rid]
        r.b["accepted"] = True
        r.b["rejected"] = False
        self.emit(r)

    def late_reject(self, rid):
        r = self.reports[rid]
        # BUG_LATE_REJECT: a late correction rejects an already-accepted report; otherwise a
        # new correction report is opened instead of un-accepting.
        if bug("BUG_LATE_REJECT"):
            r.b["rejected"] = True
            r.b["accepted"] = False
        self.emit(r)

    def allocate(self, rid, block_uti):
        r = self.reports.setdefault(rid, Report(rid))
        r.b["action_new"] = True
        r.b["submitted"] = True
        r.b["allocation"] = True
        r.v["uti"] = self.mint_uti()
        r.v["prior_uti"] = block_uti
        self.emit(r)


def workload(sys_):
    # A block trade, cleared, accepted.
    sys_.new_trade("B1", cleared=True)
    sys_.accept("B1")
    b1_uti = sys_.reports["B1"].v["uti"]

    # Allocations of the block to client sub-accounts, referencing the block UTI.
    sys_.allocate("A1", b1_uti)
    sys_.allocate("A2", b1_uti)

    # A standard-collateral trade: compliant.
    sys_.new_trade("T2", collateral="standard")
    sys_.accept("T2")

    # A bespoke-collateral trade (design-time-infeasible feature).
    sys_.new_trade("T3", collateral="bespoke")

    # A trade accepted then hit by a late correction.
    sys_.new_trade("T4", cleared=True)
    sys_.accept("T4")
    sys_.late_reject("T4")

    # A re-booked trade that reuses B1's UTI (uniqueness breach on v1).
    sys_.new_trade("T5", reuse_uti=b1_uti)

    # BUG_ORPHAN: an allocation booked before its block is reported (referential-integrity
    # breach); otherwise it is booked against the real block UTI.
    sys_.allocate("A3", "U999" if bug("BUG_ORPHAN") else b1_uti)


def main():
    out = open(sys.argv[1], "w") if len(sys.argv) > 1 else sys.stdout
    workload(ReportingSystem(out))
    if out is not sys.stdout:
        out.close()


if __name__ == "__main__":
    main()
