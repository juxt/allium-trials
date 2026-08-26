# Capstone — one spec, three uses

Allium's mission is to design rigorously, stress-test designs before implementation,
and monitor running code, all from one specification. The capstone shows a single
ledger spec serving all three stages, with the SAME invariant (`NonNegativeBalance`,
`balance >= 0`) doing the work at each.

1. **Verify the design (design time).** Trial B: `weed` audited the spec against the
   overdraft-bug variant and caught it — "Withdraw — missing insufficient-funds guard",
   tied to the spec's `NonNegativeBalance` invariant. The design flaw is found before,
   and without, running the code. 3/3 planted bugs caught this way.

2. **Drive the build.** Trial D: a reimplementation built from the distilled spec alone
   (no source) passes the whole hidden acceptance suite, 21/21. The spec is a sufficient
   basis to construct the system.

3. **Monitor the running system (runtime).** `capstone/demo.py` wraps a live ledger with
   a monitor derived from the same spec invariants. On the correct ledger it stays quiet
   (the ledger self-protects); on the buggy ledger it catches the violation as it happens:

   ```
   correct ledger: ledger rejected the operation (InsufficientFunds) — nothing to catch
   buggy ledger  : MONITOR CAUGHT AT RUNTIME → after withdraw('a', 150): balance of 'a'
                   is -50 — violates the spec invariant NonNegativeBalance (balance >= 0)
   ```

So one artefact — the spec's `NonNegativeBalance` invariant — verifies the design,
underwrites the build, and watches the run. No point tool spans all three from a single
source. That is Allium's differentiator, shown end to end.

**Honest note.** The runtime monitor here is hand-derived from the spec's invariants.
Generating it automatically from the spec is Allium's runtime-monitor modality (v4, not
yet built). The capstone demonstrates the *one-spec-three-uses* principle; auto-generation
closes the loop.
