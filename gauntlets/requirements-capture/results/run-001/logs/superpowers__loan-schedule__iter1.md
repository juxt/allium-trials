# superpowers — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 9 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ This is architectural (a new engine) and every material policy is omitted and non-inferable, so I follow brainstorming's discovery step and ask the stakeholder the questions that determine correctness before proposing any design.

Q: Before I design this, one purpose question: is this schedule the contractual, customer-facing amortisation table (the exact figures the borrower is billed and holds us to), or an internal projection for forecasting? That tells me how strict rounding and reconciliation need to be.
A: Contractual and customer-facing. These are the exact figures the borrower is billed and can hold us to, so rounding and reconciliation must be strict and deterministic.

Q: How should each instalment be shaped: equal total payments (annuity/EMI style, where principal rises as interest falls), or equal principal each period (so the total payment declines over the term)?
A: Equal principal each period: a constant principal portion (P/n) per instalment, with interest charged on the reducing balance. The total payment therefore decreases over the term. This is not an annuity/EMI structure.

Q: How is the periodic interest rate derived from the annual nominal rate: simple division by 12 (nominal/12 per month), or an effective monthly rate compounded from the annual figure?
A: Simple division by 12: the nominal annual rate divided by 12 gives the monthly periodic rate. No compounding transformation to an effective monthly rate.

Q: Does interest accrue on a flat per-period basis (each month treated as one equal period regardless of dates), or on a day-count basis tied to the actual days between instalment dates (e.g. actual/365, 30/360)? This is why the disbursement date matters.
A: Flat per-period basis using a 30/360 day-count convention: every month is treated as 30 days and the year as 360 days. Interest is computed once per monthly period, not via daily accrual. The disbursement date matters because a stub period may arise if disbursement precedes the first period start, not because of actual-day counting within regular periods.

Q: What are the rounding rules: to what unit (e.g. the minor currency unit / cent) do interest and principal round each period, and where does the residual land so the balance closes exactly at zero (typically absorbed into the final instalment)?
A: Currency is KES. Each instalment is rounded to the whole shilling (no cents). Within each period, interest is computed and rounded first; principal is then the remainder of the rounded instalment. The accumulated rounding difference across all periods is absorbed into the final instalment so the closing balance is exactly zero.

Q: What is the timing of the first instalment relative to the disbursement date (e.g. exactly one month later), and is there any grace period, first-period stub, or interest-only opening period?
A: The first instalment is due one calendar month after the disbursement date; subsequent instalments fall monthly thereafter. There is no grace period or interest-only opening period. If disbursement precedes the first period start, a stub interest charge is levied for those extra days.

### Round 2
_Step reasoning:_ Core structural policies are captured, but the stub period (its trigger, day-count anchor, and how stub interest is billed) remains materially ambiguous and is the stated reason the disbursement date matters.

Q: On the opening stub: what defines the "first period start" that disbursement is compared against (e.g. a fixed monthly billing/cycle date, or exactly the disbursement day-of-month), and how is any stub interest billed: folded into the first instalment's interest line, or charged as a separate upfront item? Also, does the constant P/n principal still begin at instalment 1 while the stub only affects interest?
A: The answer key does not define 'first period start' precisely, so the following are [default, not policy]: the first period start is the disbursement date itself; the first regular period therefore runs from disbursement to disbursement-plus-one-month, meaning a stub arises only when the product is configured around a fixed cycle date (e.g. always the 1st of the month) and disbursement falls mid-cycle. How stub interest is billed is also not specified in policy: the reasonable default is that it is folded into the interest line of the first instalment rather than charged as a separate upfront item. Whether P/n principal begins at instalment 1 during a stub is likewise [default, not policy]: yes, the constant principal portion applies from instalment 1 onward; the stub affects only the interest component of that first instalment, not the principal slice.

### Round 3
_Step reasoning:_ Payment shape, rate, day-count, timing and stub are settled, but the interaction between the constant-P/n structure and the whole-shilling rounding rule is genuinely ambiguous and drives every line of the table, so it needs one focused clarification before the balance basis can be fixed.

Q: A mechanics clarification on the equal-principal rounding, because round 1's rule ('interest rounded first, principal is the remainder of the rounded instalment') sits awkwardly with a constant P/n principal: for each regular period, is the principal portion the fixed P/n rounded to the whole shilling (so every principal line is identical bar the final true-up, and the total instalment = that rounded principal + rounded interest), or is a total instalment figure the thing that gets rounded, with principal falling out as remainder after interest? And relatedly, does each period's interest accrue on the exact reducing balance (P minus cumulative exact P/n) or on the rounded running balance carried forward?
A: The total instalment figure is what gets rounded to the whole shilling. Interest is computed on the opening balance and rounded first; the principal for that period is then the remainder — rounded instalment minus rounded interest. The nominal equal-principal slice (P/n) determines the shape of the instalment before rounding, but the actual principal credited each period is the remainder after interest, so individual principal lines may differ from the ideal P/n by a shilling. The final instalment absorbs the accumulated difference so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Rounding is specified to the shilling with interest-first/principal-remainder, but the tie-breaking direction is still undefined and materially affects the exact contractual figures, so I ask it before finalising.

Q: One rounding-mode point, since the figures must be strict and deterministic: when interest (and the resulting whole-shilling instalment) is rounded to the whole shilling, which tie-breaking rule applies — round half up, round half to even (banker's rounding), or truncate toward zero? This changes the exact billed figures whenever a computed amount lands on or near the half-shilling.
A: Round half up (0.5 rounds to 1). This is the conventional rounding rule for consumer-facing financial schedules in this market and produces the most predictable, customer-legible figures. Banker's rounding and truncation are not used. [default, not policy — the answer key does not specify a tie-breaking rule]

### Round 5 (process signalled done)
_Step reasoning:_ All material policy decisions (contractual intent, equal-principal shape, nominal/12 rate, 30/360 day-count with stub, whole-shilling rounding with interest-first and final true-up, round-half-up tie-break) are captured; the last several probes returned 'default, not policy', indicating the policy space is exhausted.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## Purpose and status

This specification defines `generate_schedule(loan)`, the repayment schedule engine for the loan product. The schedule it produces is **contractual and customer-facing**: the figures are the exact amounts the borrower is billed and can hold the institution to. Every rule below is therefore mandatory, and the computation must be strict, deterministic and reproducible. Two runs against the same loan must yield byte-identical schedules.

Inputs and the interface are fixed by the brief; all policy below was settled with the stakeholder. Items the stakeholder did not settle are marked **[default, not policy]** and resolved here so the engine is fully specified; they are the engine's chosen behaviour, not institutional policy, and may be revised if policy is later stated.

## Interface

`generate_schedule(loan)` takes a disbursed loan and returns the full repayment schedule.

The input `loan` carries:
- `principal` — the disbursed principal amount, in KES.
- annual nominal interest rate — an annual nominal rate (not an effective rate).
- term — the number of monthly instalments, `n`.
- disbursement date — the date the loan was disbursed.

The returned schedule is an ordered sequence of `n` instalments. Each instalment row reports, at minimum:
- the instalment number and its due date,
- the interest due for the period,
- the principal due for the period,
- the total instalment amount (interest + principal),
- the running (closing) balance after the instalment is applied.

All monetary figures in the output are whole KES shillings (see rounding).

## Instalment structure — equal principal

The schedule uses an **equal-principal** structure, not an annuity/EMI structure.

- The nominal principal slice per period is `P/n` (principal divided by the number of instalments). This is a constant amount and determines the intended shape of the schedule before rounding.
- Interest each period is charged on the reducing balance, so the interest line falls over the term.
- Because principal is (nominally) constant and interest declines, the **total instalment decreases over the term**.

## Interest rate derivation

The monthly periodic rate is the **annual nominal rate divided by 12** (`monthly_rate = nominal_annual_rate / 12`). There is no compounding transformation: no effective monthly rate is derived from the annual figure.

## Interest accrual basis — flat per period, 30/360

Interest accrues on a **flat per-period basis** using a **30/360 day-count convention**: every month is treated as 30 days and the year as 360 days. Interest is computed once per monthly period on the period's opening balance, not by daily accrual within the period. A regular monthly period therefore charges `opening_balance × (nominal_annual_rate / 12)` before rounding.

The disbursement date matters only because it can produce an opening stub period (see below); it does not cause actual-day counting within regular periods.

## Instalment dates

- The first instalment is due **one calendar month after the disbursement date**.
- Subsequent instalments fall **monthly thereafter** (each one calendar month after the previous).
- There is **no grace period and no interest-only opening period**. Principal repayment begins at instalment 1.

## Opening stub period

If disbursement precedes the start of the first regular period, a **stub interest charge** is levied for those extra days, computed on the 30/360 basis and folded into the interest line of the first instalment.

The following details were not fixed by policy and are resolved here:

- **[default, not policy]** The **first period start is the disbursement date itself**. The first regular period runs from disbursement to disbursement-plus-one-month. Consequently a stub arises only when the product is configured around a fixed cycle date (for example, always the 1st of the month) and disbursement falls mid-cycle. In the base configuration described by the brief (first instalment exactly one month after disbursement), no stub arises.
- **[default, not policy]** When a stub does arise, its interest is **folded into the first instalment's interest line**, not charged as a separate upfront item.
- **[default, not policy]** The **constant `P/n` principal slice begins at instalment 1** even when a stub is present. A stub affects only the interest component of the first instalment, never its principal slice.

## Rounding and reconciliation

Currency is **KES**. All billed figures are rounded to the **whole shilling — no cents**.

Rounding mechanics, per period:

1. Interest is computed on the period's **opening balance** and **rounded first** to the whole shilling.
2. The **total instalment figure is the amount that gets rounded** to the whole shilling. The nominal `P/n` slice plus the period interest sets the instalment's shape before rounding.
3. The **principal credited for the period is the remainder**: `principal = rounded_instalment − rounded_interest`.

Because principal is the remainder after rounded interest, an individual period's principal line may differ from the ideal `P/n` by a shilling. The running balance is reduced by the credited (remainder) principal each period.

**Tie-breaking rule — round half up** (0.5 rounds to 1). Banker's rounding (round half to even) and truncation toward zero are **not** used. **[default, not policy — the stakeholder did not specify a tie-breaking rule; round-half-up is adopted as the conventional, most customer-legible rule for consumer-facing schedules in this market.]**

**Final-instalment true-up.** The accumulated rounding difference across all periods is **absorbed into the final instalment** so that the **closing balance is exactly zero**. The final instalment's principal is whatever amount clears the outstanding balance to zero (its interest line is still the period interest computed and rounded as above); its total may therefore differ from the ideal-shape figure by the accumulated residual.

## Invariants the engine must guarantee

- The schedule contains exactly `n` instalments.
- After the final instalment, the running balance is **exactly zero**.
- The sum of all principal lines equals the disbursed principal `P` exactly.
- Each row's total equals its interest plus its principal, and all figures are whole shillings.
- The output is fully deterministic: identical inputs produce identical schedules.

## Explicitly out of scope

Fees, penalties, early repayment, missed-payment handling, variable rates, and any accrual behaviour beyond the single per-period 30/360 interest charge are not part of this engine. No such behaviour was specified and none is inferred.

## Auditor verdict

_Coverage 9/14. The spec captures the core mechanics precisely — equal-principal amortisation (#2), 30/360 (#3), once-per-period interest on the reducing balance (#1, #4), the disbursement stub (#5), whole-shilling instalment rounding with final true-up (#7), interest-first/principal-remainder order (#8), zero closing balance (#9), and first due date at disbursement + one month (#13). Gaps concentrate on bespoke and edge decisions: the Rule-of-78 rebate (#10) and term-fixed re-amortisation on partial prepayment (#11) are declared out of scope; input validation for zero/negative principal or term (#12) is absent; currency precision diverges (#6: whole shilling rather than 2dp); and the total cost of credit plus the actual/365 APR disclosure quirk (#14) are omitted._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest each period is charged on the reducing balance, so the interest line falls over the term." and "Interest is computed once per monthly period on the period's opening balance." | Interest on the reducing/opening balance is the declining-balance method. The section title's phrase "flat per period" refers to no daily accrual within a period, not a flat-rate-on-original-principal method, so this matches the reference. |
| 2 | yes | **yes** | "The schedule uses an equal-principal structure, not an annuity/EMI structure... The nominal principal slice per period is P/n... the total instalment decreases over the term." | Equal principal (P/n), interest on reducing balance, total instalment declining, explicitly not EMI — an exact match to the reference. |
| 3 | yes | **yes** | "a 30/360 day-count convention: every month is treated as 30 days and the year as 360 days." | States 30/360 with the exact 30-days/360-year definition, matching the reference and rejecting actual/365. |
| 4 | yes | **yes** | "Interest is computed once per monthly period on the period's opening balance, not by daily accrual within the period." | Interest computed once per monthly (repayment) period rather than daily accrual matches the reference's same-as-repayment-period basis. |
| 5 | yes | **yes** | "If disbursement precedes the start of the first regular period, a stub interest charge is levied for those extra days, computed on the 30/360 basis and folded into the interest line of the first instalment." | Interest effectively accrues from disbursement and a partial-period stub charge is levied and charged for the extra days when disbursement precedes the first period start, matching the reference's stub rule. |
| 6 | yes | no | "Currency is KES. All billed figures are rounded to the whole shilling — no cents." and "All monetary figures in the output are whole KES shillings." | Currency (KES) is correct, but the reference precision is 2 decimal places; the spec states whole-shilling/no-cents throughout and never adopts 2dp precision, so the precision half of the decision does not match. |
| 7 | yes | **yes** | "All billed figures are rounded to the whole shilling — no cents." and "Final-instalment true-up. The accumulated rounding difference across all periods is absorbed into the final instalment." | Instalments rounded to whole shilling with the accumulated rounding residual settled in the final instalment matches the reference exactly. |
| 8 | yes | **yes** | "Interest is computed on the period's opening balance and rounded first... The principal credited for the period is the remainder: principal = rounded_instalment − rounded_interest." | Interest computed and rounded first, principal taken as the remainder of the rounded instalment, matching the reference's rounding order. |
| 9 | yes | **yes** | "the closing balance is exactly zero" and "After the final instalment, the running balance is exactly zero." | The final instalment reconciles the schedule to an exactly-zero closing balance, matching the reference. |
| 10 | no | no | "Explicitly out of scope... early repayment... are not part of this engine." | Early full settlement, and hence any unearned-interest rebate method, is explicitly excluded; the Rule of 78 is never addressed. |
| 11 | no | no | "Explicitly out of scope... early repayment... are not part of this engine." | Partial prepayment (extra payment with the loan continuing) is a form of early repayment, which the spec declares out of scope; the principal-then-re-amortise-keeping-term rule is never stated. |
| 12 | no | no | absent | The spec assumes a valid disbursed loan and specifies no validation or rejection of zero/negative principal or term anywhere, including its out-of-scope list. |
| 13 | yes | **yes** | "The first instalment is due one calendar month after the disbursement date. Subsequent instalments fall monthly thereafter." | First due date at disbursement plus one month with monthly instalments thereafter matches the reference. |
| 14 | yes | no | Row fields: "the interest due for the period, the principal due for the period, the total instalment amount... the running (closing) balance"; total cost of credit and APR are absent. | The per-period schedule shape is largely addressed, but the reference also requires the total cost of credit and a disclosed APR computed on an actual/365 basis; neither is mentioned, so the decision is not correctly resolved. |
