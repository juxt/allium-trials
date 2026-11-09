# prose — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 11 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits amortisation method, interest day-count convention, rounding policy, first-payment timing/stub handling, and final-instalment reconciliation; these are institution-specific choices that cannot be reliably inferred, so I ask before specifying.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/EMI, where each payment is the same and the principal/interest split shifts over time), equal principal per instalment (straight-line, declining total payment), or interest-only with a final balloon?
A: Equal principal (straight-line / declining payment): a constant principal portion P/n is applied each period, interest accrues on the reducing balance, and the total instalment decreases over the term. Equal-instalment (annuity/EMI) and interest-only balloon are both rejected.

Q: How is per-period interest derived from the annual nominal rate and what day-count convention applies: a flat monthly rate of annual/12 applied to the outstanding balance, or a date-sensitive convention (30/360, actual/365, actual/actual) that accrues on actual days between instalments?
A: 30/360 day-count: every month is treated as 30 days, the year as 360, so the per-period rate is the annual nominal rate divided by 12, applied once per monthly period to the outstanding balance. Daily accrual and actual/365 or actual/actual conventions do not apply.

Q: What are the rounding rules: to what precision is each instalment's interest and principal rounded (e.g. whole cents), what rounding mode (half-up, half-even, truncate), and how is any accumulated rounding residual reconciled on the final instalment so the balance closes exactly to zero?
A: Amounts are in KES to 2 decimal places, but each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The rounding mode is half-up [default, not policy]. Accumulated rounding differences across all periods are absorbed in the final instalment so the schedule closes exactly.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month later), are subsequent instalments on the same day-of-month, and if disbursement-to-first-payment is not a whole period, is a partial/stub interest amount accrued for that initial odd period?
A: The first instalment is due disbursement date plus one month; subsequent instalments fall on the same day-of-month thereafter. If disbursement precedes the first period start by any days, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: For each instalment, what defines the running balance (closing balance after the principal portion is applied), and should the final instalment's principal be adjusted to absorb any residual so the closing balance is exactly zero?
A: The closing balance each period is the opening balance minus the principal portion applied that period. The final instalment's principal is adjusted to absorb any residual so the closing balance is exactly zero.

### Round 2
_Step reasoning:_ The core five policies are settled, but the stub interest mechanics (day-count basis, how it is collected) and month-end day-of-month rollover remain genuinely ambiguous and cannot be reliably inferred.

Q: For the initial stub period (disbursement to first period start), how is the stub interest computed and collected: what day-count basis applies to those odd days (actual days × annual/360, actual/365, or annual/12 pro-rated over 30), and is the stub charged as part of the first instalment, added to principal, or billed separately?
A: Stub interest is computed on the actual number of odd days using the 30/360 annual basis, i.e. stub_interest = outstanding_principal × annual_rate × actual_stub_days / 360. It is charged as an addition to the first instalment (the first instalment = normal period interest + stub interest + constant principal portion P/n); it is not capitalised into principal and not billed as a separate transaction [collection mechanism: default, not policy].

Q: Does the stub interest affect the principal amortisation schedule at all (i.e. is the constant principal portion still P/n unchanged, with the stub purely an interest add-on), and is any day-of-month edge case handled when disbursement falls on the 29th-31st (how the 'same day-of-month' rule resolves for short months)?
A: The constant principal portion P/n is unchanged — stub interest is a pure add-on and does not alter the amortisation schedule. For day-of-month edge cases when disbursement falls on the 29th–31st, the 'same day-of-month' rule resolves by taking the last calendar day of any month that is too short (e.g. disbursement on 31 Jan → first due 28 Feb, then 31 Mar, etc.) [default, not policy].

### Round 3
_Step reasoning:_ Two genuine, non-inferable policy gaps remain: how the whole-shilling rounding composes for the first instalment's combined normal+stub interest, and whether the final-instalment residual absorption is bounded (plus the zero-rate edge); I won't invent these answers.

Q: For the first instalment specifically, how do the rounding rules compose now that it carries two interest components: is the first instalment's interest taken as (normal period interest + stub interest) summed and then rounded once to the whole shilling (half-up), with principal as the remainder of that rounded instalment, or are the normal interest and the stub interest each rounded separately before being combined? And is the constant principal portion for the first instalment still exactly P/n before the whole-shilling rounding is applied?
A: Sum the two interest components first, then round the combined total to the whole shilling (half-up) once; do not round each component separately. The principal portion of the first instalment is then the remainder of that single rounded instalment total. The constant principal portion going into that calculation is exactly P/n, unchanged by the stub — rounding is applied only after all components are assembled into the instalment.

Q: For the final-instalment residual absorption, is there any guard or cap on the adjustment: could the residual legitimately make the final instalment's principal exceed its opening balance or go negative (e.g. if accumulated rounding pushed the balance the 'wrong' way), and if so, is that simply accepted so the closing balance is exactly zero, or should the engine constrain/validate it? And when the annual nominal rate is zero, is the expected behaviour simply zero interest every period (including zero stub) with instalments equal to the P/n principal portion?
A: No explicit guard or cap is specified: whatever adjustment is needed to bring the closing balance to exactly zero is accepted, even if the residual is theoretically large enough to push the final principal outside the range one might expect. In practice, accumulated half-up rounding on whole-shilling amounts over a standard term will never produce a residual large enough to make the final principal negative or exceed the opening balance, so this is accepted without constraint [default, not policy]. When the annual nominal rate is zero, the expected behaviour is zero interest every period — including zero stub interest — and each instalment equals exactly P/n (subject to the final-instalment residual rule). [zero-rate behaviour: default, not policy]

### Round 4
_Step reasoning:_ Two prior answers conflict: 'first instalment = disbursement + 1 month' leaves no odd days for the stub to ever charge, so the stub's trigger condition and cycle anchoring must be pinned down before the schedule is computable.

Q: There's a tension between two earlier answers I need to resolve to make the stub computable. If the first instalment is always 'disbursement date + one month' (same day-of-month thereafter), then the first period starts on the disbursement date itself and there are never any 'odd days' preceding it, so the stub charge would never actually trigger. For the stub to arise, the billing cycle must be anchored to something other than the disbursement date. Which is it: (a) instalments are anchored to a fixed cycle date (e.g. the 1st of each month, or a fixed statement day), the first due date is the first such anchor at least one month after disbursement, and the stub covers the actual days from disbursement to the start of that first full period; or (b) the first due date really is disbursement + one month with no anchoring, in which case under what concrete circumstance do the 'odd days' and stub interest ever occur?
A: (a): instalments are anchored to a fixed billing-cycle date. The first due date is the first occurrence of that cycle date that falls at least one full month after disbursement; the stub covers the actual days from disbursement to the start of that first full period. Under (b) — pure disbursement-plus-one-month with no anchor — the stub mechanism can never trigger, which contradicts item 5 of the spec. The stub exists precisely because disbursement does not in general coincide with the cycle anchor, so (a) is the correct reading. The earlier 'disbursement + one month' shorthand was an imprecision; treat (a) as the authoritative rule.

### Round 5
_Step reasoning:_ Round 4's resolution to a fixed-cycle anchor introduces one remaining material, uninferrable gap: the source and definition of the cycle date itself, which the loan input does not provide and without which the first due date and stub cannot be computed.

Q: Round 4 established that instalments anchor to a fixed billing-cycle date rather than to the disbursement date, which is what makes the stub period arise. But the loan input named in the brief (principal, annual nominal rate, term in months, disbursement date) carries no such anchor. What defines the cycle date, and how is the first due date selected? Concretely: (a) is it a fixed product-wide calendar day, e.g. the 1st of each month, applied to every loan; (b) is it a per-loan 'statement day' / 'billing day' field that I should add to the loan object as an additional input; or (c) is it derived some other way? And in all cases, please confirm the exact rule for picking the first due date: 'the first occurrence of the cycle date that falls at least one full calendar month after the disbursement date', with the stub covering the actual days from disbursement up to the start of that first full period.
A: The answer key does not specify this, so the following is a reasonable default marked accordingly. (b) is the right approach: add a per-loan billing_day field (integer 1–28, capped at 28 to avoid end-of-month ambiguity across all months) to the loan input alongside principal, rate, term and disbursement date [default, not policy]. A product-wide fixed day (a) is too inflexible for a lending system that disburses on arbitrary dates. Derivation (c) would require an unstated rule. With billing_day in hand, the first due date is the first calendar date whose day-of-month equals billing_day and which falls at least one full calendar month after the disbursement date — concretely, that means the billing_day occurrence in the month that is at least one full month ahead (if disbursement is 2026-01-15 and billing_day is 10, the first occurrence of the 10th at least one month out is 2026-03-10, not 2026-02-10, because 2026-02-10 is less than one full month after 2026-01-15; if billing_day is 20, the first occurrence is 2026-02-20). The stub covers the actual calendar days from the disbursement date up to but not including the start of that first full period (i.e. up to but not including the first due date, since under the 30/360 convention each period starts on its due date and ends the day before the next).

### Round 6 (process signalled done)
_Step reasoning:_ All five material policy decisions from the brief (amortisation method, day-count, rounding, first-due/stub timing, running balance and final residual) plus their follow-on ambiguities (billing-cycle anchor, billing_day field, first-due-date rule, stub composition, zero-rate and residual-guard behaviour) are now resolved; remaining unknowns are reasonable defaults, so the spec is fully computable and I can write it.

(no questions this round)

## Produced specification

# Repayment Schedule Engine — Requirements Specification

## 1. Purpose and scope

Implement `generate_schedule(loan)`, a function that produces the complete repayment schedule for a disbursed loan. The schedule lists, for every instalment, the interest due, the principal due, the total instalment, and the running (closing) balance, and it must close to a balance of exactly zero on the final instalment.

The amortisation method is **equal principal (straight-line / declining payment)**: a constant principal portion is applied every period, interest accrues on the reducing balance, and the total instalment therefore decreases over the term. Equal-instalment (annuity/EMI) and interest-only-with-balloon methods are explicitly out of scope.

## 2. Input: the loan object

The function receives a single `loan` object with the following fields:

- `principal` — the disbursed amount, a positive monetary value in KES.
- `annual_rate` — the annual nominal interest rate, expressed as a decimal fraction (e.g. 0.18 for 18%). May be zero.
- `term` — the number of monthly instalments, a positive integer `n`.
- `disbursement_date` — the calendar date on which the loan was disbursed.
- `billing_day` — an integer in the range 1–28 giving the fixed day-of-month on which instalments fall due.

### 2.1 The `billing_day` field (note)

The brief named only principal, rate, term and disbursement date. The schedule cannot be computed without an explicit billing anchor, because the stub-interest mechanism (§5) only arises when the billing cycle is anchored to something other than the disbursement date. This specification therefore **adds a per-loan `billing_day` field** to the loan input. It is constrained to 1–28 so that the due day exists in every calendar month and no end-of-month resolution is needed for the anchor itself.

> Provenance: the choice of a per-loan `billing_day` (rather than a product-wide fixed calendar day, or some derived rule) is a reasonable default, not a stakeholder-confirmed policy. It was selected because a fixed product-wide day is too inflexible for a lender disbursing on arbitrary dates, and any derived rule would require an unstated convention.

## 3. Currency, precision and rounding

- All amounts are denominated in KES. Internal computation is carried at 2 decimal places (cents) precision, but **each instalment is rounded to the whole shilling** — no cents appear in the emitted interest, principal or instalment totals.
- **Rounding mode is half-up** (round half away from zero). [Default, not stakeholder policy; chosen as the conventional default.]
- **Order of rounding within a period:** interest is computed and rounded first; the principal portion is then derived as the remainder of the rounded instalment total (see §6 and §7). Interest is never left unrounded when principal is derived from it.

## 4. Billing cycle and due dates

### 4.1 First due date

Instalments are anchored to the fixed billing cycle defined by `billing_day`, **not** to the disbursement date. The first due date is:

> the first calendar date whose day-of-month equals `billing_day` and which falls **at least one full calendar month** after `disbursement_date`.

Concretely, test the `billing_day` occurrence in each successive month starting from the disbursement month; the first such occurrence that is one full calendar month or more after the disbursement date is the first due date.

Worked examples (disbursement 2026-01-15):
- `billing_day = 10` → the 10th that is at least one month out is **2026-03-10** (2026-02-10 is less than one full month after 2026-01-15, so it is skipped).
- `billing_day = 20` → the first occurrence is **2026-02-20** (one full month after 2026-01-15 is 2026-02-15, and 2026-02-20 is on or after that).

### 4.2 Subsequent due dates

After the first due date, each subsequent instalment falls on the same `billing_day` in each following month. Because `billing_day` is capped at 28, every month contains that day and no short-month adjustment is required.

### 4.3 Day-of-month edge handling (general rule)

Where a 'same day-of-month' rule would otherwise land on a day a short month does not have, resolve to the **last calendar day of that month** (e.g. day 31 in February resolves to the 28th/29th). With `billing_day` capped at 28 this case does not arise for due dates, but the rule is stated for completeness. [Default, not stakeholder policy.]

## 5. The stub (odd-days) period

Because the billing cycle is anchored to `billing_day` and disbursement happens on an arbitrary date, there is in general a gap between the disbursement date and the start of the first full billing period. That gap is the **stub period**.

- **Stub days** = the actual number of calendar days from `disbursement_date` **up to but not including** the first due date. (Under the 30/360 convention each period starts on its due date and ends the day before the next, so the first full period starts on the first due date; the stub covers everything before it.)
- **Stub interest** is charged on those odd days using the 30/360 annual basis:

  `stub_interest = outstanding_principal × annual_rate × stub_days / 360`

  where `outstanding_principal` is the full disbursed principal (no principal has yet been repaid at the stub).
- The stub is an **interest add-on only**. It is **not** capitalised into principal and **not** billed as a separate transaction. It is collected as part of the **first instalment**. [Collection mechanism is a default, not stakeholder policy.]
- The stub does **not** alter the amortisation schedule: the constant principal portion remains `P/n` for every period, the first instalment included.

If the disbursement date coincides with the start of the first full period (no odd days), `stub_days = 0` and the stub interest is zero.

## 6. Normal-period computation (periods 2..n, and the base of period 1)

For each regular monthly period:

1. **Per-period interest rate** = `annual_rate / 12` (30/360: every month is 30 days, the year 360, so the monthly rate is a flat twelfth of the annual nominal rate, applied once per period).
2. **Period interest (unrounded)** = `opening_balance × annual_rate / 12`.
3. **Round the period interest** to the whole shilling (half-up).
4. **Constant principal portion** = `P / n` (the same nominal value every period, carried at full precision into the instalment assembly).
5. **Instalment total (before final-period adjustment)** is assembled from the rounded interest plus the principal portion, then the whole instalment is expressed in whole shillings; **principal due = rounded instalment total − rounded interest**.
6. **Closing balance** = `opening_balance − principal_due`. The next period's opening balance is this closing balance.

## 7. First-instalment composition

The first instalment carries two interest components: the normal first-period interest and the stub interest. They compose as follows:

1. Compute the normal first-period interest (`opening_balance × annual_rate / 12`, unrounded) and the stub interest (§5, unrounded).
2. **Sum the two interest components first, then round the combined total once** to the whole shilling (half-up). Do **not** round each component separately.
3. The principal portion going into the first instalment is exactly `P/n`, unchanged by the stub.
4. The first instalment's **principal due = (rounded combined first instalment total) − (rounded combined interest)**, i.e. the remainder of the single rounded instalment total after the combined, once-rounded interest.
5. Closing balance after period 1 = `opening_balance − principal_due`, as in §6.

## 8. Final-instalment residual reconciliation

Accumulated whole-shilling rounding across the term will generally leave a small residual so that the naive sum of `P/n` principal portions does not exactly equal `P`. The **final instalment's principal is adjusted to absorb the entire residual** so that the closing balance after the last period is **exactly zero**.

- Final principal = the opening balance of the final period (whatever remains), so the closing balance is zero by construction.
- The final instalment total = final (rounded) interest + final adjusted principal.
- **No guard or cap** is placed on this adjustment. Whatever value is required to zero the balance is accepted, even if theoretically it could push the final principal outside the range one might expect. In practice, accumulated half-up rounding on whole-shilling amounts over a standard term will not produce a residual large enough to drive the final principal negative or above the opening balance, so this is accepted without constraint. [The no-guard decision rests on a default assumption, not an explicit stakeholder policy.]

## 9. Zero-rate behaviour

When `annual_rate` is zero:

- Every period's interest is zero, **including the stub interest**.
- Each instalment equals exactly `P/n` (whole-shilling rounded), subject to the final-instalment residual rule in §8 so the balance still closes to exactly zero.

[Zero-rate behaviour is a default, not an explicit stakeholder policy, but follows directly from the interest formulae.]

## 10. Output

`generate_schedule(loan)` returns the full schedule as an ordered collection of `n` instalment records, one per period. Each record contains at least:

- the instalment number (1..n);
- the due date;
- the opening balance;
- the interest due for the period (for period 1, the combined once-rounded normal + stub interest);
- the principal due for the period;
- the total instalment amount;
- the closing (running) balance.

The closing balance of the final record must be exactly zero. All monetary figures in the output are whole-shilling KES values.

## 11. Worked sequence summary

1. Validate inputs; read `billing_day`.
2. Determine the first due date (§4.1) and all subsequent due dates (§4.2).
3. Compute stub days and stub interest (§5).
4. Set the constant principal portion `P/n`.
5. For period 1: assemble normal interest + stub interest, round the combined interest once, derive principal as the remainder of the rounded instalment, update the balance (§7).
6. For periods 2..n−1: compute and round interest on the opening balance, apply `P/n` principal, update the balance (§6).
7. For period n: set principal to the full remaining opening balance so the closing balance is exactly zero, add the rounded final-period interest (§8).
8. Emit the schedule (§10).

## 12. Decisions explicitly settled

- Amortisation: equal principal (straight-line), declining instalment.
- Day-count: 30/360; per-period rate = annual/12 on the outstanding balance.
- Currency KES; instalments rounded to whole shillings; half-up [default]; interest rounded first, principal is the remainder.
- Billing anchored to a per-loan `billing_day` (1–28) [field added; reasonable default]; first due date is the first `billing_day` occurrence at least one full month after disbursement.
- Stub interest on actual odd days via 30/360 (`principal × annual_rate × stub_days / 360`), charged as an add-on to the first instalment [collection default], not capitalised, not separately billed; does not change `P/n`.
- First instalment: two interest components summed then rounded once; principal is the remainder; principal portion stays `P/n`.
- Final instalment absorbs all accumulated rounding residual; closing balance exactly zero; no guard/cap [default].
- Zero rate: zero interest everywhere including stub; instalment = `P/n` subject to the final-period residual rule [default].
- Short-month day-of-month edge resolves to the last calendar day [default; not reachable while `billing_day` ≤ 28].

## Auditor verdict

_The spec strongly covers the accrual/amortisation/rounding core: decisions 1–9 are all surfaced and correct, including the bespoke off-default choices (equal principal, 30/360, same-as-repayment period, stub interest, whole-shilling rounding, interest-first rounding order, zero closing). It fails on the three method decisions it was never told existed: early full settlement rebate (#10) and partial prepayment (#11) are wholly absent, and output disclosure (#14) captures the schedule shape but misses the total cost of credit and the actual/365 APR disclosure quirk. First due date (#13) is surfaced but resolved differently — anchored to an invented billing_day rather than disbursement + one month. Zero/negative input rejection (#12) is credited via positive-domain constraints plus a validate step. Score: 11/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §6.2 'Period interest (unrounded) = opening_balance × annual_rate / 12'; §12 'per-period rate = annual/12 on the outstanding balance' | Interest is computed on the reducing opening/outstanding balance each period, which is declining balance on reducing principal — matches the reference. |
| 2 | yes | **yes** | §1 'The amortisation method is equal principal (straight-line / declining payment): a constant principal portion is applied every period, interest accrues on the reducing balance, and the total instalment therefore decreases... Equal-instalment (annuity/EMI)... out of scope.' | Exact match: constant principal portion P/n, reducing-balance interest, decreasing instalment, EMI explicitly excluded. |
| 3 | yes | **yes** | §6.1 '30/360: every month is 30 days, the year 360'; §12 'Day-count: 30/360' | Spec adopts 30/360 explicitly, matching the reference and excluding actual/365 for accrual. |
| 4 | yes | **yes** | §6.1 'the monthly rate is a flat twelfth of the annual nominal rate, applied once per period'; §6.2 interest on opening_balance per period | Interest is computed once per monthly period on the opening balance, i.e. interest-calculation-period = repayment period, not daily accrual — matches. |
| 5 | yes | **yes** | §5 'Stub interest is charged on those odd days... stub_interest = outstanding_principal × annual_rate × stub_days / 360'; 'from disbursement_date up to but not including the first due date' | Interest effectively accrues from disbursement; a partial-period (stub) interest charge is levied and collected for the extra days before the first full period, matching the reference's partial-period-allowed-and-charged policy. |
| 6 | yes | **yes** | §3 'All amounts are denominated in KES. Internal computation is carried at 2 decimal places (cents) precision' | Currency KES and base precision of 2 decimal places are both stated, matching the reference (whole-shilling instalment rounding is handled separately under #7). |
| 7 | yes | **yes** | §3 'each instalment is rounded to the whole shilling — no cents'; §8 'The final instalment's principal is adjusted to absorb the entire residual so that the closing balance after the last period is exactly zero' | Instalments rounded to whole shilling with the accumulated rounding difference settled in the final instalment — matches exactly. |
| 8 | yes | **yes** | §3 'interest is computed and rounded first; the principal portion is then derived as the remainder of the rounded instalment total'; §6.5 | Interest rounded first, principal is the remainder of the rounded instalment — exact match on the within-period rounding order. |
| 9 | yes | **yes** | §8/§10 'the closing balance after the last period is exactly zero'; §1 'must close to a balance of exactly zero on the final instalment' | Final instalment reconciles the schedule to an exactly-zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or an unearned-interest rebate; Rule of 78 is not mentioned anywhere. |
| 11 | no | no | absent | The spec covers only the originated schedule; partial prepayment, re-amortisation, and the term-fixed-vs-instalment-fixed choice are not addressed at all. |
| 12 | yes | **yes** | §2 'principal — a positive monetary value'; 'term — a positive integer n'; §11.1 'Validate inputs' | The input domain is constrained to strictly positive principal and term with an explicit validation step, which rejects zero/negative as invalid; the reference's reject verdict is met, though the spec does not spell out the error form. |
| 13 | yes | no | §4.1 'the first calendar date whose day-of-month equals billing_day and which falls at least one full calendar month after disbursement_date'; example billing_day=10 → 2026-03-10 | The spec anchors the first due date to a per-loan billing_day rather than disbursement date + one month, producing different dates (e.g. 2026-03-10 vs the reference's 2026-02-15); the resolution does not match. |
| 14 | yes | no | §10 lists per-period due date, opening balance, interest, principal, instalment, closing balance; no total cost of credit and no APR mentioned | The per-period schedule shape matches, but the reference's total cost of credit and the disclosed APR on an actual/365 basis (the non-obvious 30/360-accrual-but-actual/365-disclosure quirk) are entirely absent, so the decision is not fully resolved. |
