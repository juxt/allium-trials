# aiup — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 15 · Captured: 9/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that interactive prompt didn't go through. Let me just ask you directly in writing — same questions. These are the material policy decisions the brief leaves open, each with several standard answers, so I need your institution's specific choices:

**1. Amortization method** — how each instalment's interest/principal split is computed:
- **(a) Equal instalments (annuity)** — fixed total payment each period; interest declines, principal rises.
- **(b) Equal principal** — constant principal each period plus interest on the balance; total payment declines.
- **(c) Interest-only + balloon** — interest each period, full principal in the final instalment.

**2. Interest accrual / day-count convention** — how a period's interest comes from the annual nominal rate:
- **(a) Nominal ÷ 12 per period** — monthly rate flat, applied to outstanding balance, ignoring actual days.
- **(b) Actual/365** — interest proportional to actual days in each period.
- **(c) 30/360** — every month treated as 30 days.

**3. First instalment timing & stub period**:
- **(a) One month after disbursement, no stub** — every period a full month.
- **(b) Fixed due-day with pro-rata stub interest** — partial first period accrues proportional interest.
- **(c) Fixed due-day, no stub interest** — first period always charges a full month.

**4. Rounding & residual reconciliation** (so the balance closes exactly at zero):
- **(a) Round to 2 dp (half-up), final instalment absorbs the residual.**
- **(b) Round to 2 dp, residual spread across instalments.**
- **(c) Full precision, no rounding.**

And a few smaller ones where I'll otherwise take a sensible default unless you say otherwise:

5. **Currency / decimal places** — assume a 2-decimal currency (e.g. the minor unit is cents)?
6. **Business-day adjustment** — if a due date lands on a weekend/holiday, do we shift it (and does shifting affect interest), or do we ignore calendars and keep nominal dates?
7. **Input validation** — any bounds to enforce (e.g. reject non-positive principal, zero/negative term)? And should a **0% interest rate** be supported (straight principal ÷ term)?

Answer whichever you have views on; for any you don't, tell me to use my judgment and I'll record the default explicitly in the spec.
A: Answers in order:

**1. Amortisation method: (b) Equal principal.** Constant principal portion each period (P ÷ n), interest applied to the reducing balance — so the total instalment falls each period. Not an annuity/EMI structure.

**2. Day-count convention: (c) 30/360.** Every month is treated as 30 days, the year as 360. Not actual/365 and not a flat nominal-÷-12 — the 30/360 fraction is applied to the outstanding balance each period.

**3. First instalment and stub: (b) Fixed due-day with pro-rata stub interest.** The first due date is disbursement date plus one month. Where disbursement falls before the first period start (e.g. mid-cycle), interest accrues from the disbursement date and a stub charge is levied for those extra days. Partial-period interest is charged, not waived.

**4. Rounding and residual: closest to (a), but to the whole shilling, not 2 dp.** Each instalment is rounded to the nearest whole shilling (no cents). The accumulated rounding difference is absorbed in the final instalment, which is adjusted so the closing balance is exactly zero. Within each period, interest is rounded first; principal is the remainder.

**5. Currency:** Kenyan shilling (KES). Amounts carried to 2 decimal places internally; instalments presented and charged as whole shillings per the rounding rule above.

**6. Business-day adjustment:** [default, not policy] — no calendar adjustment; due dates are nominal and shifting is not applied.

**7. Input validation:** Reject non-positive principal and zero or negative term with an error. A 0% interest rate: [default, not policy] — support it as a degenerate case (equal principal instalments, no interest component).

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that's clear on the big four. Answers 1, 2, 4, 5 are fully determined, and I'll record 6 and the 0%-rate case explicitly as documented defaults (flagged as my judgment, not stated policy).

One genuine ambiguity remains in **answer 3 (the stub)** that I can't resolve without you — the mechanics materially change the numbers:

**a. What anchors the due-day / "period start"?** Your phrase "disbursement falls before the first period start (e.g. mid-cycle)" implies a fixed monthly anchor day that the schedule aligns to. Is the due-day:
- the day-of-month of (disbursement + 1 month) — i.e. the schedule is anchored to the disbursement day itself (in which case, where does a stub ever arise?), or
- a fixed calendar anchor (e.g. always the 1st, or a product-wide cycle day), so disbursing mid-cycle creates the extra days?

**b. How are the stub's "extra days" counted?** Under 30/360, do I compute stub days with the 30/360 day-count formula (so stub interest = balance × annual rate × stubDays/360), or by actual calendar days for the stub only?

**c. How is the stub charge levied?** Is it:
- added on top of the first regular instalment (first instalment = normal interest + P/n principal + stub interest), or
- billed as a separate stub line/zero-principal entry before instalment 1, or
- folded into instalment 1 by extending its interest period (one combined interest figure for disbursement→first due date)?

**d. During the stub, does principal amortise?** I'm assuming principal repayment only begins at the first regular due date (stub is interest-only on full principal). Confirm?

Once I have these, I'll write the full spec.
A: Good catch — my earlier phrasing implied a fixed cycle anchor that does not exist in this product. Let me correct that.

**(a) Due-day anchor:** The first due date is disbursement date + one month, with subsequent instalments monthly thereafter. The schedule floats with the disbursement date — there is no institution-wide cycle day. Because the period start *is* the disbursement date, a stub period does not arise under the standard rule. My earlier mention of 'mid-cycle disbursement' was imprecise and should be disregarded. No stub charge applies.

**(b), (c), (d):** Moot given the answer to (a). With the first due date anchored to disbursement + one month, the stub scenario cannot occur and no mechanics need to be specified for it.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

**What it covers:** the four material policy decisions you confirmed are recorded as authoritative **[Confirmed]** decisions (P-1…P-9), and the three I resolved with documented defaults are flagged **[Default]** and listed for your review in §10 — so nothing is silently assumed:

- **Amortization:** equal principal (`P ÷ n`), interest on the reducing balance — not an annuity.
- **Day-count:** 30/360 (`rate × 30/360` = `rate ÷ 12` on the outstanding balance).
- **Dating:** first due = disbursement + 1 month, floating with disbursement; **no stub** (your correction is captured in P-3/P-4).
- **Rounding:** whole shillings, half-up, interest rounded first, residual absorbed by the final instalment so the balance closes at exactly zero; 2 dp internally, KES.

The spec also pins down the interface (input `loan` fields + output rows), eight functional requirements in user-story form, the step-by-step computation rules with the closure invariants, two worked examples (one clean, one that exercises the rounding residual and verifies `Σ principal = principal`), measurable NFRs (exact closure, no floating-point drift, determinism), constraints, and the validation table (reject non-positive principal / zero-or-negative term; 0% supported).

Three items need your sign-off before it's release-ready — all in §10: supporting 0% loans (P-10), no business-day adjustment (P-11), end-of-month clamping for due dates (P-12, amount-neutral under 30/360), plus whether `annual_nominal_rate` arrives as a fraction or a percentage at the API boundary. Want me to lock any of those down now?
A: Four items to close:

**P-10 (0% loans):** [Default, not policy] — support it. Equal principal instalments, zero interest component, no special casing required beyond the degenerate arithmetic.

**P-11 (business-day adjustment):** [Default, not policy] — no adjustment. Due dates are nominal; no shifting, no interest recalculation for weekends or holidays.

**P-12 (end-of-month clamping):** [Default, not policy] — clamp to the last day of the month when the disbursement day exceeds the month's length (e.g. disbursed on the 31st, next due date in a 30-day month becomes the 30th). Amount-neutral under 30/360 as you note, so this is a date-display rule only.

**Rate at the API boundary:** [Default, not policy] — accept as a percentage (e.g. `14.5` meaning 14.5% per annum). Divide by 100 internally before applying the 30/360 formula. Document this explicitly at the interface boundary.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done — all four decisions are closed and `spec.md` is updated. It now has **no open items**.

What changed:
- **P-10 / P-11 / P-12** retagged **[Default — accepted]** (reviewed/accepted 2026-11-09, with provenance preserved so it's clear they're accepted defaults rather than hard institutional policy).
- **P-13** added: `annual_nominal_rate` is supplied as a **percentage** (e.g. `14.5` = 14.5%) and divided by 100 internally. This propagated through the interface table (§3.1), the formula (`r = rate ÷ 100`; `m = rate / 1200`, §5), both worked examples (now `12` and `13`), and the validation table (§9).
- **§10** converted from "Open Items for Stakeholder Review" to "Accepted Defaults," with a note on how to re-tag any that later become codified policy.

The spec is complete: every material policy decision (amortization, day-count, dating/stub, rounding, currency, 0% handling, calendar adjustment, date arithmetic, and rate representation) is pinned down with an explicit source, and the closure invariants plus worked examples make it directly testable.
A: Noted — thank you for the thorough summary. The spec looks complete from my end.

## Produced specification

# Requirements Specification — Repayment Schedule Engine

**Feature:** `generate_schedule(loan)` — repayment schedule generation for the loan product
**Status:** Ready for implementation
**Date:** 2026-11-09
**Currency:** Kenyan shilling (KES)

---

## 1. Overview

Given a disbursed loan, the engine produces the full repayment schedule: for every
instalment, the interest due, the principal due, the total instalment, and the running
(outstanding) balance. The product uses an **equal-principal** (reducing-balance)
structure with a **30/360** day-count convention and **whole-shilling** instalments.

This document records the policy decisions that govern the calculation. Decisions are
tagged by source:

- **[Confirmed]** — explicitly decided by the product stakeholder.
- **[Default — accepted]** — not an institutional policy, but a documented default the
  stakeholder has reviewed and accepted (2026-11-09).

---

## 2. Policy Decisions (authoritative)

| # | Decision | Value | Source |
|---|----------|-------|--------|
| P-1 | Amortization method | **Equal principal.** Constant principal portion = `principal ÷ term` each period; interest charged on the reducing balance; total instalment declines over the term. Not an annuity/EMI. | [Confirmed] |
| P-2 | Day-count convention | **30/360.** Every month is treated as 30 days, the year as 360. The per-period interest factor is `annual_rate × 30/360` (= `annual_rate ÷ 12`) applied to the outstanding balance. | [Confirmed] |
| P-3 | First due date & period cadence | First instalment due **disbursement date + 1 month**; subsequent instalments monthly thereafter. The schedule **floats with the disbursement date** — there is no institution-wide cycle anchor day. | [Confirmed] |
| P-4 | Stub / partial first period | **None.** Because the period start is the disbursement date itself, every period is a full 30/360 month. No stub period arises and no stub interest is charged. | [Confirmed] |
| P-5 | Rounding unit | **Whole shilling.** Instalments are presented and charged in whole KES (no cents). | [Confirmed] |
| P-6 | Rounding method | **Half-up** to the nearest whole shilling. | [Confirmed] |
| P-7 | Per-period split order | Within each period, **interest is rounded first**; the principal portion is applied against the balance as described in §5. | [Confirmed] |
| P-8 | Residual reconciliation | The accumulated rounding difference is **absorbed in the final instalment**, whose principal equals the remaining outstanding balance so the **closing balance is exactly zero**. | [Confirmed] |
| P-9 | Internal precision | Amounts carried to **2 decimal places** internally; rounded to whole shillings only for the charged/presented instalment figures per P-5–P-8. | [Confirmed] |
| P-10 | Zero-interest loans | A **0% annual rate is supported** as a degenerate case: equal-principal instalments with no interest component. No special-casing beyond the degenerate arithmetic. | [Default — accepted] |
| P-11 | Business-day adjustment | **None.** Due dates are nominal; no weekend/holiday shifting is applied, and shifting never affects interest. | [Default — accepted] |
| P-12 | Month arithmetic for due dates | Due dates are computed by adding calendar months to the disbursement date, with **end-of-month clamping** (e.g. disbursed on the 31st → due on the last day of shorter months, such as the 30th). Due dates are **presentational only**: under 30/360 with no stub, they do not affect any amount. | [Default — accepted] |
| P-13 | Rate representation at API boundary | `annual_nominal_rate` is supplied as a **percentage** (e.g. `14.5` means 14.5% per annum). The engine divides by 100 internally before applying the 30/360 formula. | [Default — accepted] |

---

## 3. Interface

### 3.1 Input — `loan`

| Field | Type | Rule |
|-------|------|------|
| `principal` | decimal (KES, 2 dp) | Must be **> 0**. |
| `annual_nominal_rate` | decimal (percent) | Annual nominal rate **as a percentage** (e.g. `18` = 18%, `14.5` = 14.5%); divided by 100 internally (P-13). Must be **≥ 0**; `0` supported (P-10). |
| `term_months` | integer | Number of monthly instalments. Must be a **positive integer (≥ 1)**. |
| `disbursement_date` | date | Date the loan was disbursed. Anchors the schedule (P-3). |

### 3.2 Output — schedule

An ordered list of `term_months` rows, one per instalment:

| Field | Type | Description |
|-------|------|-------------|
| `instalment_number` | integer | 1 … `term_months`. |
| `due_date` | date | `disbursement_date + instalment_number` months (P-12). |
| `opening_balance` | decimal (KES) | Outstanding balance at the start of the period. |
| `interest` | integer (KES) | Interest due this period (whole shillings). |
| `principal` | integer (KES) | Principal due this period (whole shillings). |
| `instalment` | integer (KES) | `interest + principal` (whole shillings). |
| `closing_balance` | decimal (KES) | `opening_balance − principal`. Zero on the final row. |

---

## 4. Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Generate schedule | As a loan officer, I want to generate the full repayment schedule for a disbursed loan so that the borrower receives an instalment-by-instalment breakdown of what they owe. | High | Open |
| FR-002 | Per-instalment breakdown | As a borrower, I want each instalment to show the interest due, the principal due, the total instalment, and the remaining balance so that I understand how each payment is applied. | High | Open |
| FR-003 | Equal-principal amortization | As a loan officer, I want principal repaid in equal portions (`principal ÷ term`) with interest charged on the reducing balance so that the schedule follows the product's equal-principal structure and the instalment declines each period. | High | Open |
| FR-004 | 30/360 interest accrual | As a finance controller, I want each period's interest computed as `opening_balance × annual_rate × 30/360` so that interest follows the product's 30/360 convention. | High | Open |
| FR-005 | Disbursement-anchored dating | As a borrower, I want the first instalment dated one month after disbursement and subsequent instalments monthly thereafter so that my due dates follow my disbursement date. | Medium | Open |
| FR-006 | Whole-shilling rounding with residual closure | As a finance controller, I want interest and principal rounded to whole shillings (half-up, interest first) with the final instalment absorbing the accumulated rounding residual so that the schedule collects exactly the original principal and the closing balance is exactly zero. | High | Open |
| FR-007 | Zero-interest loans | As a loan officer, I want a 0% loan to produce an interest-free, equal-principal schedule so that zero-rate loans are handled without error. | Medium | Open |
| FR-008 | Input validation | As a system integrator, I want the engine to reject a non-positive principal and a zero-or-negative term with an error so that malformed loans never produce a schedule. | High | Open |

---

## 5. Computation Rules

Let `P = principal`, `n = term_months`, and `r = annual_nominal_rate ÷ 100` (the
supplied percentage converted to a fraction, P-13).

1. **Monthly interest factor** (P-2):
   `m = r × 30 / 360 = r / 12`   (equivalently `annual_nominal_rate / 1200`).

2. **Base principal portion** (P-1):
   `base_principal = P / n` (not pre-rounded; see step 4).

3. **Initialize:** `balance = P`.

4. **For each period `k` from 1 to `n`:**
   - `opening_balance = balance`.
   - **Interest first** (P-6, P-7): `interest_k = round_half_up(opening_balance × m)` to whole shillings. For a 0% loan this is `0` (P-10).
   - **Principal:**
     - If `k < n`: `principal_k = round_half_up(base_principal)` to whole shillings.
     - If `k = n` (final): `principal_k = opening_balance` — i.e. the entire remaining balance, which absorbs all accumulated rounding residual (P-8).
   - `instalment_k = principal_k + interest_k`.
   - `closing_balance = opening_balance − principal_k`.
   - `balance = closing_balance`.

5. **Closure invariants** (must hold for every valid loan):
   - `closing_balance` of the final row = **0** exactly.
   - `Σ principal_k` over all periods = **`P`** exactly.
   - `opening_balance` of row 1 = `P`; `opening_balance` of row `k` = `closing_balance` of row `k−1`.

> **Note on P-7 ("interest rounded first, principal is the remainder").** For regular
> periods the principal portion is the constant `round(P ÷ n)`; the "interest-first,
> principal-as-remainder" rule is realised exactly at the **final** instalment, where
> interest is computed and rounded normally and principal is taken as the remaining
> balance (the true remainder) so the schedule closes at zero. This is the standard
> equal-principal implementation and is captured by the invariants in step 5.

---

## 6. Worked Example

**Loan:** `principal = 100,000` KES, `annual_nominal_rate = 12` (12%), `term_months = 4`,
`disbursement_date = 2026-01-15`. `r = 0.12`; `m = 0.12 / 12 = 0.01`; `base_principal = 25,000`.

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---|----------|--------:|---------:|----------:|-----------:|--------:|
| 1 | 2026-02-15 | 100,000 | 1,000 | 25,000 | 26,000 | 75,000 |
| 2 | 2026-03-15 | 75,000 | 750 | 25,000 | 25,750 | 50,000 |
| 3 | 2026-04-15 | 50,000 | 500 | 25,000 | 25,500 | 25,000 |
| 4 | 2026-05-15 | 25,000 | 250 | 25,000 | 25,250 | 0 |

**Rounding example** (`principal = 100,000`, `annual_nominal_rate = 13`, `n = 3`;
`r = 0.13`, `m = 0.0108333…`, `round(base_principal) = 33,333`):

| # | Opening | Interest | Principal | Instalment | Closing |
|---|--------:|---------:|----------:|-----------:|--------:|
| 1 | 100,000 | 1,083 | 33,333 | 34,416 | 66,667 |
| 2 | 66,667 | 722 | 33,333 | 34,055 | 33,334 |
| 3 | 33,334 | 361 | **33,334** | 33,695 | 0 |

`Σ principal = 33,333 + 33,333 + 33,334 = 100,000`; the +1 residual is absorbed in the
final instalment (P-8), and the balance closes at exactly 0.

---

## 7. Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Exact closure | For every valid loan, the final `closing_balance` must equal `0` and `Σ principal_k` must equal `principal` exactly, with zero tolerance. | Correctness | High | Open |
| NFR-002 | No floating-point drift | Monetary arithmetic must use decimal or integer-minor-unit representation (not binary floating-point) so results are exact to the stated precision across all inputs. | Correctness | High | Open |
| NFR-003 | Determinism | Identical input must always produce an identical schedule. | Reliability | High | Open |
| NFR-004 | Row count | The schedule must contain exactly `term_months` rows for every valid loan. | Correctness | High | Open |
| NFR-005 | Performance | Generating a schedule for a term of up to 600 instalments must complete within 50 ms on a standard server core. | Performance | Low | Open |

---

## 8. Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Currency | All amounts are Kenyan shillings (KES); charged/presented instalments are whole shillings (no cents). | Business | High | Open |
| C-002 | Day-count convention | Interest must use the 30/360 convention; actual/365 and flat nominal-÷-12-over-actual-days are out of scope. | Business | High | Open |
| C-003 | No calendar adjustment | Due dates are nominal; no business-day/holiday shifting is applied (P-11, documented default). | Business | Medium | Open |

---

## 9. Validation & Error Handling (FR-008)

| Condition | Behaviour |
|-----------|-----------|
| `principal ≤ 0` | Reject with an error; no schedule produced. |
| `term_months ≤ 0` or non-integer | Reject with an error; no schedule produced. |
| `annual_nominal_rate < 0` | Reject with an error. (Value is a percentage, P-13.) |
| `annual_nominal_rate = 0` | Accepted; produces an interest-free equal-principal schedule (P-10). |

---

## 10. Accepted Defaults

The following are **[Default — accepted]** decisions: not institutional policy, but
reviewed and accepted by the stakeholder on 2026-11-09. No open items remain.

- **P-10** — 0% loans supported as a degenerate equal-principal case (no interest component).
- **P-11** — no business-day adjustment; due dates are nominal.
- **P-12** — end-of-month clamping for due-date month arithmetic (amount-neutral under 30/360).
- **P-13** — `annual_nominal_rate` supplied as a percentage, divided by 100 internally.

Should any of these later become codified policy (or change), update the corresponding
P-row and re-tag it **[Confirmed]**.


## Auditor verdict

_The spec correctly resolves 9 of 14 decisions (1, 2, 3, 4, 6, 7, 9, 12, 13), covering all inferable anchors and several bespoke method/rounding choices. It fails on five, mostly the hardest off-default ones: it denies the stub/partial-period interest the reference requires (#5), reinterprets the interest-first/principal-as-remainder rule so regular-period principal is round(P/n) rather than the instalment remainder (#8), omits the Rule-of-78 early-settlement rebate entirely (#10), omits partial-prepayment re-amortisation entirely (#11), and omits the total cost of credit plus the actual/365 APR disclosure quirk while ruling actual/365 out of scope (#14). Coverage = 9/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | P-1/P-2: "interest charged on the reducing balance"; §1 "equal-principal (reducing-balance) structure"; FR-004 interest on opening_balance | The spec applies interest to the reducing outstanding principal each period, which is declining-balance. Matches the reference exactly. |
| 2 | yes | **yes** | P-1: "Equal principal. Constant principal portion = principal ÷ term each period; interest charged on the reducing balance; total instalment declines over the term. Not an annuity/EMI." | Verbatim match to the reference: constant P/n principal, reducing-balance interest, declining instalment, explicitly not EMI. |
| 3 | yes | **yes** | P-2: "30/360. Every month is treated as 30 days, the year as 360."; C-002 excludes actual/365 | The 30/360 convention is stated exactly and actual/365 is explicitly ruled out, matching the reference. |
| 4 | yes | **yes** | FR-004: "each period's interest computed as opening_balance × annual_rate × 30/360"; §5 computes interest once per period k | Interest is computed once per monthly repayment period from the opening balance, not daily accrual. Matches the reference's same-as-repayment-period resolution. |
| 5 | yes | no | P-4: "Stub / partial first period: None... No stub period arises and no stub interest is charged." | The reference requires that if disbursement precedes the first period start a stub interest charge is levied; the spec explicitly denies any stub and charges none. Directly contradicts the reference. |
| 6 | yes | **yes** | Header "Currency: KES"; P-9: "Amounts carried to 2 decimal places internally"; C-001 KES | Currency is KES and amounts are carried to 2 decimal places, matching the reference (an inferable anchor). |
| 7 | yes | **yes** | P-5 whole shilling; P-8: "accumulated rounding difference is absorbed in the final instalment, whose principal equals the remaining outstanding balance" | Each instalment is rounded to the whole shilling and the accumulated residual is settled in the final instalment. Matches the reference exactly. |
| 8 | yes | no | P-7 "interest is rounded first"; §5 note: principal for regular periods = round(P÷n), not remainder; "the interest-first, principal-as-remainder rule is realised exactly at the final instalment" | The interest-rounded-first half matches, but the reference's resolution is that principal is the remainder of the rounded instalment each period; the spec sets principal = round(P/n) for regular periods and explicitly limits the remainder rule to the final instalment, so the literal resolution differs. |
| 9 | yes | **yes** | P-8 "closing balance is exactly zero"; §5 invariant "closing_balance of the final row = 0 exactly"; NFR-001 | The final instalment reconciles to an exactly-zero closing balance. Matches the reference. |
| 10 | no | no | absent | The spec covers only schedule generation and never addresses early full settlement, rebates, or the Rule of 78. Not surfaced. |
| 11 | no | no | absent | No mention of partial prepayment, re-amortisation, or whether term or instalment is held fixed. Not surfaced. |
| 12 | yes | **yes** | §9: "principal ≤ 0 → Reject with an error"; "term_months ≤ 0 or non-integer → Reject"; FR-008 | Zero/negative principal and zero/negative term are rejected as invalid with an error. Matches the reference. |
| 13 | yes | **yes** | P-3: "First instalment due disbursement date + 1 month; subsequent instalments monthly thereafter"; FR-005 | First due date is disbursement + one month with monthly cadence thereafter. Matches the reference. |
| 14 | yes | no | §3.2 lists per-period fields (due_date, opening, interest, principal, instalment, closing); no total cost of credit; no APR; C-002 puts actual/365 "out of scope" | The per-period schedule shape is addressed, but the reference also requires the total cost of credit and a disclosed APR on an actual/365 basis; both are absent, and the spec even rules actual/365 out of scope, contradicting the disclosure quirk. |
