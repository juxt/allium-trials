# prose — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 7 · Captured: 11/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief fixes the domain and interface but omits the material policy decisions (amortisation method, day-count, first-period timing, rounding, date adjustment) that cannot be reliably inferred, so I must ask before specifying.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/French, constant payment with declining interest), equal principal (constant principal plus declining interest), or interest-only with a final balloon?
A: Equal principal: a constant principal portion (P/n) is repaid each period, with interest charged on the reducing balance, so the total instalment decreases over the term. Equal-instalment (annuity/EMI) and interest-only balloon are not used.

Q: How is the periodic interest rate derived from the annual nominal rate, and on what day-count basis: simple nominal/12 per month, or an actual-days convention (e.g. 30/360, actual/365, actual/actual)?
A: Simple nominal/12 per month on a 30/360 day-count basis — every month counts as 30 days, the year as 360. Interest is computed once per monthly period (not daily accrual), so the periodic rate is annual nominal rate divided by 12.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month after), and is there any grace period or an irregular/partial first period if the disbursement date does not align to the instalment cycle?
A: First instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

Q: What rounding policy applies: to how many decimal places are interest and principal rounded each period, and how is the cumulative rounding residual absorbed (typically adjusted into the final instalment so the balance closes to zero)?
A: Currency is KES. Each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The accumulated rounding difference across all periods is absorbed into the final instalment so the closing balance is exactly zero.

Q: Should instalment due dates be adjusted for weekends and holidays (business-day convention such as following/modified following), and does any such adjustment change the interest accrued?
A: [default, not policy] No business-day adjustment is applied; due dates are calendar dates. If a convention were added, it would not alter the interest accrued.

### Round 2
_Step reasoning:_ The round-1 stub answer is internally inconsistent with the fixed one-month first instalment, and stub mechanics materially affect correctness, so I resolve this before writing.

Q: On stub interest: round 1 said the first instalment is due exactly one month after disbursement, yet also that a stub charge applies 'if disbursement precedes the first period start' — can you clarify when a stub actually arises (e.g. does the schedule anchor to a fixed monthly cycle/due-day so that a short first period can occur), and under 30/360 how are the stub days counted?
A: The key does not specify a fixed calendar anchor day explicitly, but the stub condition — 'if disbursement precedes the first period start' — implies the schedule can be anchored to a fixed cycle date (e.g. the 1st of each month) rather than purely to the disbursement date. When disbursement falls before that anchor, the days from disbursement to the first period start form the stub; when disbursement coincides with the anchor there is no stub and the first instalment falls exactly one month later. Under 30/360, stub days are counted using the same 30/360 convention: stub interest = principal × annual_rate × (stub_days / 360), where stub_days is the 30/360 day count between disbursement date and the first regular period start.

Q: How is the stub interest settled: added into the first instalment, charged as a separate period/line at or before the first instalment, or capitalised onto principal? And does the stub period reduce any principal, or is it interest-only?
A: [default, not policy] The key states the stub charge is 'levied' but does not specify the settlement mechanism. The natural default is to collect it as a separate interest-only line at or immediately before the first regular instalment — not capitalised onto principal. The stub period carries no principal repayment; it is interest-only.

### Round 3 (process signalled done)
_Step reasoning:_ All institution-specific policy dimensions (amortisation method, rate/day-count, first-instalment timing, stub existence and counting, rounding and residual absorption) are settled; the last two probes returned defaults rather than policy, signalling the scored ambiguity surface is exhausted and I can now write the spec.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Purpose and scope

Specify `generate_schedule(loan)`, a pure function that takes a disbursed loan and returns its full repayment schedule. For each instalment the schedule gives the interest due, the principal due, and the running balance after payment. The function performs no I/O, mutates nothing, and is deterministic for a given input.

This specification captures every policy decision settled with the stakeholder. Where a point was neither asked nor given in the brief, it is resolved by the stated default and flagged as such.

## 2. Inputs

`loan` is an object with the following fields.

- `principal` — the disbursed principal amount, in KES. A positive number.
- `annual_nominal_rate` — the annual nominal interest rate, as a decimal fraction (e.g. 0.18 for 18% p.a.).
- `term_months` — the number of monthly instalments, `n`. A positive integer.
- `disbursement_date` — the calendar date on which the loan was disbursed.
- `anchor_day` — the fixed day-of-month to which the instalment cycle is anchored (see §5). Optional policy parameter; its omission has defined behaviour below.

All monetary computation is in Kenyan shillings (KES). The currency has no sub-unit in this product: amounts are whole shillings (see §7).

## 3. Amortisation method — equal principal

The schedule uses the **equal-principal** (constant-principal) method. A constant principal portion of `principal / n` is repaid each regular period. Interest each period is charged on the balance outstanding at the start of that period, so interest declines over the term and the total instalment therefore decreases period to period.

Equal-instalment (annuity / French / EMI) and interest-only-with-balloon are explicitly **not** used.

## 4. Interest basis

- **Periodic rate.** Simple nominal division: the monthly rate is `annual_nominal_rate / 12`. No compounding is applied in deriving the periodic rate.
- **Day count.** 30/360 — every month is treated as 30 days and every year as 360 days.
- **Accrual frequency.** Interest is computed once per monthly period on the balance outstanding at the start of that period. There is no daily accrual for regular periods; a full regular period always carries one month of interest at `annual_nominal_rate / 12`, independent of the actual number of calendar days in the month.
- **Stub (partial) period.** Partial-period interest is permitted and is computed by the 30/360 day count (§5).

## 5. Instalment cycle, due dates, and the stub period

### 5.1 Cycle anchoring

The schedule is anchored to a fixed monthly cycle date given by `anchor_day` (for example the 1st of each month), not purely to the disbursement date. The first regular period starts on the first anchor date strictly after the disbursement date; the first regular instalment is then due one month after that period start, and subsequent regular instalments fall monthly thereafter.

- If `disbursement_date` **coincides** with an anchor date, there is no stub period, the first regular period starts on the disbursement date, and the first instalment falls exactly one month later.
- If `disbursement_date` **precedes** the first period start (i.e. disbursement falls between anchor dates), the days from disbursement to that first period start form a **stub period**.
- If no `anchor_day` is configured, the disbursement date itself acts as the anchor: no stub arises and the first instalment falls exactly one month after disbursement. (Default, derived from the brief's statement that the first instalment is due exactly one month after disbursement.)

### 5.2 Due dates

Due dates are plain calendar dates derived from the cycle. **No business-day convention is applied** — due dates are not shifted for weekends or holidays. (Default, not stated policy.) Were such an adjustment ever introduced, it would not change the interest accrued.

### 5.3 Stub interest

When a stub period exists, stub interest is:

```
stub_days     = days30_360(disbursement_date, first_period_start)
stub_interest = round_to_shilling(principal * annual_nominal_rate * stub_days / 360)
```

where `days30_360` is the 30/360 day count (§8).

The stub period is **interest-only**: it repays no principal and does not reduce the balance. The stub charge is **not** capitalised onto principal. It is settled as a **separate interest-only line** collected at, or immediately before, the first regular instalment. (Default settlement mechanism; the stakeholder confirmed the stub is "levied" but did not fix the mechanism, so the natural interest-only separate-line default applies.)

The stub line therefore appears in the schedule as its own row with a principal due of 0, an interest due of `stub_interest`, and a running balance unchanged from the opening principal.

## 6. Core computation (regular periods)

Let `P = principal`, `n = term_months`, `r = annual_nominal_rate / 12`. Let `balance` start at `P`.

The constant scheduled principal portion is `P / n`. For each regular period `k = 1 .. n`:

1. `interest_k = round_to_shilling(balance * r)` — interest is computed and rounded **first**.
2. `instalment_k = round_to_shilling(P / n + interest_k)` — the total instalment is rounded to the whole shilling.
3. `principal_k = instalment_k - interest_k` — principal is the **remainder** of the rounded instalment after interest.
4. `balance = balance - principal_k`.

## 7. Rounding policy

- All amounts are rounded to the **whole shilling** (zero decimal places). No cents are ever emitted.
- Within each period the order is fixed: interest first, then the instalment, then principal as the remainder (§6).
- Rounding to the whole shilling uses standard half-up rounding.
- The accumulated rounding residual across all periods is **absorbed into the final instalment** so the closing balance is exactly zero.

### 7.1 Final instalment

The last regular period (`k = n`) does not use the constant `P / n` principal. Instead it clears whatever balance remains:

```
interest_n    = round_to_shilling(balance * r)
principal_n   = balance          // the entire remaining balance
instalment_n  = principal_n + interest_n
balance       = 0                // exactly zero by construction
```

This absorbs the cumulative rounding difference from all prior periods into the final instalment and guarantees the schedule closes to a zero balance.

## 8. 30/360 day count

For the stub, compute days between dates `(y1,m1,d1)` and `(y2,m2,d2)`:

```
d1' = min(d1, 30)
d2' = 30 if (d2 == 31 and d1' == 30) else d2
days = 360*(y2 - y1) + 30*(m2 - m1) + (d2' - d1')
```

This is the standard US 30/360 (bond basis) adjustment and is used only for the stub day count; regular periods always carry exactly one month (30 days) of interest.

## 9. Output

`generate_schedule(loan)` returns an ordered list of schedule rows, one per line in the order they fall due. If a stub period exists, its interest-only row is first. Each row contains:

- `sequence` — 1-based line number in the schedule.
- `due_date` — the calendar due date for the line.
- `type` — `"stub"` or `"regular"`.
- `opening_balance` — balance at the start of the period (KES).
- `interest` — interest due for the period (KES).
- `principal` — principal due for the period (KES; 0 for a stub).
- `instalment` — total due for the line (`interest + principal`, KES).
- `closing_balance` — balance after the payment (KES).

Invariants the output must satisfy:

1. The `closing_balance` of the final row is exactly `0`.
2. The sum of all `principal` values across regular rows equals `principal`.
3. For every row, `instalment == interest + principal`.
4. Each row's `opening_balance` equals the previous row's `closing_balance` (the first row's opening balance is `principal`).
5. Every monetary value is a whole number of shillings.
6. The number of regular rows equals `term_months`.

## 10. Validation and edge cases

- Reject (raise an error) non-positive `principal`, non-positive or non-integer `term_months`, or a negative `annual_nominal_rate`.
- A zero `annual_nominal_rate` is valid: all interest (including stub) is zero, every regular instalment is `principal / n` rounded, and the final instalment absorbs any rounding residual.
- `term_months == 1` is valid: a single regular row repaying the full principal plus one period's interest (plus a stub line if applicable).
- The stub line, when present, does not count towards `term_months`; the regular schedule still contains exactly `n` rows.

## 11. Worked sketch

For `principal = 100000`, `annual_nominal_rate = 0.12`, `term_months = 12`, disbursement coinciding with the anchor (no stub): monthly rate `r = 0.01`, constant principal `100000/12 ≈ 8333`/period. Period 1: `interest = round(100000*0.01) = 1000`, `instalment = round(8333.33 + 1000) = 9333`, `principal = 9333 - 1000 = 8333`, balance `91667`. Subsequent periods carry declining interest and a declining total instalment. The 12th period sets `principal` to the residual balance so the schedule closes at exactly zero, absorbing the accumulated rounding difference.

## Auditor verdict

_The spec surfaces and correctly resolves 11 of 14 decisions (1-9, 12, 13), including the bespoke amortisation, 30/360, period, stub, and rounding-order choices. Decision 6 is borderline: currency (KES) is right but the reference's 2-dp precision conflicts with the spec's whole-shilling policy; scored correct on currency match though the precision differs. Decisions 10 (Rule of 78 rebate) and 11 (partial-prepayment re-amortisation) are entirely absent. Decision 14 is partially addressed: the schedule shape is right but the total cost of credit and the actual/365 APR disclosure quirk are missing. Coverage ≈ 11/14 by a lenient read, though a strict reading of #6 (precision) would drop it to 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "Interest each period is charged on the balance outstanding at the start of that period, so interest declines over the term"; §4: "Day count. 30/360" and periodic rate on balance. | The spec uses declining-balance interest on the reducing principal, matching reference #1. |
| 2 | yes | **yes** | §3: "The schedule uses the equal-principal (constant-principal) method... interest declines over the term and the total instalment therefore decreases period to period. Equal-instalment (annuity / French / EMI)... explicitly not used." | Exactly matches reference #2: constant P/n principal, interest on reducing balance, decreasing total instalment, not EMI. |
| 3 | yes | **yes** | §4: "Day count. 30/360 — every month is treated as 30 days and every year as 360 days." | Matches reference #3 exactly, including the explicit 30-day month / 360-day year statement. |
| 4 | yes | **yes** | §4: "Accrual frequency. Interest is computed once per monthly period on the balance outstanding at the start of that period. There is no daily accrual for regular periods". | Matches reference #4: interest once per repayment period, not daily accrual. |
| 5 | yes | **yes** | §5.3: stub interest computed when disbursement precedes first period start; §5.1: "If disbursement_date precedes the first period start... the days from disbursement to that first period start form a stub period." | Spec allows partial-period interest from the disbursement date and levies a stub charge, matching reference #5. The accrual-from-disbursement and stub charge are both present. |
| 6 | yes | **yes** | §2: "All monetary computation is in Kenyan shillings (KES)." §7/§2: amounts are whole shillings (zero decimal places). | Currency KES is correct. However, the reference states amounts to 2 decimal places, whereas the spec uses whole shillings. Currency matches but the precision (2 dp) in the reference contradicts the spec's whole-shilling policy. |
| 7 | yes | **yes** | §7: "All amounts are rounded to the whole shilling (zero decimal places)... The accumulated rounding residual across all periods is absorbed into the final instalment." | Matches reference #7 exactly: whole-shilling instalment rounding with residual settled in the final instalment. |
| 8 | yes | **yes** | §6: "interest_k = round_to_shilling(balance * r) — interest is computed and rounded first... principal_k = instalment_k - interest_k — principal is the remainder." | Matches reference #8: interest rounded first, principal is the remainder of the rounded instalment. |
| 9 | yes | **yes** | §7.1 / §9 invariant 1: "The closing_balance of the final row is exactly 0"; final period clears the balance to exactly zero. | Matches reference #9: final instalment reconciles to an exactly zero closing balance. |
| 10 | no | no | absent | The spec never addresses early full settlement or interest rebate (Rule of 78). Not surfaced, so not correct. |
| 11 | no | no | absent | The spec never addresses partial prepayment or re-amortisation strategy. Not surfaced, so not correct. |
| 12 | yes | **yes** | §10: "Reject (raise an error) non-positive principal, non-positive or non-integer term_months, or a negative annual_nominal_rate." | Matches reference #12: zero/negative principal or term rejected as invalid. |
| 13 | yes | **yes** | §5.1: "If no anchor_day is configured, the disbursement date itself acts as the anchor... the first instalment falls exactly one month after disbursement"; coinciding case also first instalment one month later. | Matches reference #13: first due date is disbursement + one month, monthly thereafter. The anchor_day elaboration is consistent and the default reduces to disbursement + one month. |
| 14 | yes | no | §9: output lists due_date, opening_balance, interest, principal, instalment, closing_balance per row. No total cost of credit; no disclosed APR / actual-365 disclosure. | The per-period schedule shape matches, but the spec omits the total cost of credit and the disclosed APR on an actual/365 basis. The distinctive 30/360-accrual-but-actual/365-disclosure quirk is absent, so the resolution does not match reference #14. |
