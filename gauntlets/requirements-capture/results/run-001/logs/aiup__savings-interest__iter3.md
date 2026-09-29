# aiup — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 15 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It seems the structured question UI didn't go through. Let me put these to you directly instead — you're the stakeholder, so answer in whatever form is easiest and I'll fold your answers into the spec.

The brief names the domain and the interface and nothing else. To compute interest correctly I need your institution's actual policy on the points below. I won't guess these, because each has several plausible answers and getting one wrong makes the numbers wrong.

**The core calculation**

1. **Day-count convention.** How is the annual rate turned into a daily rate? The usual candidates are Actual/365 fixed (÷365 always), Actual/actual (÷366 in leap years, ÷365 otherwise), Actual/360, or 30/360. Which does the institution use?

2. **Simple or compounded.** Within a posting period, do you sum each day's interest on that day's balance with no interest-on-interest (simple), or does accrued interest capitalise and itself earn (daily? monthly?) before posting?

3. **Which daily balance.** Each day in the history has a balance. Do you accrue on the day's closing balance, opening balance, or the minimum balance that day?

4. **Period boundaries.** Is the period half-open `[start, end)` or inclusive of both dates `[start, end]`? Put plainly: do the start day and the end day both earn interest?

**Money and rounding**

5. **Rounding precision, mode and timing.** To what unit is interest rounded (e.g. the currency's minor unit, or more decimal places held internally)? Which mode: half-up, banker's/half-even, or truncate? And is rounding applied to each day's accrual then summed, or applied once to the period total at posting?

6. **Currency / minor units.** What currency, and how many decimal places does a posted amount carry?

**Edge cases the engine has to survive**

7. **Negative balances.** If an account goes negative on some days (overdraft), do those days accrue negative interest, accrue at a different rate, or accrue nothing?

8. **Rate over the period.** A single flat annual rate for the whole period, or can the rate change mid-period (and are there balance-tiered rates where different bands earn different rates)?

9. **Gaps in the daily history.** If the balance history is missing one or more days within the period, what should the engine do: carry the last known balance forward, treat it as an error, or treat missing days as zero?

10. **Posting mechanics.** When `post_interest` runs, does it add the interest to the same account balance and return the new balance? Is it idempotent if run twice for the same period, and what happens if the period has already been posted?

Answer as many as you can. Anything you'd rather I set a sensible default on, say so and I'll record it as an explicit assumption in the spec.
A: All ten answered in order.

1. **Day-count convention.** Actual/360. The daily rate is the annual rate divided by 360, always — no leap-year variant.

2. **Simple or compounded.** Daily compounding within the period. Each day's accrued interest is added to the running base before the next day accrues.

3. **Which daily balance.** End-of-day (closing) balance, but the method is average daily balance: sum every day's closing balance over the period, divide by the number of days in the period, then apply the rate once to that average. Days where the closing balance is below 1,000 contribute zero to the sum but still count as days in the divisor — they do not drop out of the denominator.

4. **Period boundaries.** Half-open [start, end). The start day earns interest; the posting day does not — it opens the next period.

5. **Rounding.** Applied once, to the period total at posting. Mode is floor (truncate down) to 2 decimal places. Never half-up. The sub-cent fraction is retained by the bank, not credited.

6. **Currency / minor units.** [default, not policy] — 2 decimal places (cent-level minor unit). Confirm the currency code and I will record it; the rounding rule above already pins the precision.

7. **Negative balances.** The account never goes negative — this case does not arise by design. Days below the 1,000 minimum qualifying balance accrue zero interest; those days still count in the divisor.

8. **Rate changes mid-period.** Yes, the rate can change mid-period. Each day accrues at the rate in force on that day. Compute the average-balance contribution per rate segment and sum the results across segments.

9. **Gaps in daily history.** [default, not policy] — carry the last known closing balance forward into the gap. If you prefer to treat a gap as a hard error, say so and I will record it as explicit policy.

10. **Posting mechanics.** Net interest (gross less 15% withholding tax) is credited to the same account; the call returns gross interest, tax withheld, net posted, average daily balance used, number of qualifying days, and updated balance. On duplicate posting for the same period: [default, not policy] — recommend rejecting as an error rather than silently re-crediting. Confirm if a different idempotency posture is required.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you, that pins down almost everything. Before I write the spec, I have one genuine conflict to resolve and a few smaller confirmations. I won't paper over the conflict, because it changes the arithmetic materially.

**The conflict: answer 2 vs answers 3 and 8**

Answer 2 says **daily compounding**: each day's accrued interest is added to the running base before the next day accrues (interest-on-interest).

Answer 3 says the method is **average daily balance**: sum the qualifying daily closing balances, divide by the number of days, apply the rate once. Answer 8 extends this per rate segment and sums.

These describe two different and incompatible calculations. The average-daily-balance method applies the rate to a static average, so it produces **simple** interest over the period, no interest-on-interest. It cannot compound daily at the same time. The detail in answers 3 and 8 is specific and self-consistent, so my working assumption is that **average daily balance is the real policy** and "daily compounding" in answer 2 was loose wording. But I need you to confirm, because if you genuinely want daily compounding the whole day-by-day iteration and the returned "average daily balance" figure change.

Which is it:

- **(a)** Average daily balance, simple, rate applied to the average (per segment, summed). Equivalent per-day form: `interest = Σ over each day in [start, end) of qualifying_balance(day) × rate_in_force(day) / 360`. No interest-on-interest. This is what answers 3 and 8 describe.
- **(b)** True daily compounding: iterate day by day, add each day's accrued interest to the base before the next day. Answer 3's "average daily balance" then can't be the accrual method, only a reported statistic.

**Three smaller points**

11. **Tax and rounding order.** You said floor to 2 d.p. applied once to the period total, 15% withholding, and the call returns gross, tax, and net. I want `net = gross − tax` to hold exactly in the returned figures. Proposed order: compute gross at full precision, floor to 2 d.p. → **gross**; tax = floor(gross × 0.15) to 2 d.p. → **tax**; **net = gross − tax**. Does that match your policy, or is tax rounded differently (e.g. net = floor(gross × 0.85), letting tax be the remainder)?

12. **Currency code.** Confirm the ISO currency (you flagged 2 d.p. as a default). What code should I record?

13. **Confirm the two defaults you recommended**, so I can mark them as agreed policy rather than open assumptions: gaps in the daily history → **carry last known closing balance forward**; duplicate posting for an already-posted period → **reject as an error** (no silent re-credit). Good to lock both in?
A: Four points, in order.

**Conflict resolved — it is (a).** Average daily balance, simple, rate applied once to the average (per segment where the rate changes, then summed). The phrase "daily compounding" in answer 2 was imprecise; what I meant is that posted interest joins the account balance and therefore affects the *next* period's average — inter-period compounding, not intra-period. Within a period the accrual is: sum qualifying closing balances, divide by days in the period, apply the rate once. The "not per-day daily-balance" note in my answer 3 was the precise statement; treat answer 2's wording as superseded by it.

**11. Tax and rounding order.** Your proposed sequence is correct: compute gross at full precision, floor to 2 d.p. to get gross; tax = floor(gross × 0.15, 2 d.p.); net = gross − tax. That identity must hold exactly in the returned figures. The alternative (net = floor(gross × 0.85), tax as remainder) is not our policy.

**12. Currency.** [default, not policy] — record USD. Confirm with treasury if a different code is required before go-live.

**13. Both defaults confirmed as agreed policy.** Gaps in daily history: carry the last known closing balance forward. Duplicate posting for an already-posted period: reject as an error, no silent re-credit.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved as `spec.md` in this directory.

It captures the calculation in full: average daily balance, simple within a period, Actual/360, half-open `[start, end)`, the 1,000 qualifying threshold that dilutes rather than drops out of the divisor, per-segment handling of mid-period rate changes, floor-to-2-d.p. rounding, and the gross → tax → net order that keeps `net = gross - tax` exact. There's a worked example, thirteen functional requirements, six NFRs, six constraints, a decisions log tracing each policy back to your answers, and open questions.

Two things worth flagging:

- I resolved the compounding conflict in the spec as you directed: simple within a period, inter-period compounding via the balance. Answer 2's "daily compounding" wording is recorded as superseded.
- One edge case I couldn't infer, logged as an open question rather than guessed: what happens when a gap falls on the very first day of the period, so there's no prior closing balance to carry forward. Carry-forward has nothing to carry. I've suggested treating it as an input error, but it's yours to decide.

The currency (USD) and treasury sign-off are also noted as outstanding.
A: First-day gap: treat it as an input error, as you suggested. Carry-forward requires a prior closing balance; if the gap opens the period there is nothing to carry and the engine cannot construct a valid average. Reject it rather than assume zero — a zero assumption would silently understate interest, which is worse than a clear failure. Record it as agreed policy.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Recorded as agreed policy. `spec.md` is updated:

- **FR-014** requires the engine to reject a first-day gap as an input error.
- The decisions log gains item 14 with the rationale: nothing to carry forward, and a zero assumption would silently understate interest, so a clear failure is preferred.
- That item is removed from open questions, leaving only the treasury currency confirmation outstanding.

The spec is complete. Every material policy the brief omitted is now pinned to your answers and traced in the decisions log.
A: Noted. The spec is complete on my side too — only the treasury currency confirmation remains outstanding, and that is flagged appropriately.

## Produced specification

# Requirements specification: savings interest engine

## Overview

This document specifies the interest engine for savings accounts. The engine
computes the interest an account earns over a posting period from its daily
balance history and an annual interest rate, applies withholding tax, and posts
the net interest to the account.

The public interface is a single function:

```
post_interest(account, period) -> result
```

It computes the interest for `period`, credits the net amount to `account`, and
returns a result carrying the gross interest, tax withheld, net posted, the
average daily balance used, the number of qualifying days, and the updated
balance.

The brief named only the domain and the interface. Every policy decision below
was elicited from the product stakeholder and confirmed. The decisions log at
the end records each one and its rationale.

## The calculation

Interest is computed on the **average daily balance** over the period and is
**simple within the period**. Posted interest joins the account balance, so it
raises the average of the *next* period. There is no interest-on-interest within
a single period.

### Definitions

- The **period** is half-open, `[start, end)`. The start day earns interest; the
  end day (the posting day) does not, because it opens the next period.
- **N** is the number of calendar days in the period, `end - start`.
- **closing_balance(d)** is the end-of-day balance for day `d`. Where the history
  has a gap, the last known closing balance is carried forward into the gap.
- The **minimum qualifying balance** is 1,000 USD. A day is a **qualifying day**
  when its closing balance is at least 1,000 USD.
- **qualifying_balance(d)** is `closing_balance(d)` on a qualifying day, and `0`
  on a non-qualifying day. Non-qualifying days contribute zero to the numerator
  but still count in the divisor `N`.
- **rate(d)** is the annual rate in force on day `d`. The rate may change
  mid-period; each day accrues at the rate in force that day.

### Day-count convention

Actual/360. The daily rate is the annual rate divided by 360, every year, with no
leap-year variant.

### Gross interest

The canonical per-day form, which handles a mid-period rate change directly:

```
gross_raw = sum over d in [start, end) of  qualifying_balance(d) * rate(d) / 360
```

The equivalent average-daily-balance form, for a single flat rate `r`:

```
ADB       = ( sum over d in [start, end) of qualifying_balance(d) ) / N
gross_raw = ADB * r * N / 360
```

Where the rate changes mid-period, compute each rate segment's contribution and
sum them. For segment `s` with rate `r_s` covering day-set `D_s`:

```
gross_raw = sum over segments s of  ( r_s / 360 ) * ( sum over d in D_s of qualifying_balance(d) )
```

The two forms are identical; the per-day form is the reference definition and the
average-daily-balance form is what the returned `average_daily_balance` reports.

### Rounding, tax and net

Rounding is applied once, to the period total, by flooring (truncating down) to
two decimal places. The sub-cent fraction is retained by the bank, never
credited. The order is fixed and the identity `net = gross - tax` must hold
exactly in the returned figures:

```
gross = floor( gross_raw, 2 dp )
tax   = floor( gross * 0.15, 2 dp )     # 15% withholding
net   = gross - tax
```

### Posting

The net interest is credited to the same account:

```
updated_balance = prior_balance + net
```

The result returns gross, tax, net, the average daily balance used, the number of
qualifying days, and the updated balance.

### Worked example

Period `[2026-01-01, 2026-01-11)`, so N = 10 days. Flat annual rate 3.65%.
Closing balance 10,000 USD every day except 2026-01-05, when it is 500 USD.

- Qualifying days: 9 (2026-01-05 falls below the 1,000 threshold).
- Sum of qualifying balances: `9 * 10,000 = 90,000`. Divisor N = 10, so
  `ADB = 9,000`.
- Gross raw: `9,000 * 0.0365 * 10 / 360 = 9.125`. Floored: `gross = 9.12`.
- Tax: `floor(9.12 * 0.15, 2dp) = floor(1.368) = 1.36`.
- Net: `9.12 - 1.36 = 7.76`, credited. Updated balance = prior + 7.76.

## Functional requirements

| ID     | Title                          | User Story                                                                                                                                                                              | Priority | Status |
|--------|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Post interest for a period     | As an accounts system, I want to call `post_interest(account, period)` so that the account is credited the interest it earned over the period.                                          | High     | Open   |
| FR-002 | Average daily balance accrual  | As the bank, I want interest computed on the average of the daily closing balances so that the accrual reflects the balance actually held across the period.                            | High     | Open   |
| FR-003 | Actual/360 day count           | As the bank, I want the daily rate derived as annual rate divided by 360 with no leap-year variant so that accrual follows our money-market convention.                                 | High     | Open   |
| FR-004 | Half-open period boundaries    | As the bank, I want the period treated as `[start, end)` so that the start day earns interest and the posting day opens the next period without being double counted.                   | High     | Open   |
| FR-005 | Minimum qualifying balance     | As the bank, I want days whose closing balance is below 1,000 to contribute zero interest while still counting in the day divisor so that low-balance days dilute the average.          | High     | Open   |
| FR-006 | Mid-period rate changes        | As the bank, I want each day to accrue at the rate in force that day, computed per rate segment and summed, so that a rate change mid-period is applied correctly.                       | High     | Open   |
| FR-007 | Floor rounding at posting      | As the bank, I want the period total floored to two decimal places once at posting so that no sub-cent fraction is credited to the customer.                                            | High     | Open   |
| FR-008 | Withholding tax                | As the bank, I want 15% withholding tax deducted from gross interest so that the net credited to the account is after tax.                                                              | High     | Open   |
| FR-009 | Credit net and update balance  | As an accounts system, I want the net interest credited to the same account so that the returned updated balance reflects the posting.                                                  | High     | Open   |
| FR-010 | Return a detailed result       | As an accounts system, I want the call to return gross interest, tax withheld, net posted, average daily balance used, number of qualifying days, and updated balance so that I can reconcile and report on the posting. | High     | Open   |
| FR-011 | Inter-period compounding       | As the bank, I want posted net interest to remain in the balance so that it raises the average of subsequent periods, giving inter-period compounding.                                  | Medium   | Open   |
| FR-012 | Carry balance forward on gaps  | As the engine, I want to carry the last known closing balance forward across gaps in the daily history so that missing days accrue on the most recent known balance.                    | Medium   | Open   |
| FR-013 | Reject duplicate posting       | As the bank, I want a repeat call for an already-posted period rejected as an error so that interest is never silently credited twice.                                                  | High     | Open   |
| FR-014 | Reject first-day gap           | As the bank, I want a period whose first day has no closing balance to carry forward rejected as an input error so that interest is never silently understated by assuming zero.        | High     | Open   |

## Non-functional requirements

| ID      | Title                        | Requirement                                                                                                                                                              | Category     | Priority | Status |
|---------|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|----------|--------|
| NFR-001 | Monetary precision           | Posted amounts must carry exactly two decimal places; intermediate accrual must be computed at full precision and rounded only once, at posting, per FR-007.             | Correctness  | High     | Open   |
| NFR-002 | Rounding mode                | Rounding must be floor (truncate toward zero) to two decimal places; half-up, half-even and other modes are non-compliant.                                               | Correctness  | High     | Open   |
| NFR-003 | Returned-figure identity     | In every result, `net == gross - tax` and `updated_balance == prior_balance + net` must hold exactly.                                                                    | Correctness  | High     | Open   |
| NFR-004 | Deterministic result         | Given identical account state, history and period, repeated computation (before posting) must produce byte-identical results.                                            | Reliability  | High     | Open   |
| NFR-005 | Divisor integrity            | The day divisor must equal the count of calendar days in `[start, end)` regardless of how many days qualify; non-qualifying days must never be removed from the divisor. | Correctness  | High     | Open   |
| NFR-006 | Auditability                 | Each posting must expose gross, tax, net, average daily balance and qualifying-day count sufficient to reconstruct the figure without re-running the engine.             | Auditability | High     | Open   |

## Constraints

| ID    | Title                       | Constraint                                                                                                                                       | Category | Priority | Status |
|-------|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|----------|--------|
| C-001 | Day-count convention        | Day count is fixed at Actual/360. No configuration switch to another convention is in scope.                                                     | Business | High     | Open   |
| C-002 | Withholding tax rate        | Withholding tax is fixed at 15% of gross interest for this release.                                                                              | Business | High     | Open   |
| C-003 | Minimum qualifying balance  | The qualifying threshold is 1,000 in the account currency.                                                                                        | Business | High     | Open   |
| C-004 | Currency                    | The account currency is USD with a two-decimal minor unit. Recorded as a default pending treasury confirmation before go-live.                   | Business | Medium   | Open   |
| C-005 | Non-negative balances       | Accounts are guaranteed non-negative by design; negative-balance accrual is out of scope and need not be handled.                                | Business | Medium   | Open   |
| C-006 | Simple accrual within period| Interest within a single period is simple (rate applied to the average); intra-period compounding is explicitly out of scope.                    | Business | High     | Open   |

## Decisions log

Each row records a policy the brief omitted, the decision taken, and why. Items
marked "default" were proposed by the engine and accepted by the stakeholder;
treasury sign-off on the currency is still outstanding.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Day count is Actual/360 (annual rate / 360, always). | Stakeholder policy; matches the institution's money-market convention. |
| 2 | Accrual is average daily balance, simple within a period. | Stakeholder resolved the apparent "daily compounding" wording: posted interest joins the balance and compounds *across* periods, not within one. |
| 3 | Accrual uses end-of-day (closing) balance. | Stakeholder policy. |
| 4 | Days below 1,000 contribute zero to the numerator but count in the divisor. | Stakeholder policy; low-balance days dilute the average rather than dropping out. |
| 5 | Period is half-open `[start, end)`; start day earns, posting day does not. | Stakeholder policy; avoids double counting the boundary day across periods. |
| 6 | Round once at posting by flooring to 2 d.p.; bank retains the sub-cent fraction. | Stakeholder policy. |
| 7 | Order is gross = floor(raw); tax = floor(gross * 0.15); net = gross - tax. | Stakeholder policy; guarantees `net = gross - tax` exactly. Net = floor(gross * 0.85) was explicitly rejected. |
| 8 | 15% withholding tax deducted from gross; net credited. | Stakeholder policy. |
| 9 | Rate may change mid-period; accrue per rate segment and sum. | Stakeholder policy. |
| 10 | Negative balances do not arise; not handled. | Stakeholder policy (guaranteed by design). |
| 11 | Gaps in daily history: carry last known closing balance forward. | Default, accepted as policy by the stakeholder. |
| 12 | Duplicate posting for an already-posted period is rejected as an error. | Default, accepted as policy by the stakeholder; prevents double crediting. |
| 13 | Currency is USD, two-decimal minor unit. | Default, accepted pending treasury confirmation before go-live (see C-004). |
| 14 | A first-day gap with no prior closing balance to carry forward is rejected as an input error. | Stakeholder policy; carry-forward has nothing to carry and a zero assumption would silently understate interest, so a clear failure is preferred. |

## Open questions

| # | Question | Owner |
|---|----------|-------|
| 1 | Confirm the ISO currency code (USD assumed). | Treasury |


## Auditor verdict

_The spec covers the method and convention decisions well (1, 4, 5, 6, 7, 12, 13, 14 all correct) but resolves compounding (#2) in the opposite direction from the reference (simple within period vs daily compounding), and entirely omits the lifecycle decisions: posting frequency/anniversary (#3), dormancy (#8), mid-period closure (#9), and escheatment (#10). Edge handling (#11) is only partially addressed (non-negative balances, but no negative-rate rejection or zero-balance no-op). Coverage = 8/14 correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is computed on the **average daily balance** over the period" (The calculation); FR-002 "Average daily balance accrual". | Spec computes ADB = sum of qualifying balances / N and applies the rate to the average once, exactly matching the reference's average-daily-balance method rather than per-day daily-balance. |
| 2 | yes | no | "simple within the period... There is no interest-on-interest within a single period"; Decisions log #2 "posted interest... compounds *across* periods, not within one". | Reference requires DAILY compounding within the period; the spec deliberately resolves it the opposite way (simple within period, compounding only across periods), so the resolution does not match. |
| 3 | no | no | absent | The spec takes a `period` argument but never states the posting frequency; nothing specifies quarterly posting on the account-opening anniversary. |
| 4 | yes | **yes** | "Actual/360. The daily rate is the annual rate divided by 360"; FR-003; C-001. | Days-in-year basis is fixed at 360, matching the reference exactly. |
| 5 | yes | **yes** | "minimum qualifying balance is 1,000 USD... Non-qualifying days contribute zero to the numerator but still count in the divisor `N`"; FR-005; C-003. | Threshold at/above 1,000, days below contribute zero but remain in the divisor, matching the reference precisely. |
| 6 | yes | **yes** | "Rounding is applied once... by flooring (truncating down) to two decimal places. The sub-cent fraction is retained by the bank"; NFR-002. | Posted interest is floored to 2 dp with the fraction kept by the bank, matching the reference rounding rule. |
| 7 | yes | **yes** | "tax = floor( gross * 0.15, 2 dp ) # 15% withholding"; "net = gross - tax"; result returns "tax withheld" separately; FR-008. | 15% withholding deducted from gross, net credited, and tax reported separately in the result, matching the reference. |
| 8 | no | no | absent | The spec contains no dormancy concept: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | No account closure or mid-period pro-rata accrual to a closure date is addressed anywhere in the spec. |
| 10 | no | no | absent | The spec says nothing about escheatment, a 5-year dormancy limit, or remitting the balance to the state. |
| 11 | yes | no | C-005 "Accounts are guaranteed non-negative by design; negative-balance accrual is out of scope"; C-005 non-negative; no mention of negative rate or zero-balance no-op. | The spec covers only the non-overdraft sub-part; it never rejects a negative rate and never states a whole-period zero balance posts a zero no-op, so the multi-part resolution is not fully matched. |
| 12 | yes | **yes** | "The **period** is half-open, `[start, end)`. The start day earns interest; the end day (the posting day) does not, because it opens the next period."; FR-004. | Posting day excluded from the closing period and included in the next via half-open [start, end), matching the reference exactly. |
| 13 | yes | **yes** | "rate(d) is the annual rate in force on day d. The rate may change mid-period... compute each rate segment's contribution and sum them"; FR-006. | Each day accrues at the rate in force that day, computed per rate segment and summed, matching the reference. |
| 14 | yes | **yes** | FR-010 / result returns "gross interest, tax withheld, net posted, average daily balance used, number of qualifying days, and updated balance". | All six required output fields, including the average daily balance and qualifying-day count, are returned per posting, matching the reference reporting shape. |
