# tessl — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 7 · Captured: 9/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ No questions asked yet; start with the highest-impact gap — the amortisation method — since it determines the core per-instalment computation.

Q: How should instalments be structured: a fixed total payment each period (amortising/annuity, so principal and interest vary but the instalment is constant), equal principal each period with declining interest, or interest-only with a final balloon? Please pick the one your institution uses.
A: Equal principal each period: a constant principal portion (P/n) every period, with interest charged on the reducing balance, so the total instalment decreases over the term. Not a fixed/annuity instalment, not interest-only with a balloon.

### Round 2
_Step reasoning:_ Instalment structure is settled; the periodic interest convention is the next highest-impact policy decision as it affects every interest figure and the handling of the disbursement-to-first-instalment period.

Q: How is each period's interest computed on the reducing balance: a flat monthly rate equal to the annual nominal rate divided by 12 applied to the opening balance (every period treated as equal), or an actual-days day-count method (e.g. actual/365) that accounts for the real number of days between instalment dates and for any irregular first period from the disbursement date?
A: A flat periodic rate using 30/360: every month is treated as 30 days, the year as 360, so the monthly rate is the annual nominal rate divided by 12, applied to the opening balance once per period. Not actual/365; not daily accrual.

### Round 3
_Step reasoning:_ Structure and interest accrual are settled; rounding precision and residual reconciliation are the next material, non-inferable policy decisions needed to compute a correct, balance-zeroing schedule.

Q: How should monetary amounts be rounded, and where does any residual go? Specifically: (a) to what precision are the per-period principal and interest rounded (e.g. 2 decimal places / minor currency units)? (b) since principal per period is P/n and may not divide evenly, how is the rounding remainder reconciled so the balance reaches exactly zero, e.g. adjust the final instalment's principal to absorb the residual, or distribute the residue across early instalments? (c) is interest rounded per period before it affects anything, and does it affect the running balance at all (given equal-principal, interest is usually a separate charge that doesn't change the principal balance)?
A: (a) Instalments are rounded to the whole shilling — no cents. The currency is KES and general amounts are expressed to 2 decimal places, but each period's total instalment figure is rounded to a whole number of shillings. (b) The accumulated rounding difference across all periods is absorbed in the final instalment, which is adjusted so that the closing principal balance is exactly zero — residual is not distributed across early periods. (c) Yes: interest is computed and rounded first each period; principal is then the remainder when that rounded interest is subtracted from the (rounded) instalment. Because this is an equal-principal structure, interest is a separate period charge and does not alter the principal balance — only the principal portion reduces the outstanding balance each period.

### Round 4
_Step reasoning:_ The disbursement date is an explicit input but we have not established how it drives the instalment due-date schedule or month-end edge cases, which cannot be reliably inferred.

Q: How are instalment due dates derived from the disbursement date? Specifically: (a) is the first instalment due exactly one month after disbursement, or on a fixed cycle day (e.g. always the 1st)? (b) are subsequent instalments spaced one calendar month apart? (c) how are month-end edge cases handled when the disbursement day has no counterpart in a later month (e.g. disbursed on the 31st, or the 29th-31st mapping into February) — roll to the last day of the month, roll forward, or fix to a cycle day?
A: The first instalment is due exactly one month after the disbursement date — not on a fixed cycle day.

### Round 5
_Step reasoning:_ Round 4 only resolved sub-part (a); monthly spacing and month-end date rollover are still unspecified and materially affect due dates, so I must clarify before finishing.

Q: You confirmed the first instalment falls exactly one month after disbursement, but two parts of that question are still open. (a) Are all subsequent instalments spaced exactly one calendar month apart from that first due date? (b) How do you handle month-end cases where the due day doesn't exist in a later month, for example disbursement on the 31st (so the 31st doesn't exist in 30-day months) or on the 29th-31st mapping into February: do you roll back to the last day of that month, roll forward into the next month, or anchor to some fixed cycle day?
A: Yes, all subsequent instalments fall exactly one calendar month after the preceding due date.

### Round 6
_Step reasoning:_ The month-end edge case for due dates (part b of round 5) was asked but not answered, and it's a material policy decision that can't be inferred.

Q: Part (b) of my previous question is still open: how do you handle month-end cases where the due day doesn't exist in a later month? For example, a loan disbursed on the 31st (so the due day is the 31st, which doesn't exist in 30-day months or February), or disbursed on the 29th/30th mapping into February. Do you roll back to the last day of that shorter month, roll forward into the first day of the next month, or anchor to some fixed cycle day?
A: [default, not policy] Roll back to the last day of the shorter month.

### Round 7
_Step reasoning:_ The four main policy areas (structure, day-count, due dates, residual handling) are settled, but the rounding direction for the per-period whole-shilling rounding remains genuinely ambiguous and materially affects every row, so I ask it before summarising.

Q: One rounding detail is still open. When each period's interest and the total instalment are rounded to a whole shilling, which rounding rule applies: round half up (0.5 and above goes up), round half to even (banker's rounding), or truncate toward zero (drop the fraction entirely)? This affects the figures in every period and can't be inferred from the precision alone.
A: [default, not policy] Round half up (0.5 and above rounds up to the next whole shilling).

### Round 8 (process signalled done)
_Step reasoning:_ All material policy axes are resolved — amortisation method, interest basis (30/360 flat), rounding precision and residual reconciliation, rounding direction, and due-date derivation including month-end handling — and the last two answers were flagged as defaults rather than institutional policy, signalling the genuine policy questions are exhausted; proceeding would mean inventing questions.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Overview

The engine produces the full repayment schedule for a disbursed loan. The public interface is a single function, `generate_schedule(loan)`, which accepts a disbursed loan and returns the complete schedule: for every instalment, the interest due, the principal due, and the running (outstanding principal) balance.

The loan input carries four fields:
- `principal` — the disbursed amount (P).
- annual nominal interest rate — the quoted yearly rate.
- `term` — the number of monthly instalments (n).
- disbursement date.

Currency is Kenyan shillings (KES).

## 2. Scope

### In scope
- Computing the interest portion, principal portion, and running balance for each of the n instalments.
- Deriving each instalment's due date from the disbursement date.
- Rounding every period's figures and reconciling the residual so the loan closes at exactly zero.

### Out of scope
- Any instalment structure other than equal-principal (annuity/fixed-instalment and interest-only/balloon are explicitly excluded).
- Fees, penalties, early repayment, restructuring, or arrears handling.
- Any day-count method other than 30/360 (actual/365 and daily accrual are excluded).

## 3. Instalment structure — equal principal

The schedule uses an **equal-principal** structure, not a fixed/annuity instalment and not interest-only with a balloon.

- The principal portion is constant at P/n every period.
- Interest is charged on the reducing (opening) balance each period.
- Because the balance declines while the principal portion stays constant, the **total instalment decreases over the term**.

Interest is a separate period charge: it does not alter the principal balance. Only the principal portion reduces the outstanding balance each period.

## 4. Interest computation — flat periodic rate, 30/360

Interest for each period is computed with a flat periodic rate on a 30/360 day-count basis:

- Every month is treated as 30 days and the year as 360 days.
- The monthly rate is therefore the annual nominal rate divided by 12.
- Interest for a period = opening balance for that period × monthly rate, applied **once per period**.

There is no daily accrual, no actual-days day-count, and no irregular first period: the first period is treated identically to every other period regardless of the calendar gap between disbursement and the first due date.

## 5. Rounding and residual reconciliation

### Precision
- General amounts are expressed in KES to 2 decimal places, but **each period's figures are rounded to the whole shilling** (no cents).

### Per-period order of operations
For each period:
1. Compute the period interest (opening balance × monthly rate) and **round it to the whole shilling first**.
2. Determine the period's total instalment (principal portion P/n plus interest) and round it to the whole shilling.
3. The **principal portion is the remainder**: rounded total instalment minus rounded interest.
4. Reduce the running balance by the principal portion only. The rounded interest does not change the balance.

### Rounding rule
All rounding to the whole shilling uses **round half up**: a fractional part of 0.5 or more rounds up to the next whole shilling; below 0.5 rounds down.

### Residual reconciliation
Because P/n may not divide evenly and per-period figures are rounded, a cumulative rounding difference will generally build up. The **entire accumulated rounding difference is absorbed in the final instalment**. The final instalment's principal is adjusted so that the **closing principal balance is exactly zero**. The residual is not distributed across early instalments.

## 6. Due dates

- The **first instalment is due exactly one calendar month after the disbursement date** (not on a fixed cycle day such as the 1st).
- Every subsequent instalment is due **exactly one calendar month after the preceding instalment's due date**.
- **Month-end handling:** where the due day does not exist in a later month (for example a due day of the 31st falling in a 30-day month, or the 29th/30th/31st mapping into February), the due date **rolls back to the last day of that shorter month**. It does not roll forward into the next month and is not anchored to a fixed cycle day.

## 7. Output

`generate_schedule(loan)` returns the schedule as an ordered collection of n instalments. Each instalment entry includes:
- the instalment number,
- the due date,
- the interest due for the period (whole shillings),
- the principal due for the period (whole shillings),
- the running outstanding principal balance after the instalment.

The balance after the final instalment is exactly zero.

## 8. Edge cases and boundary conditions

- **Uneven division of P by n:** handled by the residual rule in section 5 — the final instalment absorbs the accumulated difference and drives the balance to exactly zero.
- **Rounding of interest vs instalment:** interest is rounded before the principal portion is derived; principal is always the difference between the two rounded figures, keeping each period internally consistent.
- **Non-existent due day in a later month:** rolls back to the last day of that month (section 6).
- **First period:** treated as a full 30/360 period regardless of the actual number of days between disbursement and the first due date.

## 9. Constraints

- Day-count: 30/360, monthly rate = annual nominal rate / 12, applied once per period on the opening balance.
- Monetary precision: whole shillings for all per-period figures; KES throughout.
- The schedule must close at exactly zero principal.

## 10. Decisions resolved by process default

Two points were not settled as institutional policy by the stakeholder and were resolved by default during requirement gathering. They are recorded here so they can be revisited if a policy is later established:
- **Month-end roll direction:** roll back to the last day of the shorter month.
- **Rounding rule:** round half up.

All other decisions in this specification were explicitly confirmed by the stakeholder.

## Auditor verdict

_The spec correctly resolves 9 of 14 decisions (1,2,3,4,6,7,8,9,13), including the bespoke method/rounding choices: equal-principal amortisation, 30/360, once-per-period interest, whole-shilling rounding, interest-first remainder ordering, and zero-close reconciliation. It fails five: #5 is addressed but inverted (it explicitly refuses stub/partial-period interest and treats the first period as full, the opposite of accrual-from-disbursement); #10 (Rule-of-78 rebate) and #11 (term-fixed re-amortised prepayment) are pushed out of scope and unaddressed; #12 (reject zero/negative principal or term) is absent; #14 is only half-met, delivering the schedule but omitting the total cost of credit and the actual/365 APR disclosure (indeed excluding actual/365 entirely). Coverage = 9/14. The misses concentrate on the off-default, non-inferable decisions, as the reference design intended._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3 "Interest is charged on the reducing (opening) balance each period"; §4 "Interest for a period = opening balance for that period × monthly rate" | Spec charges interest on the reducing/opening balance, which is declining-balance interest. Matches the reference. |
| 2 | yes | **yes** | §3 "The schedule uses an equal-principal structure... The principal portion is constant at P/n every period... the total instalment decreases over the term." | Explicitly equal-principal with constant P/n and a decreasing instalment, and explicitly rules out annuity/EMI. Exact match. |
| 3 | yes | **yes** | §4 "on a 30/360 day-count basis - Every month is treated as 30 days and the year as 360 days." | States 30/360 and excludes actual/365. Exact match. |
| 4 | yes | **yes** | §4 "applied once per period"; "There is no daily accrual, no actual-days day-count" | Interest computed once per monthly period, daily accrual explicitly excluded. Matches same-as-repayment-period. |
| 5 | yes | no | §4 "no irregular first period: the first period is treated identically to every other period regardless of the calendar gap"; §8 "First period: treated as a full 30/360 period regardless of the actual number of days between disbursement and the first due date." | The reference requires interest to accrue from the disbursement date with a stub charge for extra days; the spec does the exact opposite, treating the first period as a full period and charging no stub. Addressed but contradicts the reference. |
| 6 | yes | **yes** | §1 "Currency is Kenyan shillings (KES)"; §5 "General amounts are expressed in KES to 2 decimal places" | KES and 2 decimal places both stated. Exact match. |
| 7 | yes | **yes** | §5 "each period's figures are rounded to the whole shilling (no cents)"; "The entire accumulated rounding difference is absorbed in the final instalment." | Whole-shilling instalments with the accumulated residual settled in the final instalment. Exact match. |
| 8 | yes | **yes** | §5 "Compute the period interest... and round it to the whole shilling first... The principal portion is the remainder: rounded total instalment minus rounded interest." | Interest is computed and rounded first and principal is the remainder of the rounded instalment. Exact match. |
| 9 | yes | **yes** | §5 "The final instalment's principal is adjusted so that the closing principal balance is exactly zero."; §7 "The balance after the final instalment is exactly zero." | Final instalment reconciles the closing balance to exactly zero. Exact match. |
| 10 | no | no | §2 Out of scope: "Fees, penalties, early repayment, restructuring, or arrears handling." | Early full settlement and any rebate method are explicitly out of scope; the Rule-of-78 rebate is never addressed. |
| 11 | no | no | §2 Out of scope: "early repayment, restructuring" | Partial prepayment handling and the term-fixed re-amortisation strategy are not addressed; explicitly excluded from scope. |
| 12 | no | no | absent | The spec's edge-case section (§8) covers uneven division and due-date rollover but says nothing about rejecting zero/negative principal or zero term. |
| 13 | yes | **yes** | §6 "The first instalment is due exactly one calendar month after the disbursement date"; "Every subsequent instalment is due exactly one calendar month after the preceding instalment's due date." | First due date is disbursement + one month with monthly instalments thereafter. Exact match. |
| 14 | yes | no | §7 lists instalment number, due date, interest, principal, running balance; no total cost of credit and no APR disclosure. "Any day-count method other than 30/360 (actual/365... excluded)" (§2) | The per-period schedule is addressed, but the two non-inferable disclosure elements, the total cost of credit (sum of interest) and the APR computed on an actual/365 basis, are absent, and actual/365 is in fact excluded. The material disclosure quirk is not met. |
