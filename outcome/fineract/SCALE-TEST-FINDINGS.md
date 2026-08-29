# The scale test: blind cross-module edits vs an independent-authority invariant

The question the whole programme kept failing to answer: is there a regime where a deterministic
check catches something a competent model, working normally, silently ships? Everything smaller
saturated. This is the first test built to give verification a fair chance, and it did not
saturate.

## Design

- **Invariant (independent authority):** double-entry balance — for every loan transaction the
  accounting processor emits, Σ debits = Σ credits. This is accounting law, true regardless of
  the code, and it is **not enforced on the loan posting path** (the balance guard protects only
  the manual journal-entry API), so it can genuinely break. It spans the loan domain to the
  accounting domain: the edit lands on one leg, the balance is only visible summing all legs.
- **Oracle (trusted grader):** a JUnit/Mockito test that accumulates every debit and credit the
  processor emits and asserts they balance per transaction, over a battery of transaction types.
  Baseline: all 12 fixtures balance on the unedited code (clean baseline, no latent bug), and a
  negative control confirmed it catches a 1.00 imbalance.
- **Blind editors (the measurement):** eight fresh agents, each in its own git worktree of the
  Fineract repo placed in scratch, each handed one realistic feature ticket and nothing else.
  The worktree contains only Fineract source; the oracle and all findings live in a different
  repo and are absent from the agents' filesystems. No agent saw the invariant, the oracle, the
  answers, or another agent. Tickets named features (new fee bucket, interest rounding, zero-leg
  suppression, partial refund, merchant refund, charge-off netting, corrected transfer, deferred-
  fee amortisation); none mentioned balance or double-entry.
- **Grading:** for each edited worktree, inject the hidden oracle, run it alongside the shipped
  processor tests, classify. The category that matters is **SILENT_BREAK**: compiles, shipped
  tests pass, oracle fails — an edit a developer would ship green that corrupts the ledger.

## Result

    edit  ticket                     verdict        oracle exercised the edited path?
    t1    new service-fee bucket      clean          no (new path gated on an unpopulated field)
    t3    round interest leg          SILENT_BREAK   YES
    t4    suppress zero-amount legs   clean          YES (symmetric on the shared terminals)
    t5    partial overpayment refund  clean          refund path balances (partial branch may not fire)
    t7    merchant refund             clean (no-op)  agent found it already handled; made no change
    t8    charge-off netting          clean          YES (netted both sides)
    t9    corrected-transfer sides    clean          no (reversed branch not driven by fixtures)
    t10   amortise deferred fee       clean          no (accruals path not in the battery)

One genuine silent break out of eight edits; **one out of the roughly four the oracle could
actually exercise**. Not saturated.

## The break, precisely

t3's ticket: "round the interest recorded for a repayment to 2 dp, half-even." The agent added a
`roundRepaymentInterest` helper and applied the rounded value to the interest legs. It
self-reported success: *"rounding once at the top of each interest block keeps the debit and
credit sides consistent, so the entry still balances."* It does not. The single fund-source debit
for the repayment is accumulated from the **unrounded** principal-plus-interest-plus-fees total,
while the interest **credit** leg now posts the **rounded** interest. Debits and credits diverge
by the interest rounding delta. The oracle fails on exactly `cashRepaymentAllLegsBalances` and
`accrualRepaymentAllLegsBalances`, and nothing else. The shipped processor tests pass (they check
which accounts are hit, not that the transaction balances). This is the "round one side" trap the
scout predicted for this ticket — and a competent, careful agent fell into it while believing it
had not.

Three things had to line up, and all did: the edit compiled, it passed the existing suite, and
the agent was confident. The only thing that caught it was the deterministic check of an external
law the code does not self-enforce.

## Why this one is not circular

This is the invariant with independent authority the earlier reframe demanded. The oracle does
not check the code against a spec distilled from the code; it checks it against double-entry, a
law that exists outside Fineract. So catching the break is not the model grading its own work.
The model's judgement said "balances"; an external law said otherwise and was right. That is the
non-circular verification value, demonstrated finding a real break.

## Honest reading

- The model is mostly right. Seven of eight edits preserved the invariant or correctly declined,
  including the charge-off dual-accumulator trap, which the agent netted on both sides. The value
  is not that the model is incompetent; it is that its residual error rate on an unenforced law is
  high enough to matter (one in four exercised edits here) and it **cannot self-detect it** — the
  breaking agent reported success. That is precisely the case for a standing deterministic gate.
- The rate is soft. Four of eight edits could not be validly graded because the oracle's battery
  does not drive their paths (new fields, reversed branches, accruals amortisation). Extending the
  battery to those paths would firm up the number; it would not change the existence result, which
  is what matters: a real silent break exists and was caught.
- Scope: the oracle grades the processor's emitted debit/credit arithmetic (persistence mocked),
  which is where the edits land and where the invariant lives.
- This is also, separately, a real gap in Fineract: there is no runtime double-entry guard on the
  loan posting path, so a change shaped like t3 could reach production. The manual-JE API has the
  guard; the loan path does not.

## What it settles for the programme

Every prior experiment saturated because it measured the model reproducing or checking behaviour
it already knew. This one measured a blind local edit against an external law across a module
boundary, and verification caught a confident, test-passing, ledger-corrupting change. The value
of the deterministic gate is real, it is non-circular, and it lives exactly where the reframe said
it would: an invariant with authority independent of the code, checked on a change the editor
could not see the far end of. Not proven at production scale, but no longer hypothetical.
