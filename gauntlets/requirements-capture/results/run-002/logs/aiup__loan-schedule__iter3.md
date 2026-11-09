# aiup — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 9 · Captured: 9/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: Let me just ask these in plain text so you can answer directly.

I've read the brief, and before writing the spec I need to pin down the policy decisions it deliberately leaves open. Each of these has several plausible answers that I can't reliably infer — the right values depend on what this institution has actually chosen. Could you confirm each?

**1. Amortization method** — how is each instalment structured?
- (a) **Equal total instalment (annuity)** — every instalment the same total; interest portion shrinks, principal grows. (Most common for consumer loans.)
- (b) **Equal principal** — constant principal portion; total instalment declines over the term.
- (c) **Interest-only + balloon** — interest-only instalments, full principal repaid at the end.

**2. Day-count / interest accrual convention** — how is each period's interest derived from the *annual nominal* rate?
- (a) **Nominal / 12** — each month accrues `rate/12` on the balance, ignoring actual days.
- (b) **30/360**, (c) **Actual/365**, or (d) **Actual/360**.

**3. Rounding & residual** — amounts presumably round to 2 decimals (cents). Which rounding mode (half-up vs. banker's/half-even), and how is the accumulated rounding drift handled so the final balance closes exactly at **0.00** — absorb it all into the **final instalment**, or spread it across instalments?

**4. First instalment due date** — when is the first instalment due, and on what day do later ones fall?
- (a) One calendar month after disbursement, keeping the disbursement **day-of-month**.
- (b) A **fixed billing day** each month (e.g. the 1st), first due date being the next occurrence after disbursement.
- (c) One month after, with an **end-of-month** rule for month-end disbursements.

**5. Stub / odd-days first period** — if the gap between disbursement and the first instalment isn't exactly one month, is there a **broken-period (stub) interest** charge for the odd days, or is the first period always treated as a full month?

**6. Due-date business-day adjustment** — if a computed due date lands on a weekend or public holiday, does it **roll** (and which way — following / modified-following / previous), or are due dates left on calendar dates regardless?

Answer whichever you're ready to; once I have these I'll write `spec.md`.
A: 1. **Amortisation method:** Equal principal (option b). A constant principal portion each period (P/n), with interest on the reducing balance — so the total instalment decreases over the term.

2. **Day-count convention:** 30/360. Every month is treated as 30 days, the year as 360. Interest is computed once per monthly period (not daily accrual), so each period's interest is `balance × annual_rate × 30/360`.

3. **Rounding and residual:** Currency is Kenyan shilling (KES). Each instalment is rounded to the whole shilling (no cents). Within a period, interest is computed and rounded first; the principal portion is the remainder of the rounded instalment. Accumulated rounding drift is absorbed entirely into the final instalment, which is adjusted so the closing balance is exactly zero. The rounding mode (half-up vs. half-even) is not specified policy — use half-up [default, not policy].

4. **First due date:** Disbursement date plus one calendar month, preserving the disbursement day-of-month (option a). Subsequent instalments fall monthly on the same day-of-month.

5. **Stub period:** Interest accrues from the disbursement date. If disbursement precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is charged, not waived or treated as a full month.

6. **Business-day adjustment:** Not a defined policy item — no calendar roll is specified. Leave due dates on computed calendar dates [default, not policy].

### Round 2
_Step reasoning:_ (live agent turn)

Q: These answers largely lock it down, but three of them interact in ways I want to confirm before I commit them to the spec — I'd rather surface the tension than silently pick an interpretation.

**A. Rounding description vs. the equal-principal method (answers 1 & 3).**
Your rounding answer describes "interest computed first; the principal portion is the *remainder of the rounded instalment*." That framing fits an *annuity* loan, where the total instalment is the fixed quantity and principal = instalment − interest. But you chose **equal principal**, where the *principal portion* is the fixed quantity (P/n) and the instalment is derived from it. For equal principal the natural reading is:
- `principal_t = round(P / n)` to whole KES (constant each period),
- `interest_t = round(balance_{t-1} × rate × 30/360)` to whole KES,
- `instalment_t = principal_t + interest_t`,
- the **final** period's principal = whatever remains, so the balance closes to exactly 0 (this absorbs the P/n rounding drift).

Is that the intended computation? (i.e. principal is fixed at P/n and drives the instalment — not the other way round.)

**B. Stub interest vs. the first-due-date anchoring (answers 2, 4 & 5).**
You said interest per period is a flat `balance × rate × 30/360` (≡ `rate/12`, treating every month as exactly 30 days — answer 2), *and* that a stub/partial charge is levied for odd days between disbursement and the first period (answer 5). But with answer 4 (first instalment = disbursement + exactly one calendar month, same day-of-month), **the first period is always exactly one month**, so under a flat 30/360 factor a stub never actually arises. These two can only coexist one of two ways — which did you intend?
- **(i) Flat monthly factor:** every period (including the first) = `balance × rate/12`. Simple and matches answer 2 literally — but then answer 5's stub never triggers (it's a dead policy).
- **(ii) True 30/360 day-count between consecutive scheduled dates:** normal months compute to 30 days (= `rate/12`), but month-end edge cases yield a day-count ≠ 30 and thus a genuine partial/stub charge — which makes answer 5 live, at the cost of answer 2's "flat" phrasing.

**C. Invalid day-of-month (follows from answer 4a, and is where a stub would actually occur).**
You chose "preserve the disbursement day-of-month" but *not* the end-of-month variant. For disbursements on the 29th/30th/31st, some months have no such day (e.g. disbursed Jan 31 → "Feb 31" doesn't exist). How should the due date resolve in those months — **snap to the last day of the month**, or something else? (Under model B(ii) this is precisely what produces the stub.)

Once you confirm A, pick (i) or (ii) for B, and answer C, I'll have everything I need to write `spec.md`.
A: **A. Rounding order vs. equal principal.** The engineer's proposed computation is correct. Principal is the fixed quantity: `principal_t = round(P/n)` (constant each period). Interest is computed and rounded first: `interest_t = round(balance_{t-1} × rate × 30/360)`. The instalment follows: `instalment_t = principal_t + interest_t`. The 'remainder' in item 8 means principal = instalment − interest, which is algebraically equivalent when principal is the fixed term — it describes the derivation order, not which term is variable. The final period's principal is whatever remains to bring the closing balance exactly to zero, absorbing all accumulated rounding drift.

**B. Flat monthly factor vs. true 30/360 day-count.** Option **(i) — flat rate/12 per standard monthly period**. 'Every month counts as 30 days' means each regular period accrues a flat `balance × rate/12`, regardless of actual calendar days. The stub in answer 5 is live policy for the specific edge case where the disbursement date falls before the first scheduled period start — for example, if the institution disburses mid-cycle against a fixed period boundary. In that case the odd days are charged at the daily rate (`annual_rate / 360` per day). Under the disbursement-plus-one-month first-due-date rule, that edge case rarely arises in practice, but the policy is not dead — it fires when it applies.

**C. Invalid day-of-month (29th/30th/31st).** Not a specified policy item. [Default, not policy]: snap to the last day of the short month — e.g. a Jan 31 disbursement gives a Feb 28 (or 29) first due date, then Mar 31, Apr 30, and so on, end-of-month clamped each time. Under option (i), that period is still treated as a flat rate/12; no stub arises from the calendar shortfall.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

## What it covers

I treated the brief as deliberately underspecified and resolved it by asking you about the six material policy decisions a model can't reliably infer — amortisation method, day-count convention, rounding/residual, first-due-date anchoring, stub interest, and business-day adjustment. Three of your answers surfaced further tensions I came back on (the rounding description vs. the equal-principal method, the stub policy vs. the one-month anchoring, and the invalid-day-of-month gap), which are now resolved rather than assumed.

The spec contains:

- **Decisions Log (§2)** — each confirmed policy (D-1…D-10), with the three you explicitly declined to make policy clearly tagged **[Default — not policy]**: rounding mode (half-up), business-day adjustment (none), and month-end clamping.
- **Data model (§3)** — the `loan` input and the per-instalment output row.
- **Authoritative algorithm (§4)** — equal-principal with `round(P/n)`, 30/360 flat `rate/12` interest, interest-first rounding, final-instalment residual absorption to a zero close, the `rate/360` stub adjustment, and due-date derivation.
- **FR / NFR / Constraints (§5–7)** — in the requirements-catalog format (user-story FRs, measurable NFRs including exact-zero close and principal-sum invariants).
- **Worked example (§8)** and an **Open Items** list (§9) flagging the three defaults for review before production.

The one thing I'd flag back to you: §9 lists the three default assumptions that are currently load-bearing but unconfirmed as policy. They don't block implementation of the normal path, but they govern real edge cases — worth a decision before this engine is relied on.
A: Noted. The spec looks well-structured and the three flagged defaults are the right ones to escalate before production.

## Produced specification

# Repayment Schedule Engine — Requirements Specification

## 1. Overview

Build the repayment schedule engine for a loan product. Given a disbursed loan —
principal, annual nominal interest rate, term in monthly instalments, and
disbursement date — the engine produces the full repayment schedule: for every
instalment, the interest due, the principal due, the total instalment, and the
running (closing) balance. The public interface is a single function,
`generate_schedule(loan)`, returning the ordered schedule.

This document records the policy decisions that the brief deliberately left open.
Each decision below was confirmed with the product stakeholder; items that the
stakeholder explicitly declined to make policy are marked **[Default — not
policy]** and should be revisited before the engine is relied on for
production edge cases.

## 2. Decisions Log (stakeholder-confirmed)

| # | Topic | Decision | Source |
|---|-------|----------|--------|
| D-1 | Amortisation method | **Equal principal.** A constant principal portion `P/n` each period, with interest on the reducing balance; the total instalment decreases over the term. | Stakeholder |
| D-2 | Day-count / accrual | **30/360, flat monthly factor.** Every month is treated as 30 days, the year as 360. Each regular period accrues a flat `balance × annual_rate × 30/360 ≡ balance × annual_rate / 12`, regardless of actual calendar days. Interest is computed once per monthly period, not daily. | Stakeholder |
| D-3 | Currency & precision | **Kenyan shilling (KES), whole shillings, no cents.** All monetary amounts are rounded to the whole shilling. | Stakeholder |
| D-4 | Rounding order | **Interest first, principal fixed.** `principal_t = round(P/n)` (constant); `interest_t = round(opening_balance_t × rate / 12)`; `instalment_t = principal_t + interest_t`. | Stakeholder |
| D-5 | Residual / closing | **Final instalment absorbs all drift.** The last period's principal is whatever remains, bringing the closing balance to exactly **0 KES**. | Stakeholder |
| D-6 | First due date | **Disbursement date + 1 calendar month**, preserving the disbursement day-of-month. Subsequent instalments fall monthly on the same day-of-month. | Stakeholder |
| D-7 | Stub / odd-days interest | **Live policy.** If the disbursement date falls *before* the first scheduled period start (a fixed-boundary disbursement), the odd days are charged at the daily rate `annual_rate / 360` per day and added to the first instalment's interest. Rare under D-6, but not dead. | Stakeholder |
| D-8 | Rounding mode | Half-up. **[Default — not policy]** | Stakeholder (declined to set as policy) |
| D-9 | Business-day adjustment | None — due dates stay on computed calendar dates; no weekend/holiday roll. **[Default — not policy]** | Stakeholder (declined to set as policy) |
| D-10 | Invalid day-of-month (29/30/31) | Clamp to the **last day of the short month**, anchored to the original disbursement day-of-month each period (e.g. Jan 31 → Feb 28/29 → Mar 31 → Apr 30…). The clamped period is still a flat `rate/12`; no stub arises from the calendar shortfall. **[Default — not policy]** | Stakeholder (declined to set as policy) |

## 3. Data Model

### 3.1 Input — `loan`

| Field | Type | Unit / Format | Rules |
|-------|------|---------------|-------|
| `principal` | Decimal | KES | > 0 |
| `annual_nominal_rate` | Decimal | Annual nominal rate as a fraction (e.g. `0.18` = 18%) | ≥ 0 |
| `term_months` | Integer | Count of monthly instalments (`n`) | ≥ 1 |
| `disbursement_date` | Date | Calendar date | Valid date |

### 3.2 Output — Schedule (ordered list of `n` instalment rows)

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `instalment_no` | Integer | — | 1 … n |
| `due_date` | Date | — | Per D-6 / D-10 |
| `opening_balance` | Integer | KES | Balance at period start |
| `interest` | Integer | KES | Interest due this period (incl. stub on instalment 1 where D-7 applies) |
| `principal` | Integer | KES | Principal due this period |
| `instalment` | Integer | KES | `interest + principal` |
| `closing_balance` | Integer | KES | `opening_balance − principal`; `0` at instalment `n` |

## 4. Computation Specification (authoritative algorithm)

Let `P = principal`, `r = annual_nominal_rate`, `n = term_months`.

```
base_principal      = round_half_up(P / n)              # constant per period (KES)
closing_balance[0]  = P

for t in 1 .. n:
    opening_balance[t] = closing_balance[t-1]
    interest[t]        = round_half_up(opening_balance[t] * r / 12)   # flat 30/360 (D-2)

    if t < n:
        principal[t] = base_principal                   # fixed term (D-1, D-4)
    else:
        principal[t] = opening_balance[t]               # final absorbs residual (D-5)

    instalment[t]      = principal[t] + interest[t]
    closing_balance[t] = opening_balance[t] - principal[t]

# Post-condition: closing_balance[n] == 0 exactly
```

**Stub adjustment (D-7).** When the disbursement date precedes the first
scheduled period start by `odd_days` > 0:
```
stub_interest = round_half_up(P * r / 360 * odd_days)
interest[1]  += stub_interest
instalment[1] = principal[1] + interest[1]
```
Principal and the running balance are unaffected by the stub. Under the D-6
first-due-date rule the first period start coincides with the disbursement date,
so `odd_days = 0` in the normal case and no stub is levied.

**Due dates (D-6, D-10).**
```
due_date[t] = disbursement_date + t months
            , preserving the disbursement day-of-month
            , clamped to the last day of the month when that day does not exist
```

## 5. Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Generate full schedule | As a loan officer, I want to call `generate_schedule(loan)` and receive the complete ordered repayment schedule so that I can present the borrower their obligations for the whole term. | High | Open |
| FR-002 | Equal-principal amortisation | As an accountant, I want each regular instalment's principal fixed at `round(P/n)` with interest on the reducing balance so that the instalment total declines over the term per product policy. | High | Open |
| FR-003 | 30/360 flat interest accrual | As an accountant, I want each period's interest computed as `opening_balance × annual_rate / 12` (30/360, every month = 30 days) so that interest matches the institution's day-count convention regardless of actual calendar days. | High | Open |
| FR-004 | Whole-shilling rounding | As an accountant, I want every monetary amount rounded to whole KES, with interest rounded first and the instalment derived as `principal + interest`, so that output matches ledger precision. | High | Open |
| FR-005 | Final instalment closes balance to zero | As an accountant, I want the final instalment's principal to equal the remaining balance so that accumulated rounding drift is absorbed and the closing balance is exactly 0 KES. | High | Open |
| FR-006 | Due-date scheduling | As a loan officer, I want the first instalment dated one calendar month after disbursement and subsequent instalments on the same day-of-month so that due dates follow the product's billing cadence. | High | Open |
| FR-007 | Month-end due-date clamping | As a loan officer, I want due dates for day-of-month 29–31 clamped to the last day of short months (anchored to the original day each period) so that every instalment has a valid date. | Medium | Open |
| FR-008 | Stub (odd-days) interest | As an accountant, I want odd days between disbursement and a fixed first-period start charged at `annual_rate / 360` per day and added to the first instalment's interest so that mid-cycle disbursements accrue correctly when that policy applies. | Medium | Open |
| FR-009 | Per-instalment breakdown output | As a loan officer, I want each schedule row to expose instalment number, due date, opening balance, interest, principal, instalment total, and closing balance so that the breakdown is fully auditable. | High | Open |
| FR-010 | Input validation | As a developer, I want `generate_schedule` to reject invalid input (non-positive principal, negative rate, term < 1, invalid date) with a clear error so that malformed loans never produce a silent or incorrect schedule. | Medium | Open |

## 6. Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Balance closes exactly | For any valid loan, the closing balance of the final instalment must equal exactly 0 KES, and the sum of all principal portions must equal the original principal exactly. | Correctness | High | Open |
| NFR-002 | Determinism | Identical input must always produce an identical schedule (no dependence on wall-clock, locale, or run order). | Reliability | High | Open |
| NFR-003 | Monetary precision | All monetary outputs must be integer KES (no fractional shillings) using the defined rounding order. | Correctness | High | Open |
| NFR-004 | Performance | A schedule for a term of up to 600 instalments must be generated in under 50 ms on a standard developer workstation. | Performance | Medium | Open |
| NFR-005 | Auditability | Each instalment row must independently satisfy `instalment = principal + interest` and `closing_balance = opening_balance − principal`, verifiable row-by-row. | Maintainability | Medium | Open |

## 7. Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Public interface | The engine must expose the entry point `generate_schedule(loan)` returning the ordered schedule. | Technical | High | Open |
| C-002 | Currency | All amounts are in Kenyan shillings (KES), whole units only. | Business | High | Open |
| C-003 | Day-count convention | Interest must use the 30/360 flat monthly factor (`rate/12`); daily accrual applies only to the D-7 stub case at `rate/360` per day. | Business | High | Open |
| C-004 | Rounding mode | Rounding uses half-up. **[Default — not stakeholder policy; confirm before production.]** | Technical | Medium | Open |
| C-005 | No business-day adjustment | Due dates are left on computed calendar dates; no weekend/holiday roll is applied. **[Default — not stakeholder policy; confirm before production.]** | Business | Medium | Open |
| C-006 | Month-end resolution | Invalid days-of-month clamp to month-end, anchored to the original disbursement day. **[Default — not stakeholder policy; confirm before production.]** | Business | Medium | Open |

## 8. Worked Example (illustrative)

Loan: `principal = 12,000 KES`, `annual_nominal_rate = 0.12` (12%), `term_months = 3`,
`disbursement_date = 2026-01-15`.

- `base_principal = round(12000 / 3) = 4000`
- Monthly factor `r/12 = 0.01`

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---|----------|---------|----------|-----------|------------|---------|
| 1 | 2026-02-15 | 12,000 | 120 | 4,000 | 4,120 | 8,000 |
| 2 | 2026-03-15 | 8,000 | 80 | 4,000 | 4,080 | 4,000 |
| 3 | 2026-04-15 | 4,000 | 40 | 4,000 | 4,040 | 0 |

(No stub: first period start = disbursement date, so `odd_days = 0`. Final
principal equals the remaining balance, closing to exactly 0.)

## 9. Open Items for Stakeholder Review

The following are in force as defaults only (see D-8, D-9, D-10 / C-004, C-005,
C-006) and were explicitly **not** set as policy. They should be confirmed before
the engine handles the relevant edge cases in production:

1. **Rounding mode** — half-up assumed; confirm vs. banker's rounding.
2. **Business-day adjustment** — none assumed; confirm no roll for weekends/holidays.
3. **Invalid day-of-month** — month-end clamp assumed; confirm the clamp-and-reanchor behaviour.


## Auditor verdict

_The spec nails the core method and convention decisions (1-5, 7, 9, 12, 13) with literal matches. Three fail: #6 (precision stated as whole shillings, not the reference's 2 dp, from conflating currency precision with instalment rounding), #8 (rounds interest first but makes principal fixed P/n rather than the remainder of the instalment), and #14 (schedule shape present but total cost of credit and the actual/365 APR disclosure absent). Decisions #10 (Rule-of-78 rebate) and #11 (partial prepayment re-amortisation) are entirely unsurfaced. Coverage = 9/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | D-1 'interest on the reducing balance'; FR-002 'interest on the reducing balance'; D-2 declining monthly factor on opening balance. | The spec computes interest on the reducing principal balance each period, i.e. declining-balance interest, matching the reference. |
| 2 | yes | **yes** | D-1 'Equal principal. A constant principal portion P/n each period, with interest on the reducing balance; the total instalment decreases over the term.' | Exact match: constant P/n principal, interest on reducing balance, decreasing instalment, explicitly not EMI. |
| 3 | yes | **yes** | D-2 '30/360, flat monthly factor. Every month is treated as 30 days, the year as 360.' | Day-count convention is 30/360 as the reference requires, not actual/365. |
| 4 | yes | **yes** | D-2 'Interest is computed once per monthly period, not daily'; C-003 '30/360 flat monthly factor (rate/12)'. | Interest calculation period is the monthly repayment period, computed once per period, not daily accrual. |
| 5 | yes | **yes** | D-7 'If the disbursement date falls before the first scheduled period start... the odd days are charged at the daily rate annual_rate/360 per day and added to the first instalment's interest'; FR-008. | The spec keeps a live stub policy charging partial-period interest from disbursement when disbursement precedes the first period start, matching the reference. |
| 6 | yes | no | D-3 'Kenyan shilling (KES), whole shillings, no cents. All monetary amounts are rounded to the whole shilling.'; C-002. | Currency (KES) is right, but the reference's precision is 2 decimal places, whereas the spec states whole shillings (0 dp); the spec conflated currency precision with instalment rounding, so the precision value does not match. |
| 7 | yes | **yes** | D-5 'Final instalment absorbs all drift. The last period's principal is whatever remains, bringing the closing balance to exactly 0 KES'; D-3 whole shillings; FR-005. | Instalments are whole shillings and the accumulated rounding difference is settled in the final instalment, matching the reference. |
| 8 | yes | no | D-4 'Interest first, principal fixed. principal_t = round(P/n) (constant); interest_t = round(opening_balance × rate/12); instalment_t = principal_t + interest_t.' | The spec rounds interest first (matching half the reference), but makes principal the fixed quantity (round(P/n)) with the instalment as the sum, whereas the reference requires principal to be the remainder of the rounded instalment; the decomposition is reversed, so it is a plausible-but-different answer. |
| 9 | yes | **yes** | D-5 'closing balance to exactly 0 KES'; FR-005; NFR-001 'closing balance of the final instalment must equal exactly 0 KES'. | The final instalment reconciles the closing balance to exactly zero, matching the reference. |
| 10 | no | no | absent | The spec contains no mention of early full settlement, payoff, or rebate of unearned interest (Rule of 78 or otherwise). |
| 11 | no | no | absent | The spec does not address partial prepayment, extra payments, or re-amortisation strategy (fixed term vs fixed instalment). |
| 12 | yes | **yes** | FR-010 'reject invalid input (non-positive principal, negative rate, term < 1, invalid date) with a clear error'; input rules principal > 0, term_months ≥ 1. | Zero/negative principal and zero term are rejected as invalid with an error, matching the reference. |
| 13 | yes | **yes** | D-6 'Disbursement date + 1 calendar month, preserving the disbursement day-of-month. Subsequent instalments fall monthly'; FR-006. | First due date is disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | no | Section 3.2 output rows (instalment_no, due_date, opening_balance, interest, principal, instalment, closing_balance); no total cost of credit or APR anywhere. | The spec specifies the per-period schedule shape but omits the total cost of credit (sum of interest) and, critically, the disclosed APR on an actual/365 basis, which is the non-inferable regulatory quirk the reference requires. |
