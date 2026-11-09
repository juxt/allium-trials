# aiup — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 20 · Captured: 7/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that interactive prompt didn't go through. No problem — let me just ask you directly in writing. These are the policy decisions I can't responsibly infer, grouped so you can answer inline.

**Computation core**

1. **Day-count convention** — how is the annual rate turned into a daily rate? Actual/365 fixed (÷365 always), Actual/360 (÷360), or Actual/Actual (÷366 in leap years)?
2. **Compounding** — simple interest (accrue daily, sum, post once with no intra-period compounding), daily compounding, or monthly capitalisation within the period?
3. **Rounding** — round once at posting to the minor currency unit (2 dp), round each daily accrual before summing, or truncate (round down) at posting? And which method — half-up, half-even/banker's, or truncate?
4. **Day inclusion** — which days accrue: start-inclusive/end-exclusive, both endpoints inclusive, or start-exclusive/end-inclusive?

**Inputs and representation**

5. **Rate format** — is the annual rate passed as a percent (e.g. `5` = 5%) or a decimal (`0.05`)? Is it a single flat rate for the whole period, or can it be tiered by balance band?
6. **Balance basis** — the "daily balance history": is there exactly one balance per calendar day already (and do we accrue on that day's balance as given), or do we derive a daily balance from dated transactions? Are there gaps/missing days to carry forward?
7. **Currency / precision** — what currency and minor-unit precision (2 dp assumed)? Is the balance stored in major units (dollars) or minor units (cents)?

**Edge cases**

8. **Negative or zero balances** — if a day's balance is zero or negative, does it accrue (e.g. negative/overdraft interest) or is accrual floored at zero?
9. **Posting semantics** — does `post_interest` add the interest to the balance so the returned updated balance = final balance + interest? Does the posted interest itself become part of the balance going forward, and is it recorded as a dated transaction/ledger entry on a specific date?
10. **Zero / empty period** — what should happen for an empty period, a single-day period, or a zero rate — return zero interest and the unchanged balance?

If it's easier, answer only the ones where you have a firm policy and say "use your judgement / document an assumption" for the rest — I'll then write the spec, marking any such items explicitly as assumptions to confirm. What are your answers?
A: 1. **Actual/360** — the daily rate is annual_rate ÷ 360.

2. **Daily compounding** — each day's accrued interest joins the principal base for the next day's accrual within the period.

3. **Truncate (floor) at posting**, applied once to the final gross figure, to 2 dp. No rounding of individual daily accruals. Never half-up; the bank retains the sub-cent fraction.

4. **[start, end)** — start-inclusive, end-exclusive. The posting day is excluded from the period it closes and opens the next one.

5. Rate format is not a fixed policy — pass as a decimal (0.05 = 5%) and treat as a single flat rate per day, not tiered by balance band. Mid-period rate changes are possible; each day uses the rate in force that day. [default for wire format, not policy]

6. One balance figure per calendar day; carry the last known balance forward across any gaps. [default, not policy]

7. 2 dp confirmed. Currency is account-level, not fixed by this policy. Compute and store in major units to 2 dp. [default for currency denomination]

8. Zero or negative balance on a day accrues zero — no overdraft interest. A day below the 1,000 minimum-balance threshold also contributes zero accrual but still counts as a day in the period divisor.

9. Yes — net interest (after withholding) is credited to the balance; the returned updated balance reflects that credit. The posting is a dated ledger entry on the posting date and the credited amount becomes part of the balance going forward.

10. Empty period, zero rate, or zero balance for the whole period: compute normally, which yields zero gross interest, zero tax withheld, zero net — still emit a zero posting record rather than silently skipping. Single-day period: no special case, treat as normal.

### Round 2
_Step reasoning:_ (live agent turn)

Q: That clears up the computation core. Two of your answers introduced policy areas the brief never mentioned — **tax withholding** (answer 9) and a **minimum-balance threshold** (answer 8) — and I need to pin those down before I can specify the posting correctly.

**Tax withholding**

A. **Rate & source** — what withholding rate applies, and where does it come from? Fixed policy rate, account-level attribute, or passed in per call? (Decimal like the interest rate?)
B. **Base & order of operations** — I'm reading it as: accrue daily-compounded gross → truncate gross to 2 dp → compute withholding on that truncated gross → net = gross − tax → credit net. Correct? Or is tax computed on un-truncated gross?
C. **Tax rounding** — how is the tax amount itself resolved to 2 dp — truncate (floor), or round half-up? And does "the bank retains the sub-cent fraction" logic apply here too, or does rounding here favour the customer/tax authority?
D. **Exemptions** — any case where withholding is zero (e.g. tax-exempt account, or gross below a threshold)?

**Minimum-balance threshold**

E. **Value & units** — the 1,000 threshold: is it 1,000 in the account's major currency units, and is it a fixed policy figure or account-level?
F. **Boundary** — strictly `balance < 1000` contributes zero accrual, so exactly `1000.00` *does* accrue? Confirm the comparison is strict.
G. **Interaction with compounding** — when a sub-threshold day contributes zero accrual, does the (unchanged) balance base still carry forward normally, and does a day whose balance sits at/above threshold accrue on the full compounded base including previously accrued interest?

Answer what's firm; say "document as assumption" for anything you'd rather I note and flag.
A: A. **15% fixed policy rate**, applied as a decimal (0.15). It is a fixed policy figure, not an account-level attribute or per-call parameter.

B. Your reading of the order is correct: accrue daily-compounded gross → truncate gross to 2 dp → compute withholding on that truncated gross → net = gross − tax. Tax is computed on the truncated gross, not the untruncated figure.

C. **Truncate (floor)** to 2 dp — the same rule as for gross interest. The bank retains the sub-cent fraction; it does not favour the customer or the tax authority.

D. No exemptions are defined — withholding applies to all accounts at all gross amounts, including a zero posting (where the tax is also zero by arithmetic). [No exemption policy exists; document any account-level override as a future extension if needed.]

E. **1,000 in the account's major currency units**, fixed policy — not an account-level attribute.

F. Confirmed: the comparison is **strict less-than**. A balance of exactly 1,000.00 is at or above the threshold and does accrue normally.

G. The compounding base carries forward unchanged regardless of whether a day's accrual was zeroed by the threshold. Only the interest added that day is suppressed; the balance principal itself is unaffected. A day that returns to at-or-above threshold accrues on the full compounded base, including any previously accrued and capitalised interest from prior qualifying days.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Two more genuinely ambiguous points fall out of combining daily compounding with a transaction-driven daily balance history and the threshold — I want to get these right rather than guess, because they change the number.

H. **Compounding base composition** — the daily balance history reflects principal from deposits/withdrawals, but daily compounding also folds accrued (not-yet-posted) interest into the base. So for day *d*, is the accrual base = *(provided daily balance for day d)* **+** *(cumulative accrued interest from prior in-period days)*? I.e. both external balance movements and intra-period accrued interest feed the next day's base?

I. **What the threshold is compared against** — is the strict `< 1000` test applied to the *provided daily balance* for that day, or to the *effective compounded base* (provided balance + accrued interest carried in)? E.g. a provided balance of 999.50 that, with carried-in accrued interest, reaches 1000.02 — does that day accrue or not?

Once I have these two, I have everything and I'll write the spec.
A: H. Yes — the accrual base for day *d* is the provided daily balance for that day **plus** cumulative accrued interest carried in from all prior in-period days on which interest was not suppressed by the threshold. Both external balance movements and intra-period compounded accrual feed the next day's base.

I. The threshold comparison is against the **provided daily balance** for that day — the balance as reflected by the account's transaction history — not the effective compounded base. In your example, a provided balance of 999.50 is below the threshold regardless of carried-in accrued interest, so that day contributes zero accrual.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is done — saved to `spec.md` in this directory.

A few notes on how it came together:

- The brief named only the domain and the `post_interest(account, period)` interface. Every policy that actually determines the computed number was missing, so I asked rather than guessed. Your answers settled: **Actual/360** day-count, **daily compounding**, **truncate-at-posting** rounding (bank keeps the sub-cent), **half-open `[start, end)`** periods, a **strict `< 1000`** minimum-balance threshold tested against the *provided* balance, an accrual base that folds in carried accrued interest, **no negative-balance interest**, and a **fixed 15% withholding** computed on truncated gross and itself truncated.

- Two policy areas — **tax withholding** and the **minimum-balance threshold** — weren't in the original brief at all; they surfaced from your answers, so I ran follow-up rounds to pin down rate, order of operations, rounding, exemptions, boundary, and compounding interaction.

- The spec's heart is **§4 Interest Computation Policy**, written as an authoritative step-by-step algorithm with a fully worked example (period yields posted interest `0.47`, updated balance `500.47`) that doubles as the primary acceptance test. The FR/NFR/Constraint tables trace back to it.

- Items you flagged as *defaults, not policy* (rate wire format, one-balance-per-day with carry-forward, major-unit precision, currency denomination) are isolated in **§8 Assumptions** and marked `Assumption` in the tables, so they're visibly provisional rather than silently baked in. Four genuinely undecided design details are parked in **§9 Open Questions** (notably a double-posting/idempotency guard).

Worth a look before implementation: OQ-4 — I defined "balance on posting date" as the last known provided balance carried to the end date; confirm that matches your ledger's own end-of-period balance.
A: Received. OQ-4: that definition is consistent with how the ledger works — the end-of-period balance is the last provided balance carried forward to the period's close, not a snapshot taken at an earlier transaction. No discrepancy expected. [default, not policy — confirm with the ledger team before implementation.]

## Produced specification

# Requirements Specification — Savings Account Interest Engine

## 1. Overview

This document specifies the interest engine for savings accounts. The engine computes the
interest an account earns over a period from its daily balance history and an annual interest
rate, applies withholding tax, and posts the net result to the account.

**Interface:** `post_interest(account, period)` — returns the interest posted and the account's
updated balance.

Every material policy decision below was confirmed with the product stakeholder. Items the
stakeholder flagged as *defaults rather than policy* are recorded in
[§8 Assumptions](#8-assumptions) and marked `Assumption` in the tables; they should be
re-confirmed before implementation hardens.

---

## 2. Scope

### In scope
- Daily interest accrual from a per-day balance history over a period.
- Daily compounding of accrued interest within the period.
- A minimum-balance eligibility threshold per day.
- Truncation (floor) rounding of monetary results.
- Fixed-rate withholding tax on gross interest.
- Posting a dated ledger entry and updating the account balance.

### Out of scope
- Account opening/closing, transaction capture, and the production of the daily balance
  history itself (the engine consumes it as input).
- Tiered (balance-band) interest rates.
- Tax exemptions or account-level tax overrides.
- Overdraft / negative-balance interest.
- Multi-currency conversion.

---

## 3. Key Terms

| Term | Definition |
|------|------------|
| Period | A half-open date range `[start, end)` — start date inclusive, end date exclusive. |
| Posting date | The period `end` date. The posting closes this period and opens the next. |
| Daily balance | One balance figure per calendar day, in the account's major currency units, as reflected by the account's transaction history. |
| Provided daily balance | The daily balance for a given day, before any intra-period accrued interest is added. Used for the threshold test. |
| Accrual base | The amount interest is computed on for a day: provided daily balance **plus** carried-in accrued interest. |
| Gross interest | Total accrued interest over the period, before tax. |
| Withholding tax | Tax deducted from gross interest at posting. |
| Net interest | Gross interest minus withholding tax; the amount actually credited. |
| Minor unit | 0.01 of the major currency unit (2 decimal places). |

---

## 4. Interest Computation Policy

This section is the authoritative algorithm. Requirements in §5–§7 reference it.

### 4.1 Day-count convention
- Daily rate for a day = `annual_rate_in_force_that_day / 360` (**Actual/360**).
- The annual rate is a decimal (e.g. `0.05` = 5%).
- The rate may change mid-period; each day uses the rate **in force on that day**.
- The rate is a single flat rate per day — **not** tiered by balance band.

### 4.2 Days that accrue
- Iterate over each day `d` in `[start, end)` — start inclusive, end exclusive.
- Gaps in the balance history carry the last known balance forward.

### 4.3 Daily accrual with compounding
For each day `d` in order:

1. `provided_balance_d` = the provided daily balance for day `d` (carried forward across gaps).
2. `base_d` = `provided_balance_d` + `accrued_so_far`, where `accrued_so_far` is the cumulative
   gross interest accrued on all prior in-period days that were **not** suppressed by the
   threshold. (Both external balance movements and intra-period compounded accrual feed the
   base — **daily compounding**.)
3. **Threshold test** (strict less-than, against the *provided* daily balance, not the base):
   - If `provided_balance_d < 1000` → `interest_d = 0` (day is suppressed).
   - Else → `interest_d = base_d * (rate_d / 360)`.
   - A provided balance of exactly `1000.00` is at/above threshold and **does** accrue.
   - Because the threshold (1000) is above zero, zero and negative provided balances are
     inherently suppressed (no overdraft/negative interest).
4. `accrued_so_far += interest_d`.

No rounding is applied to individual daily accruals; `accrued_so_far` is carried at full
precision throughout.

On a suppressed day the compounding base is unaffected — only that day's interest is withheld
from the accrual. The unchanged principal and all previously accrued-and-capitalised interest
carry forward, and a later at/above-threshold day accrues on that full compounded base.

### 4.4 Gross, tax, and net (resolution order)
After the daily loop, with `gross_full = accrued_so_far` at full precision:

1. `gross = truncate(gross_full, 2)` — **truncate (floor)** to 2 dp. The bank retains the
   sub-cent fraction.
2. `tax = truncate(gross * 0.15, 2)` — withholding computed on the **truncated** gross, at the
   **fixed 15%** policy rate, then **truncated (floor)** to 2 dp. No exemptions.
3. `net = gross - tax`.

`truncate(x, 2)` means round toward zero to 2 decimal places (e.g. `0.555… → 0.55`,
`0.0825 → 0.08`).

### 4.5 Posting
- `net` is credited to the account balance:
  `updated_balance = balance_on_posting_date + net`
  where `balance_on_posting_date` is the last known provided balance carried forward to the
  posting (end) date.
- The credited net interest becomes part of the balance going forward (available to future
  periods' compounding).
- A **dated ledger entry** is recorded on the posting date capturing at least: posting date,
  period `[start, end)`, gross interest, withholding tax, and net interest credited.
- A posting record is **always emitted**, including when all figures are zero (zero gross →
  zero tax → zero net); the engine never silently skips.

### 4.6 Return value
`post_interest` returns:
- the **net interest posted** (the amount credited), and
- the account's **updated balance**.

The full breakdown (gross, tax, net) is persisted in the ledger entry (§4.5).

### 4.7 Boundary behaviour
- **Empty period** (`start == end`), **zero rate**, or **all days below threshold / zero
  balance**: compute normally → gross 0, tax 0, net 0 → emit a zero posting record and leave
  the balance unchanged.
- **Single-day period**: no special case; processed as one iteration of the normal loop.

### 4.8 Worked example (for test derivation)
Period `[2026-01-01, 2026-01-04)` → days Jan 1, 2, 3 (Jan 4 excluded). Flat annual rate `0.05`
→ daily rate `0.05 / 360`. Provided balances: Jan 1 = 2000.00, Jan 2 = 2000.00, Jan 3 = 500.00.

| Day | Provided bal | ≥1000? | Base | Daily interest | Accrued (full precision) |
|-----|-------------:|:------:|-----:|---------------:|-------------------------:|
| Jan 1 | 2000.00 | yes | 2000.000000 | 0.277778 | 0.277778 |
| Jan 2 | 2000.00 | yes | 2000.277778 | 0.277816 | 0.555594 |
| Jan 3 | 500.00  | no  | — (suppressed) | 0.000000 | 0.555594 |

- `gross = truncate(0.555594, 2) = 0.55`
- `tax  = truncate(0.55 * 0.15, 2) = truncate(0.0825, 2) = 0.08`
- `net  = 0.55 - 0.08 = 0.47`
- Posting date Jan 4; balance carried forward = 500.00 → `updated_balance = 500.47`
- Returns: interest posted = `0.47`, updated balance = `500.47`.

---

## 5. Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Post interest | As the bank's ledger system, I want to call `post_interest(account, period)` so that an account's earned interest is computed and credited in one operation. | High | Open |
| FR-002 | Accrue over half-open period | As a product owner, I want interest accrued for each day in `[start, end)` (start inclusive, end exclusive) so that the posting day belongs to the next period and is never double-counted. | High | Open |
| FR-003 | Actual/360 daily rate | As a product owner, I want each day's rate computed as `annual_rate / 360` so that accrual matches our money-market day-count convention. | High | Open |
| FR-004 | Honour mid-period rate changes | As a product owner, I want each day to use the annual rate in force on that day so that rate changes within a period are applied accurately. | Medium | Open |
| FR-005 | Daily compounding | As a product owner, I want each day's accrued interest folded into the next day's accrual base so that interest compounds daily within the period. | High | Open |
| FR-006 | Minimum-balance threshold | As a product owner, I want a day whose provided daily balance is strictly below 1,000 to contribute zero accrual (while still counting as a day in the period) so that only qualifying days earn interest. | High | Open |
| FR-007 | No negative-balance interest | As a risk owner, I want zero or negative daily balances to accrue zero interest so that the bank never pays overdraft/negative interest. | High | Open |
| FR-008 | Truncate gross interest | As a finance controller, I want gross interest truncated (floored) to 2 dp once at posting so that the bank retains sub-cent fractions and never over-pays. | High | Open |
| FR-009 | Apply withholding tax | As a compliance officer, I want 15% withholding computed on the truncated gross and itself truncated to 2 dp so that tax is deducted consistently per policy. | High | Open |
| FR-010 | Credit net interest | As an account holder, I want the net interest (gross minus tax) credited to my balance so that my balance reflects what I actually earned after tax. | High | Open |
| FR-011 | Compound on future periods | As a product owner, I want credited net interest to become part of the balance going forward so that it earns interest in later periods. | Medium | Open |
| FR-012 | Record dated ledger entry | As an auditor, I want every posting recorded as a dated ledger entry capturing gross, tax, and net so that postings are fully traceable. | High | Open |
| FR-013 | Always emit a posting record | As an auditor, I want a posting record emitted even when gross/tax/net are all zero so that no accrual period is silently skipped. | Medium | Open |
| FR-014 | Return posted interest and balance | As the calling system, I want `post_interest` to return the net interest posted and the updated balance so that I can reconcile the result immediately. | High | Open |
| FR-015 | Carry balances across gaps | As the engine, I want missing days in the balance history to carry the last known balance forward so that every day in the period has a defined balance. | Medium | Assumption |
| FR-016 | Handle boundary periods | As the calling system, I want empty periods, zero rates, and single-day periods handled by the normal computation (yielding zero or a normal posting) so that no special-casing is required by callers. | Medium | Open |

---

## 6. Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Full-precision accrual | Daily accruals and the running accrued total must be carried at full (non-truncated) precision; truncation is applied only at the two points defined in §4.4. | Correctness | High | Open |
| NFR-002 | Deterministic results | For identical inputs (account, balance history, rates, period) the function must return identical gross, tax, net, and updated balance on every run. | Correctness | High | Open |
| NFR-003 | Rounding direction | All monetary truncation must round toward zero (floor for non-negative amounts) to exactly 2 decimal places. | Correctness | High | Open |
| NFR-004 | Worked-example conformance | The implementation must reproduce the §4.8 worked example exactly (posted 0.47, balance 500.47). | Testability | High | Open |
| NFR-005 | Idempotent posting guard | A given `(account, period)` must not be postable twice such that interest is credited more than once for the same period. | Integrity | High | Open |
| NFR-006 | Monetary representation | Monetary values must be represented so that no binary floating-point drift affects the 2-dp result (e.g. decimal/fixed-point arithmetic). | Correctness | High | Open |
| NFR-007 | Performance | A single `post_interest` call over a period of up to 366 days must complete in under 50 ms excluding I/O. | Performance | Low | Open |

---

## 7. Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Day-count convention | Day-count is fixed at Actual/360. | Business policy | High | Open |
| C-002 | Compounding frequency | Compounding is fixed at daily within the period. | Business policy | High | Open |
| C-003 | Withholding rate | Withholding tax is a fixed policy rate of 15% (0.15); it is not an account attribute or per-call parameter, and no exemptions exist. | Regulatory/Business policy | High | Open |
| C-004 | Minimum-balance threshold | The minimum-balance threshold is fixed at 1,000 major currency units, compared with strict less-than; it is not an account attribute. | Business policy | High | Open |
| C-005 | Rounding method | All monetary results use truncation (floor) to 2 dp; half-up and banker's rounding are prohibited. | Business policy | High | Open |
| C-006 | Period convention | The accrual period is half-open `[start, end)`. | Business policy | High | Open |
| C-007 | Precision | All amounts are held and posted in the account's major currency units to 2 decimal places. | Technical | High | Assumption |
| C-008 | Rate wire format | The interest rate is supplied as a decimal, flat per day (not tiered). | Technical | Medium | Assumption |
| C-009 | Currency denomination | Currency is an account-level property; this policy does not fix a single currency and does no FX conversion. | Technical | Medium | Assumption |

---

## 8. Assumptions

These were explicitly flagged by the stakeholder as sensible defaults rather than settled
policy. They are used in this spec but should be re-confirmed before implementation.

| # | Assumption | Related |
|---|------------|---------|
| A-1 | Rate is passed as a decimal (`0.05` = 5%), flat per day, not tiered by balance band. | C-008, FR-003 |
| A-2 | The balance history provides exactly one balance per calendar day; gaps carry the last known balance forward. | FR-015, C-007 |
| A-3 | Amounts are computed and stored in major currency units to 2 dp. | C-007 |
| A-4 | Currency is an account-level attribute; no currency is fixed by this policy and no FX applies. | C-009 |

---

## 9. Open Questions / Future Extensions

| # | Item | Notes |
|---|------|-------|
| OQ-1 | Account-level tax override / exemptions | No exemption policy exists today; stakeholder noted this as a possible future extension. |
| OQ-2 | Representation of mid-period rate changes in the input | The policy (each day uses the rate in force) is fixed; the exact input shape for a rate schedule is a wire-format detail to be designed. |
| OQ-3 | Idempotency / re-posting semantics | NFR-005 requires a guard against double-posting a period; the mechanism (e.g. posting log, period lock) is to be designed. |
| OQ-4 | Definition of "balance on posting date" vs. source of truth | Spec uses the last known provided balance carried to the end date; confirm this matches the ledger's own end-of-period balance. |

---

## 10. Traceability Summary

- **Computation policy** (§4) is the single source of truth; FR-002–FR-013 and NFR-001–NFR-006
  each trace to a numbered sub-section of §4.
- The **worked example** (§4.8) is the primary acceptance test (NFR-004).
- **Constraints** C-001–C-006 capture the fixed institutional policies that distinguish this
  engine from a generic interest calculator.


## Auditor verdict

_The spec faithfully captures the arithmetic conventions (360 basis #4, daily compounding #2, 1,000 threshold #5, floor rounding #6, 15% withholding #7, half-open boundary #12, per-day rate-in-force #13) — 7 of 14 correct. It diverges on the core interest method: it uses per-day daily-balance accrual rather than average daily balance (#1 wrong), and its output omits the average-balance and qualifying-days disclosures the reference requires (#14 wrong). The entire lifecycle is explicitly out of scope: posting frequency/anniversary (#3), dormancy (#8), mid-period closure (#9), and escheatment (#10) are all absent. Edge handling (#11) covers zero-balance and no-overdraft but omits negative-rate rejection. Of the core in-focus six [1,2,3,8,9,10], only #2 is correct — method is partly captured but lifecycle coverage is entirely missing, since the engine's scope deliberately excludes the account lifecycle that the reference's lifecycle decisions live in._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | §4.3: 'interest_d = base_d * (rate_d / 360)' computed per day with compounding; §4.8 worked example iterates day-by-day. | The spec uses a per-day daily-balance accrual with daily compounding, not average daily balance (sum of daily balances / days, rate applied once). Method addressed but resolution does not match the reference's average-daily-balance method. |
| 2 | yes | **yes** | §4.3 step 2: 'base_d = provided_balance_d + accrued_so_far ... daily compounding'; FR-005; C-002 'Compounding is fixed at daily within the period.' | Each day's accrued interest folds into the next day's base — daily compounding, matching the reference exactly. |
| 3 | no | no | absent | The spec treats the period as a caller-supplied input and never fixes posting frequency; no mention of quarterly posting or the account-opening anniversary. The reference's quarterly-on-anniversary rule is unaddressed. |
| 4 | yes | **yes** | §4.1 'annual_rate_in_force_that_day / 360 (Actual/360)'; FR-003; C-001. | Day-count fixed at 360, daily rate = annual/360, matching the reference. |
| 5 | yes | **yes** | §4.3 step 3: 'If provided_balance_d < 1000 → interest_d = 0 ... A provided balance of exactly 1000.00 is at/above threshold and does accrue'; FR-006 notes the day 'still counting as a day in the period'. | Threshold value 1,000 with at/above qualifying and below suppressed-but-still-counted matches the reference. The divisor framing is moot given a non-average method, but the threshold resolution matches. |
| 6 | yes | **yes** | §4.4 step 1: 'gross = truncate(gross_full, 2) — truncate (floor) to 2 dp. The bank retains the sub-cent fraction'; C-005 prohibits half-up. | Posted interest floored to 2 dp with the bank keeping the fraction, matching the reference. |
| 7 | yes | **yes** | §4.4 step 2: 'tax = truncate(gross * 0.15, 2) ... fixed 15% policy rate'; net credited (§4.4 step 3, §4.5); tax captured separately in the ledger (§4.5, FR-012); C-003. | 15% withholding deducted from gross, net credited, tax reported separately — matches the reference. |
| 8 | no | no | absent | Dormancy is not addressed; §2 'Out of scope' excludes account lifecycle and transaction capture. No 12-month trigger, continued accrual while dormant, or monthly fee of 5. |
| 9 | no | no | absent | Mid-period closure with pro-rata accrual to the closure date is never addressed; §2 lists account closing as out of scope. §4.7 handles empty/boundary periods generically but not closure semantics. |
| 10 | no | no | absent | Escheatment after 5 years dormant with remittance to the state is entirely absent from the spec. |
| 11 | yes | no | §4.3 step 3 'zero and negative provided balances are inherently suppressed (no overdraft/negative interest)'; §4.7 handles zero rate → zero posting; FR-007. | Zero-balance no-op (zero posting) and no-negative-balance are covered, but the reference also requires a negative rate to be rejected as invalid; the spec handles zero rate yet never rejects a negative rate, so the full resolution is not matched under strict reading. |
| 12 | yes | **yes** | §3 'Period ... [start, end) — start inclusive, end exclusive'; 'Posting date ... closes this period and opens the next'; FR-002. | Half-open period; posting day excluded from the closing period and belongs to the next — matches the reference exactly. |
| 13 | yes | **yes** | §4.1 'The rate may change mid-period; each day uses the rate in force on that day'; FR-004. | Each day uses the rate in force on that day, matching the reference's core resolution. The reference's per-segment average-balance summation is method-specific, but the controlling rule (rate in force per day) is stated and correct. |
| 14 | yes | no | §4.6 returns net interest posted and updated balance; ledger (§4.5) captures gross, tax, net. | Output is addressed and includes gross/tax/net plus updated balance, but the reference specifically requires disclosing the average daily balance used and the number of qualifying days, neither of which the spec reports — so the output shape does not match. |
