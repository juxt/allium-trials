# bmad — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 13 · Captured: 8/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question UI was dismissed. No problem — I'll ask in plain text so you can answer conversationally. Here are the material policy decisions the brief leaves open. Each is a genuine fork where your institution has a specific answer I can't safely infer. Answer whichever way your policy dictates; a typical-banking default is noted in parentheses where one exists, but please correct it to your actual policy.

**Rate & accrual basis**
1. **Day-count convention** — daily rate = annual rate ÷ days in year. Actual/365 fixed, Actual/Actual (365 or 366 in leap years), Actual/360, or 30/360? *(retail savings often Actual/365 fixed)*
2. **Compounding within a period** — does accrued interest itself earn interest before posting? Simple accrual (Σ daily balance × daily rate, posted once), daily compounding, or monthly compounding?
3. **Which daily balance earns interest** — end-of-day/closing balance, start-of-day/opening, daily average, or daily minimum? *(often end-of-day closing)*
4. **Period boundaries** — is the accrual window inclusive-start/exclusive-end (1→31 Jan = 30 days), both endpoints inclusive (= 31 days), or exclusive-start/inclusive-end?

**Rounding**
5. **Rounding granularity** — round each day's interest, or accrue at full precision and round only the period total once?
6. **Rounding mode & precision** — half-up, banker's rounding (half-even), or truncate toward zero? And to what unit — whole cents (2 dp), or more decimal places held internally?

**Balance edge cases & rate structure**
7. **Negative / overdrawn balances** — if a day's balance is negative, does it accrue negative interest (reducing the balance), or is interest floored at zero for that day (no debit interest here)?
8. **Rate structure** — is the annual rate a single flat rate, or tiered by balance / subject to a minimum-balance threshold to earn interest? The brief says "an annual interest rate" (singular) — I'll assume flat unless you say otherwise.

**Two things I'll assume unless you correct me** (so you don't have to answer everything):
- **A.** Posting adds the computed interest to the account balance effective the period-end date, and that posted interest forms part of the balance for subsequent periods (compounds period-over-period).
- **B.** The rate is constant for the whole period (no mid-period rate changes within a single `post_interest` call).

If either assumption is wrong — especially B, since variable rates would change the function's inputs — let me know.

Once you answer, I'll write the complete requirements spec to `spec.md`.
A: 1. **Day-count convention**: Actual/360. Daily rate = annual rate ÷ 360.

2. **Compounding within a period**: Daily compounding — each day's accrued interest joins the principal for the following day's accrual within the period.

3. **Which daily balance**: Average daily balance. Sum the end-of-day closing balances over the period, divide by the number of days in the period, apply the rate once to that average. Important caveat: any day the closing balance is below 1,000 contributes zero to the numerator but still counts in the divisor.

4. **Period boundaries**: Inclusive-start, exclusive-end ([start, end)). The posting date opens the next period.

5. **Rounding granularity**: Accrue at full precision throughout; round only once at posting.

6. **Rounding mode & precision**: Truncate (floor) to 2 decimal places. The bank retains any sub-cent fraction — never half-up.

7. **Negative / overdrawn balances**: The account never goes negative by design. Any day with a closing balance below 1,000 (including zero or negative) contributes zero to the interest numerator, but counts as a day in the period divisor. A negative annual rate is rejected as invalid input.

8. **Rate structure**: Flat rate with a minimum-balance threshold. Interest accrues only on days the closing balance is at or above 1,000; days below that threshold contribute zero (as above). No balance-based tiers beyond this floor.

**Assumption A**: Correct.

**Assumption B**: Incorrect — please revise your spec. Mid-period rate changes are supported: each day uses the rate in force on that day, the average-balance interest is computed per rate-segment and the results summed. The function's inputs should accommodate multiple rate segments with effective dates.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that's detailed, and most of it is unambiguous. But three of your answers (#2, #3, and #8) combine into a genuine conflict I can't resolve by inference, so I need one more short round before I can write a correct spec. I'd rather pin the exact arithmetic now than bury a guess in the spec.

**The core tension: "daily compounding" (#2) vs. "average daily balance, rate applied once" (#3).**

These describe two different engines:
- *Daily compounding* is a path-dependent, day-by-day process: each day's interest is computed on a running principal and added to it.
- *Average daily balance × rate, applied once* is a single multiplication against one averaged number — there is no day-by-day compounding inside it.

They can't both be literally true as stated. Here's a worked example to make the fork concrete.

**Example:** 10-day period, flat annual rate 7.2% → daily rate = 7.2% ÷ 360 = 0.0002/day.
- Days 1–5: closing balance 2,000 (qualify)
- Days 6–8: closing balance 500 (below 1,000 → 0 to numerator, still counts in divisor)
- Days 9–10: closing balance 3,000 (qualify)

Divisor N = 10. Σ qualifying balances = (5×2,000) + (2×3,000) = 16,000. **ADB = 16,000 ÷ 10 = 1,600.**

Which of these is your policy?

- **Model 1 — ADB, simple:** interest = ADB × daily_rate × N = 1,600 × 0.0002 × 10 = **3.20**. (Mathematically identical to just Σ qualifying balances × daily rate. Note: under this model the "sub-threshold days still count in the divisor" rule has *no effect on the result* — N cancels out. So this probably isn't what you mean.)
- **Model 2 — ADB compounded daily over the period** *(my best reconciliation of #2 + #3)*: treat the ADB as the principal and daily-compound it across the N days: interest = ADB × ((1 + daily_rate)^N − 1) = 1,600 × ((1.0002)^10 − 1) ≈ **3.2029** → truncates to 3.20. Here the divisor genuinely bites: more sub-threshold days drag the ADB down.
- **Model 3 — true day-by-day compounding on each day's *actual* qualifying balance** (no average at all): each qualifying day accrues balance × daily_rate onto a running principal that itself compounds. This contradicts the "average daily balance" framing in #3.

(At this rate/scale all three round to 3.20, but they diverge materially at higher rates, longer periods, or larger balances — and the code is structurally different in each case, so I need the exact one.)

**Which model is authoritative — 1, 2, or 3?** (If 2, the "average" and "daily compounding" language reconcile cleanly and I'll spec that.)

**Three smaller follow-ups so the spec is exact:**

a) **Rate segments (#8) + the average.** When the rate changes mid-period, is each segment computed with its *own* average — segment's Σ qualifying balances ÷ *that segment's* day-count — and the segment results summed? Or is there one period-wide ADB, with each segment's rate applied to its own days? (Your wording "computed per rate-segment and summed" suggests the former — please confirm, including that each segment's divisor is its own length.)

b) **Threshold vs. accrued interest.** Is the 1,000 floor tested only against the customer's deposited closing balance, or against closing balance *plus* interest accrued so far within the period? (I'll assume deposited closing balance only.)

c) **Degenerate cases.** If every day is below 1,000 (ADB = 0), interest is 0.00 — fine. What about an **empty period (zero days)** — error, or return 0.00? And please confirm **truncation happens once on the final summed total** (sum all segments at full precision, then floor to 2 dp), not per-segment.

Answer these and I'll write `spec.md`.
A: **Model 2** is authoritative: compute the ADB for the period (or segment), treat it as the principal, and compound it daily over the N days in that period. Interest = ADB × ((1 + daily_rate)^N − 1). This is what "interest compounds daily" means in context — the ADB is the base, not a per-day actual balance. Model 1 and Model 3 are both wrong.

**a) Rate segments:** Each segment has its own ADB. For each segment: Σ qualifying closing balances within that segment ÷ that segment's day-count = segment ADB. Apply segment's daily rate with daily compounding over the segment's days. Sum the resulting gross interest figures across segments. Your reading is correct.

**b) Threshold:** The 1,000 floor is tested against the customer's deposited closing balance only — accrued-but-not-yet-posted interest within the period does not count toward it. Your assumption is correct.

**c) Degenerate cases:** An empty period (zero days) returns 0.00 — not an error. [default, not policy] An all-below-threshold period also returns 0.00 (a no-op posting that is still recorded). Truncation to 2 dp happens exactly once, on the final summed total across all segments at full precision — not per segment.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved to `spec.md` in this directory.

A quick summary of what it captures — and why it took two rounds of questions:

**The brief named only the domain and the interface.** Every policy that actually determines the number was omitted, so I asked rather than guessed. Your first-round answers pinned eight decisions (Actual/360, average-daily-balance with a 1,000 floor, half-open period, floor-to-2dp truncation, flat rate, mid-period rate segments, etc.).

**But three of those answers created a genuine conflict** — "daily compounding" (#2) can't be literally true alongside "apply the rate once to the average" (#3). Rather than silently pick a reconciliation, I surfaced it with a worked example and three candidate formulas. You confirmed **Model 2**: the ADB is the compounding base, compounded daily over the period/segment via `ADB × ((1 + daily_rate)^n − 1)`, segments computed independently and summed, truncated once.

The spec records all of this as 14 numbered functional requirements plus NFRs, a two-segment worked example (showing the threshold and truncation in action → `3.70`), edge cases, confirmed assumptions, and two remaining open questions I'd flag before implementation:

- **OQ-1:** behavior when the balance history omits a day in the period (the one correctness gap I couldn't resolve by inference).
- **OQ-2:** the rejection mechanism for a negative rate (error vs. error-result — an implementation choice).

If you can settle OQ-1, the spec is ready to hand to implementation.
A: OQ-1: a day absent from the balance history carries forward the most recent known closing balance. If no prior balance exists (gap at the start of the period), treat that day's balance as zero — it contributes zero to the qualifying numerator and one day to the divisor. [default, not policy]

OQ-2 is an implementation choice — either is acceptable; flag it in code. [default, not policy]

### Round 4
_Step reasoning:_ (live agent turn)

Q: Both resolved and folded in. `spec.md` is **complete** with no remaining open questions.

Final changes:
- **FR-15** (new): missing-day handling — carry forward last known closing balance; gap-at-start → 0. Mirrored into the edge-case table and assumption A-1.
- **§10** retitled to *Implementation Notes* — the negative-rate rejection mechanism (FR-12) is now the one remaining implementation choice, flagged as either-acceptable.

The specification captures the full confirmed policy: Actual/360 day count, average-daily-balance compounded daily as the base (Model 2), the 1,000 minimum-balance floor against deposited balance only, half-open `[start, end)` periods, independent per-segment computation summed across mid-period rate changes, full-precision accrual truncated once to 2 dp, and the degenerate/edge cases — across 15 numbered FRs, NFRs, a worked two-segment example, and recorded assumptions. It's ready to hand to implementation.
A: Noted — the specification is complete and ready for implementation.

## Produced specification

---
title: Savings Interest Engine — Requirements Specification
feature: post_interest(account, period)
status: draft
created: 2026-11-09
updated: 2026-11-09
---

# Savings Interest Engine — Requirements Specification

## 1. Purpose & Scope

Compute and post the interest a savings account earns over a posting period, given the
account's daily end-of-day balance history and the annual interest rate(s) in force during
that period. The engine exposes a single function:

```
post_interest(account, period) -> (interest_posted, updated_balance)
```

It returns the interest posted (a money amount, 2 decimal places) and the account's balance
after that interest is applied.

Every policy decision below was confirmed with the product stakeholder. Items the stakeholder
explicitly flagged as a sensible default rather than a hard policy are tagged `[default]`.
Items still needing confirmation are listed in §10 (Open Questions).

## 2. Interface

### 2.1 Inputs

**`account`**
- Carries a current `balance` (money, 2 dp) that posted interest is added to.
- Provides a **daily balance history**: the end-of-day (closing) balance for each calendar day
  in the period. By design the account never holds a negative balance.

**`period`**
- A half-open date range **`[start, end)`** — the start date **is** included, the end date is
  **not** (see FR-5). `end` is the posting date and simultaneously opens the next period.

**Rate schedule** (supplied as part of, or alongside, the inputs)
- One or more **rate segments**, each with an **effective date** and a **flat annual rate**.
- The rate in force on a given day is the rate of the segment covering that day. The schedule
  partitions the period into contiguous segments (FR-8).
- A single flat rate for the whole period is the degenerate one-segment case.

### 2.2 Output

- **`interest_posted`** — the interest applied to the account, a money amount truncated to 2 dp.
- **`updated_balance`** — `account.balance + interest_posted`.

## 3. Computation Model (authoritative)

Interest is computed **per rate segment**, then summed and posted once. Within a segment the
**average daily balance (ADB)** is the compounding base — **not** each day's actual balance.

For each segment *i*:

1. **Daily rate** (Actual/360):
   `daily_rate_i = annual_rate_i / 360`  (FR-2)

2. **Qualifying balance per day** (minimum-balance floor of 1,000):
   - If a day's **closing balance ≥ 1,000**, it contributes its full closing balance to the
     segment numerator.
   - If a day's **closing balance < 1,000** (including 0), it contributes **0** to the numerator
     but **still counts** as a day in the divisor and in the compounding horizon. (FR-6, FR-7)
   - The 1,000 floor is tested against the customer's **deposited closing balance only**;
     interest accrued earlier in the same period never counts toward it. (FR-7)

3. **Segment average daily balance:**
   `ADB_i = (sum of qualifying closing balances over the segment's days) / n_i`
   where `n_i` = number of days in the segment (including sub-threshold days). (FR-3)

4. **Segment interest — ADB compounded daily over the segment:** (FR-4)
   `interest_i = ADB_i * ((1 + daily_rate_i) ^ n_i - 1)`

5. **Gross interest:** sum across all segments **at full precision**:
   `gross = Σ interest_i`  (FR-9)

6. **Posting amount — truncate once:** floor `gross` to 2 decimal places. The bank retains any
   sub-cent fraction. Rounding is **never** half-up. (FR-10)
   `interest_posted = floor(gross, 2 dp)`

7. **Post:** `updated_balance = account.balance + interest_posted`. The posted interest becomes
   part of the balance for subsequent periods (period-over-period compounding). (FR-11)

## 4. Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR-1** | `post_interest(account, period)` returns `(interest_posted, updated_balance)` where `interest_posted` is a money amount at 2 dp and `updated_balance = account.balance + interest_posted`. |
| **FR-2** | The daily rate uses the **Actual/360** convention: `daily_rate = annual_rate / 360`, applied to the actual number of days accrued. |
| **FR-3** | For each rate segment, compute `ADB = (Σ qualifying closing balances in the segment) / n`, where `n` is the number of days in that segment. The divisor is the segment's **own** day-count. |
| **FR-4** | Segment interest is the ADB **compounded daily** over the segment's `n` days: `ADB * ((1 + daily_rate)^n − 1)`. The ADB is the compounding base; per-day actual balances are not individually compounded. |
| **FR-5** | The period is half-open **`[start, end)`**: the start date is accrued, the end (posting) date is not. Period/segment day-count = `end − start` in whole calendar days. |
| **FR-6** | A day's closing balance **≥ 1,000** qualifies and contributes its full value to the segment numerator. |
| **FR-7** | A day's closing balance **< 1,000** (including 0) contributes **0** to the numerator but **counts** in the divisor `n` and in the compounding exponent. The 1,000 floor is evaluated against the deposited closing balance only — never against accrued interest. |
| **FR-8** | When the annual rate changes mid-period, the period is split into rate segments by effective date. Each segment is computed independently (its own ADB, own `n`, own daily rate, own daily compounding) and the resulting **gross interest figures are summed**. There is no single period-wide ADB and no principal carried across segment boundaries. |
| **FR-9** | All per-segment interest is accumulated at **full precision**; no rounding occurs per day or per segment. |
| **FR-10** | The posting amount is obtained by **truncating (flooring) the final summed gross to exactly 2 decimal places, exactly once**. The sub-cent remainder is retained by the bank. Half-up rounding is prohibited. |
| **FR-11** | The posted interest is added to the account balance effective the period-end date and forms part of the balance available to future periods. |
| **FR-12** | A **negative annual rate** in any segment is **invalid input** and is rejected; no interest is computed or posted. |
| **FR-13** | An **empty period (zero days)** returns `0.00` and is **not** an error. `[default]` |
| **FR-14** | A period in which **every day is below the 1,000 floor** (so every segment ADB = 0) returns `0.00`. This is a recorded no-op posting, not an error. |
| **FR-15** | A day **absent** from the balance history **carries forward** the most recent known closing balance. If no prior balance exists (a gap at the start of the period), that day's balance is treated as **0** — contributing 0 to the qualifying numerator and 1 day to the divisor/compounding horizon. `[default]` |

## 5. Worked Example (two rate segments, threshold, truncation)

10-day period `[D1, D11)`; two rate segments of 5 days each.

**Segment 1 — days 1–5, annual rate 7.2% → `daily_rate = 0.072/360 = 0.0002`**
- Days 1–3: closing 2,000 (qualify). Days 4–5: closing 800 (< 1,000 → 0 to numerator, still 2 days in divisor).
- `Σ qualifying = 3 × 2,000 = 6,000`; `n₁ = 5`; `ADB₁ = 6,000 / 5 = 1,200`.
- `interest₁ = 1,200 × ((1.0002)^5 − 1) ≈ 1,200 × 0.00100040 ≈ 1.200480`.

**Segment 2 — days 6–10, annual rate 3.6% → `daily_rate = 0.036/360 = 0.0001`**
- Days 6–10: closing 5,000 (qualify). `Σ qualifying = 25,000`; `n₂ = 5`; `ADB₂ = 5,000`.
- `interest₂ = 5,000 × ((1.0001)^5 − 1) ≈ 5,000 × 0.00050010 ≈ 2.500500`.

**Gross** = `1.200480 + 2.500500 = 3.700980` (full precision).
**`interest_posted`** = floor to 2 dp = **`3.70`** (bank retains 0.000980).
**`updated_balance`** = `account.balance + 3.70`.

Note how the sub-threshold days in Segment 1 pull `ADB₁` down (divisor stays 5 while two days
contribute 0), which is the intended effect of FR-7.

## 6. Edge Cases & Error Handling

| Case | Behavior | Ref |
|------|----------|-----|
| Zero-day (empty) period | Return `0.00`; no error. `[default]` | FR-13 |
| All days below 1,000 floor | Return `0.00`; recorded no-op posting. | FR-14 |
| A day's closing balance exactly 1,000 | Qualifies (floor is "at or above"). | FR-6 |
| Zero annual rate in a segment | Valid; that segment contributes 0 interest. | FR-2 |
| Negative annual rate in a segment | Reject as invalid input; nothing is posted. | FR-12 |
| Negative closing balance on a day | Not expected (account never goes negative by design); treated as below the floor → 0 to numerator, counts in divisor. | FR-7 |
| Day missing from history | Carry forward last known closing balance; if none yet, treat as 0 (below floor). `[default]` | FR-15 |

## 7. Non-Functional Requirements

- **NFR-1 (Precision):** Intermediate accrual, averaging, and compounding must be carried in
  exact/high-precision decimal arithmetic. Binary floating point is discouraged because the
  final step is a hard truncation to 2 dp (FR-10) and float error can flip the last cent.
- **NFR-2 (Determinism):** For identical inputs the function must return an identical result;
  no dependence on wall-clock time, locale, or evaluation order of segments.
- **NFR-3 (Auditability):** A no-op posting (0.00) is still a recorded posting event (FR-14).

## 8. Assumptions (confirmed or safe defaults)

- **A-1:** Where the daily balance history omits a day in `[start, end)`, the most recent known
  closing balance is carried forward; a gap before any known balance is treated as 0 (FR-15).
- **A-2:** The rate schedule covers the entire period with no gaps or overlaps; the rate in
  force on `start` applies from `start`. Segments are themselves half-open and partition the period.
- **A-3:** Posted interest is added to the balance effective the period-end date and compounds
  into subsequent periods (stakeholder-confirmed Assumption A).
- **A-4:** Money is denominated with 2 minor units ("cents"); the floor in FR-10 is to 2 dp.
- **A-5:** "Days" are whole calendar days; period/segment length = `end − start` in days.

## 9. Out of Scope

- Balance-based rate **tiers** (only the single 1,000 minimum-balance floor applies; no other tiers).
- Debit/overdraft interest (the account never goes negative by design).
- Withholding tax, fees, promotional bonuses, or any adjustment beyond gross interest.
- Reversals, backdated corrections, and re-posting of a prior period.
- Currency conversion / multi-currency accounts.

## 10. Implementation Notes

- **IN-1 (rejection mechanism):** FR-12 rejects a negative rate; either a raised error or an
  error-result object is acceptable. Flag the chosen mechanism clearly in code. `[default]`

All previously open questions are resolved; none remain blocking.


## Auditor verdict

_The spec strongly covers method and convention decisions (1, 2, 4, 5, 6, 12, 13) and the edge-case decision (11), giving 8/14 correct. It fails every lifecycle decision (8 dormancy, 9 closure, 10 escheatment — all absent) and both the withholding-tax (7, explicitly placed out of scope) and output-shape (14, returns only two values) decisions. The posting-cadence decision (3, quarterly on anniversary) is also unaddressed, with period treated as an input parameter. Coverage = 8/14; the in-focus method subset (1, 2, 3) scores 2/3 and the lifecycle subset (8, 9, 10) scores 0/3._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "the **average daily balance (ADB)** is the compounding base — **not** each day's actual balance"; FR-3: "ADB = (Σ qualifying closing balances in the segment) / n" | The spec explicitly adopts average daily balance (sum of daily balances / days) as the base rather than per-day daily-balance, matching the reference method. |
| 2 | yes | **yes** | FR-4: "Segment interest is the ADB **compounded daily** over the segment's `n` days: `ADB * ((1 + daily_rate)^n − 1)`" | Daily compounding within the period is stated directly and matches the reference exactly. |
| 3 | no | no | absent | The posting period is treated as an input parameter `period`; the spec never states that posting is quarterly or falls on the account-opening anniversary. The specific cadence decision is not addressed. |
| 4 | yes | **yes** | FR-2: "the **Actual/360** convention: `daily_rate = annual_rate / 360`" | Days-in-year basis of 360 is stated explicitly, matching the reference. |
| 5 | yes | **yes** | FR-6/FR-7: "closing balance **≥ 1,000** qualifies"; "**< 1,000** ... contributes **0** to the numerator but **counts** in the divisor `n`" | Threshold of 1,000 inclusive, sub-threshold days contribute zero yet remain in the divisor — matches the reference precisely. |
| 6 | yes | **yes** | FR-10: "truncating (flooring) the final summed gross to exactly 2 decimal places ... Half-up rounding is prohibited"; §3.6 "The bank retains any sub-cent fraction" | Floor/truncate to 2 dp with the bank keeping the fraction and no half-up rounding — exact match to the reference. |
| 7 | yes | no | §9 Out of Scope: "Withholding tax, fees, promotional bonuses, or any adjustment beyond gross interest." | The spec addresses withholding tax but explicitly excludes it, the opposite of the reference's 15% deduction at posting with net credit and separate tax reporting. Resolution is wrong. |
| 8 | no | no | absent | No mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. The lifecycle decision is entirely unaddressed. |
| 9 | no | no | absent | Account closure mid-period and pro-rata accrual to the closure date are not mentioned; §9 lists reversals/backdated corrections as out of scope but says nothing about closure. Unaddressed. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormant threshold, or remittance to the state. The lifecycle decision is entirely unaddressed. |
| 11 | yes | **yes** | FR-12: "A **negative annual rate** ... is **invalid input** and is rejected"; FR-14: all-below-floor period "returns `0.00`. This is a recorded no-op posting"; §2.1 "the account never holds a negative balance" | Negative rate rejected, zero/sub-threshold balance yields a recorded zero no-op, and no negative balance — all three parts match the reference. |
| 12 | yes | **yes** | FR-5: "The period is half-open **`[start, end)`**: the start date is accrued, the end (posting) date is not"; §2.1 "`end` ... simultaneously opens the next period" | Half-open [start, end) with the posting day excluded from the closing period and opening the next period — exact match. |
| 13 | yes | **yes** | FR-8: "the period is split into rate segments by effective date. Each segment is computed independently (its own ADB, own `n`, own daily rate ...) and the resulting **gross interest figures are summed**" | Mid-period rate changes are handled by per-segment computation using the rate in force, then summed — matches the reference's per-rate-segment method. |
| 14 | yes | no | §2.2 / FR-1: returns only "`(interest_posted, updated_balance)`" | The output shape is addressed but returns just two values; it omits the reference's required disclosure of gross interest, tax withheld, net, the average daily balance used, and the number of qualifying days. Resolution does not match. |
