# bmad — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 24 · Captured: 8/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. Let me put the same questions in plain text so you can answer however is easiest — just reply inline.

I've split the material policy decisions into two rounds. **Round 1 — the numeric method:**

1. **Day-count convention** — how is the daily rate derived from the annual rate?
   - (a) Fixed /365 (annual ÷ 365 every year), (b) Actual/actual (÷366 in leap years), (c) Actual/360, or (d) 30/360.

2. **Compounding** — does accrued interest itself earn interest during the period?
   - (a) Simple (Σ daily balance × daily rate, no compounding), (b) Daily compounding, or (c) Monthly compounding.

3. **Rounding — when?**
   - (a) Accrue at full precision, round the final figure once at posting, or (b) round each day's accrual to the cent then sum.

4. **Rounding — how?**
   - (a) Half-up, (b) Banker's/half-even, or (c) Truncate.

**Round 2 — period, posting, and edge cases** (answer now too if you like, or after round 1):

5. **Period boundaries** — which days accrue? (a) Both endpoints inclusive, (b) half-open `[start, end)` (start accrues, end excluded), or (c) `(start, end]`.

6. **Posting effect** — does posting add the interest to the balance so the returned updated balance includes it, or is interest tracked separately leaving the balance unchanged?

7. **Negative / overdraft daily balances** — (a) can't happen / not applicable, (b) accrue negative interest at the same rate, (c) floor at zero (no interest on negative days), or (d) a different overdraft rate.

8. **Rate structure** — (a) single flat rate for the whole period, (b) tiered by balance band, or (c) the rate can change mid-period.

Answer as many as you can and I'll fold them into the spec (tagging anything you leave open as an explicit `[ASSUMPTION]` rather than silently guessing).
A: Answers in order:

1. **(c) Actual/360.** The daily rate is annual_rate ÷ 360, applied every day regardless of leap year.

2. **(b) Daily compounding.** Each day's accrued interest joins the base for the following day's accrual within the period.

3. **(a) Accrue at full precision, round once at posting.** No per-day rounding; the full-precision running figure is only rounded at the moment of posting.

4. **(c) Truncate (floor).** Always round down to the minor unit (2 dp). The bank retains the sub-cent fraction; half-up is not used.

5. **(b) Half-open [start, end).** The opening day of a period accrues; the posting day is excluded from the period it closes and becomes the first day of the next period.

6. **Posting adds the net interest to the balance.** The returned updated balance includes the posted amount. Gross interest, tax withheld, and net posted are all reported separately alongside the new balance.

7. **(a) Not applicable.** The account cannot go negative; treat this branch as unreachable.

8. **(c) The rate can change mid-period.** Each day uses the rate in force on that day; compute interest per rate-segment and sum across segments.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Those are clear — thank you. Answer 6 introduced **tax withholding** and answer 8 introduced a **time-varying rate**, both of which open their own material decisions I shouldn't guess. A few targeted follow-ups:

**Tax withholding**
9. **Tax rate** — what is the withholding rate, and where does it come from (a fixed rate, or an attribute carried on the account)?
10. **Tax base & timing** — is tax computed once at posting on the gross interest for the whole period, or accrued/withheld per day or per rate-segment?
11. **Tax rounding** — is withheld tax also **truncated** down to 2 dp like interest, or a different mode? And does `net = gross − tax` where *gross* is the truncated gross, so the three figures reconcile exactly?
12. **Tax-free allowance / threshold** — is there any exempt band (e.g. no tax below a certain interest amount, or a per-account exemption flag), or does tax always apply to all interest?

**The time-varying rate & inputs**
13. **How is the rate supplied?** The signature is `post_interest(account, period)` and the brief mentioned a single "annual interest rate." Given the rate can change mid-period, where does the schedule live — e.g. a list of `(effective_date, annual_rate)` on the `account`, with "rate in force on day *d*" = the most recent effective date ≤ *d*? Please describe the shape of `account` and `period` as you picture them (fields I can rely on).

**Compounding mechanics (so I pin the recurrence exactly)**
14. With **daily compounding + full precision until posting**, I read the daily recurrence as: for each day *d* in `[start, end)`, `interest_base[d] = account_daily_balance[d] + accrued_interest_so_far`, and `accrued += interest_base[d] × (rate_d / 360)`, carried at full precision. Is that right — i.e. unposted accrued interest **does** compound day-to-day, and each day simply uses that day's in-force rate? (Answer 8 said "compute per rate-segment and sum across segments" — I want to confirm that was shorthand for day-by-day accrual, and that compounding still carries *across* segment boundaries rather than each segment being computed independently and summed.)

15. **Daily balance semantics** — is each entry in the daily balance history the day's **closing** balance (the figure that earns that day's interest), and is the history guaranteed to cover every day in `[start, end)`?

Answer what you can; anything left open I'll tag as `[ASSUMPTION]` in the spec.
A: 9. Fixed rate: 15%. It is not an account attribute; every account uses the same rate.

10. Computed once at posting on the gross interest for the whole period. No per-day or per-segment withholding.

11. [default, not policy] Truncate (floor) to 2 dp, consistent with interest rounding. Net is defined as gross − tax (both independently truncated), so the three figures reconcile exactly by construction rather than by coincidence.

12. [default, not policy] No exempt band; tax applies to all posted interest regardless of amount or account flag.

13. [default, not policy] The rate schedule lives on the account as an ordered list of (effective_date, annual_rate) pairs. The rate in force on day d is the annual_rate from the entry with the most recent effective_date ≤ d. The period is a (start_date, end_date) pair where end_date is excluded per the half-open convention. The account also carries: opening_date (to determine posting anniversaries), daily_balance_history (a map of date → closing balance), and rate_schedule as above.

14. Yes to both. The recurrence you described is correct: each day's interest base is the account's closing balance for that day plus the full-precision accrued interest carried forward from earlier days in the period, and the day's accrual uses the rate in force on that day. Compounding carries across rate-segment boundaries without reset — the earlier answer's 'per rate-segment' phrasing was shorthand for per-day rate lookup, not independent segment calculations that are summed at the end.

15. [default, not policy] Yes: each entry in the daily balance history is the closing balance for that day, and the history is guaranteed to cover every calendar day in [start, end).

### Round 3
_Step reasoning:_ (live agent turn)

Q: Perfect — that closes the numeric and tax policy. Three small loose ends from your answer 13 (you mentioned `opening_date` "to determine posting anniversaries"), then I'll draft:

16. **Role of `opening_date` / posting anniversaries** — does `post_interest` itself use `opening_date` to *derive or validate* the period (e.g. assert `end_date` is a legitimate posting anniversary, or reject a misaligned `period`), or does it simply compute over whatever `period` is passed in, with anniversary scheduling being the caller's responsibility? (This decides whether `opening_date` is actually used inside the function.)

17. **Return contract** — confirm the function returns `gross_interest`, `tax_withheld`, `net_interest_posted`, and `updated_balance`. Should it also return the posting date and/or the period covered? And is the `account` mutated in place, or is an updated copy returned (returned-posting + returned-account)?

18. **Degenerate period** — if `[start, end)` is empty (`start == end`) or every daily balance is zero, is the correct result zero gross/tax/net and an unchanged balance?
A: 16. [default, not policy] The function computes over whatever period is passed in. Anniversary scheduling is the caller's responsibility; opening_date does not need to be passed to post_interest and is not used inside it.

17. The function returns: gross_interest, tax_withheld, net_interest_posted, average_daily_balance (used in the calculation), qualifying_days (days where the balance met the minimum threshold), and updated_balance. [default, not policy] Return an immutable result struct rather than mutating the account in place; include the period covered in the return value. The posting date is the caller's concern and need not be echoed back.

18. An empty period (start == end) returns zero for all three interest figures and an unchanged balance — but still records a zero posting rather than returning nothing. The same applies when every daily balance is zero for the whole period: a zero posting is recorded, it is not silently skipped.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Two genuinely new policy elements surfaced in answer 17 that weren't in anything prior — **`qualifying_days` implies a minimum-balance threshold**, and **`average_daily_balance` "used in the calculation"** could mean the interest basis is an average rather than the daily-compounding recurrence we nailed in answer 14. These change the money, so I have to pin them down rather than assume.

19. **Minimum balance threshold** (the thing `qualifying_days` counts):
   - (a) What is the threshold, and is it a fixed global value or a product/account attribute?
   - (b) What happens on a **non-qualifying day** (closing balance below threshold)? Does that day accrue *zero* interest while previously-accrued interest still carries/compounds forward? Or does falling below the threshold forfeit interest more broadly?
   - (c) Is the threshold compared against the day's **closing balance**, or the interest base (balance + accrued interest)?
   - (d) Is `qualifying_days` simply the count of days in `[start, end)` whose balance met the threshold?

20. **`average_daily_balance` vs the daily-compounding recurrence** — this is the one that worries me most. Which actually governs the interest posted?
   - (a) The **daily-compounding recurrence** from answer 14 governs the money, and `average_daily_balance` is just a reported diagnostic (= mean of daily closing balances over the period), **or**
   - (b) the interest is actually computed **from the average daily balance** (e.g. avg balance × rate × days), which would *replace* the per-day compounding we agreed in answer 14.

   If (a), over which days is the average taken — all calendar days in `[start, end)`, or only `qualifying_days`?

These two answers determine the core engine, so I'll hold off drafting until I have them.
A: 19a. Fixed global value: 1,000. Not an account attribute.

19b. A non-qualifying day contributes zero to the interest calculation — its balance does not enter the numerator — but it still counts as a calendar day in the divisor. No broader forfeiture: any interest-bearing balance from earlier qualifying days is unaffected.

19c. The day's closing balance is compared against the threshold.

19d. Yes: qualifying_days is the count of days in [start, end) where closing_balance ≥ 1,000.

20. (b) governs the money, and this corrects answer 14. The interest basis is the average daily balance: sum the closing balances for qualifying days only, divide by the total calendar days in [start, end) (all days count in the divisor regardless of qualification), and apply the rate once — gross = average_daily_balance × (annual_rate / 360) × total_days. The average_daily_balance returned in the result is that quotient: sum(qualifying closing balances) / total_days. The daily-compounding recurrence agreed in answer 14 does not apply; that answer was wrong. Compounding in this product means posted interest joins the principal balance for subsequent quarters, not intra-period daily accrual.

### Round 5
_Step reasoning:_ (live agent turn)

Q: That's a significant correction — noted: answer 20 **supersedes answers 2 and 14**. The engine is average-daily-balance (qualifying balances in the numerator, all calendar days in the divisor), simple within a period; "compounding" only means posted net interest joins principal for subsequent periods.

That leaves exactly one unresolved conflict I need you to settle, because two of your policies now point in different directions:

21. **How does the time-varying rate (answer 8) combine with the average-daily-balance method (answer 20)?** Your formula `gross = average_daily_balance × (annual_rate / 360) × total_days` uses a single rate, but you've said the rate can change mid-period. Which reconciliation is correct?

   - **(A) Per-day rate, one pooled average.** `gross = Σ over qualifying days d of [ closing_balance[d] × (rate_in_force[d] / 360) ]`. Reported `average_daily_balance` = Σ(qualifying closing balances) / total_days. This reduces *exactly* to your single-rate formula when the rate is constant.
   - **(B) Per-segment averages.** Split `[start, end)` into rate segments; for each segment compute its own ADB (segment's qualifying balances ÷ segment's day count) × (segment_rate / 360) × segment_days; sum across segments.
   - **(C) Rate changes can't occur inside a single posting period** (a rate change forces a period boundary upstream), so a single rate always applies here and answer 8 doesn't bite this function.

And one confirmation on the tax arithmetic so the three figures reconcile as you specified in answers 10–11:
22. Tax is computed on the **truncated (reported) gross**: `gross = truncate₂(full-precision gross)`, `tax = truncate₂(gross × 0.15)`, `net = gross − tax`. Correct? (If instead tax should be on full-precision gross, say so.)
A: 21. **(B) Per-segment averages.** Split `[start, end)` into contiguous segments at each rate-change boundary. For each segment: `gross_segment = (Σ qualifying closing balances within the segment / total_calendar_days_in_period) × (segment_rate / 360) × segment_calendar_days`. Sum `gross_segment` across all segments for the total gross. The reported `average_daily_balance` is Σ(all qualifying closing balances across the full period) / total_calendar_days_in_period — a single figure spanning the whole period.

22. Confirmed. `gross = truncate₂(full-precision gross)`, `tax = truncate₂(gross × 0.15)`, `net = gross − tax`. Tax is on the truncated gross, so all three reported figures reconcile exactly.

### Round 6
_Step reasoning:_ (live agent turn)

Q: Everything material is now pinned, and I've logged that **answers 2 and 14 are superseded by 20/21**. One last thing I genuinely can't infer — and it's half the deliverable (the "updated balance"):

23. **Which balance does `net_interest_posted` get added to, to produce `updated_balance`?** Since `end_date` is excluded and the history covers `[start, end)`, the latest known figure is the **closing balance of the last day in the period (`end − 1`)**. So `updated_balance = closing_balance[end − 1] + net_interest_posted`. Is that the intended base, or is there a separate `account.balance` / principal field that net interest should be added to instead?

24. Quick confirm on day counts: `total_calendar_days_in_period = (end_date − start_date)` in days (the count of days in the half-open interval), and each rate segment's `segment_calendar_days` is the day count of that contiguous segment, with the segments partitioning `[start, end)` exactly. Right?

Once I have 23–24 I'll write `spec.md`.
A: 23. [default, not policy] The base is `closing_balance[end − 1]` — the closing balance of the last day in the period — and `updated_balance = closing_balance[end − 1] + net_interest_posted`. There is no separate principal field; the daily balance history is the authoritative record.

24. Confirmed. `total_calendar_days_in_period = end_date − start_date` (the integer day count of the half-open interval). Each rate segment's `segment_calendar_days` is likewise the day count of that contiguous sub-interval, and the segments partition `[start, end)` exactly with no gaps or overlaps.

### Round 7
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory.

A few notes on how it turned out:

- **I asked rather than inferred.** The brief named only the domain and the interface; every material policy decision (day-count, compounding, rounding, period boundaries, posting, tax, thresholds, time-varying rates) came from you. Nothing load-bearing was guessed.
- **Two mid-stream corrections are recorded, not buried.** Your answers 2 and 14 (daily compounding) were superseded by 20/21 (average-daily-balance, no intra-period compounding). The spec states this explicitly at the top and in the decision log so the next reader isn't misled by the earlier intent.
- **Two new policy areas surfaced from your answers and were chased down** rather than left implicit: tax withholding (from answer 6's "net posted") and the minimum-balance threshold (from answer 17's `qualifying_days`). Both turned out to materially change the math.
- **The engine is pinned with a normative worked example** (§10) that exercises the per-segment formula, the threshold, truncation, tax, and the `updated_balance` base — so the arithmetic is unambiguous and testable.
- **Only two things are tagged `[ASSUMPTION]`** (currency is 2-dp; `average_daily_balance` is reported at full precision) — flagged in §9 for you to confirm or override. Everything else is grounded in your answers, cross-referenced in the Appendix A decision log.

One thing worth your eye: the per-segment formula in §6.2 divides each segment by the **whole period's** day count (not the segment's), per your answer 21. I verified it reduces exactly to the single-rate formula and documented why — but if that divisor was a slip rather than intent, it's the one spot I'd double-check before this goes to implementation.
A: Noted — the spec looks well-grounded from this end. On the divisor: intentional, not a slip. Dividing each segment's qualifying balances by the whole period's day count is the policy, so your formula is correct as written.

## Produced specification

---
title: Interest Engine — `post_interest(account, period)` Requirements Specification
status: final
created: 2026-11-09
updated: 2026-11-09
---

# Interest Engine — Requirements Specification

## 1. Overview

This specifies the interest engine for the institution's savings accounts. Given an
account with a daily balance history and a rate schedule, and a posting period,
`post_interest(account, period)` computes the interest the account has earned over the
period, withholds tax, posts the net amount to the balance, and returns a full breakdown.

The interface is fixed by the brief:

```
post_interest(account, period) -> PostingResult
```

Every policy below was decided by the product stakeholder. Where a decision was
explicitly flagged "default, not policy" it is still binding; it is simply a choice the
stakeholder made on sensible grounds rather than a hard regulatory constraint. Items
tagged **[ASSUMPTION]** were inferred by the author and not confirmed — see §9.

> **Superseded decisions.** During elicitation an earlier answer specified *daily
> compounding* with a per-day accrual recurrence. This was explicitly corrected: the
> interest basis is an **average daily balance** method (§6), and there is **no
> intra-period compounding**. "Compounding" in this product means only that posted net
> interest joins the principal for *subsequent* periods (quarters), via the updated
> balance. The daily-accrual recurrence does **not** apply.

## 2. Data model

### 2.1 `account`

| Field | Description |
|---|---|
| `daily_balance_history` | Map of `date -> closing_balance`. The **authoritative** record of funds; there is no separate principal field. Each value is the **closing** balance for that day. |
| `rate_schedule` | Ordered list of `(effective_date, annual_rate)` pairs. |
| `opening_date` | Account opening date. **Not used** by `post_interest` (see FR-16); retained for the caller's anniversary scheduling. |

### 2.2 `period`

A `(start_date, end_date)` pair interpreted as the **half-open interval `[start_date,
end_date)`** — `start_date` is included, `end_date` is excluded (FR-5).

### 2.3 `PostingResult` (return value)

An **immutable** struct. The `account` is **not** mutated in place (FR-17). Fields:

| Field | Description |
|---|---|
| `gross_interest` | Total gross interest for the period, truncated to 2 dp. |
| `tax_withheld` | Tax withheld, truncated to 2 dp. |
| `net_interest_posted` | `gross_interest − tax_withheld`. |
| `average_daily_balance` | The single period-wide quotient used in the calculation (§6.3). |
| `qualifying_days` | Count of days in `[start, end)` whose closing balance met the threshold. |
| `updated_balance` | `closing_balance[end − 1] + net_interest_posted`. |
| `period` | The period covered, echoed back. |

The posting date is **not** echoed back — it is the caller's concern.

## 3. Conventions and constants

| Constant | Value |
|---|---|
| Day-count convention | **Actual/360** — daily rate = `annual_rate / 360`, applied every day regardless of leap years. |
| Minor unit / precision | 2 decimal places (the cent). **[ASSUMPTION]** currency is always 2-dp. |
| Rounding mode | **Truncate (floor toward zero)** to 2 dp. Half-up is never used; the institution retains the sub-cent fraction. |
| Rounding timing | Accrue at **full precision**; truncate only at posting. No per-day rounding. |
| Minimum balance threshold | **1,000** (fixed global value, not an account attribute). |
| Withholding tax rate | **15%** (fixed global value, not an account attribute). |

## 4. Period and rate conventions

- **FR-5 — Half-open period.** Interest is computed over `[start_date, end_date)`. The
  opening day accrues; the posting (end) day is excluded and becomes the first day of the
  next period.
- **FR-8 / FR-13 — Time-varying rate.** The annual rate may change within a period. The
  rate in force on day `d` is the `annual_rate` of the `rate_schedule` entry with the
  most recent `effective_date ≤ d`. The period is split into contiguous **rate segments**
  at each rate-change boundary (§6.2).
- **FR-24 — Day counts.** `total_calendar_days_in_period = end_date − start_date` (the
  integer number of days in the half-open interval). Each segment's
  `segment_calendar_days` is the day count of that contiguous sub-interval. The segments
  **partition `[start, end)` exactly** — no gaps, no overlaps.

## 5. Qualifying days (minimum-balance threshold)

- **FR-19a — Threshold.** A day **qualifies** iff its **closing** balance ≥ **1,000**.
- **FR-19b — Non-qualifying days.** A non-qualifying day contributes **zero** to the
  interest numerator (its balance does not enter the sum) but **still counts** as a
  calendar day in the divisor and in the segment day counts. There is no broader
  forfeiture — interest from other (qualifying) days is unaffected.
- **FR-19d — Reporting.** `qualifying_days` = the count of days in `[start, end)` whose
  closing balance ≥ 1,000.

## 6. Interest calculation (the engine)

### 6.1 Basis

Interest is computed on an **average-daily-balance basis**, with **no intra-period
compounding**. Qualifying closing balances form the numerator; **all** calendar days in
the period form the divisor.

### 6.2 Per-segment gross interest

Split `[start, end)` into contiguous rate segments (FR-8). For each segment `s` with
in-force annual rate `r_s`:

```
Q_s      = Σ (closing_balance[d])  for each day d in segment s where closing_balance[d] ≥ 1,000
gross_s  = (Q_s / total_calendar_days_in_period) × (r_s / 360) × segment_calendar_days[s]
```

> Note the divisor is the **whole period's** total calendar days — not the segment's own
> day count. This is intentional. It reduces exactly to the single-rate formula
> `average_daily_balance × (annual_rate / 360) × total_calendar_days` when the rate is
> constant across the period.

**FR-20 / FR-21 — Total gross (full precision).**

```
gross_full_precision = Σ gross_s   over all segments
```

All of the above is carried at **full precision** — no rounding until §7.

### 6.3 Reported average daily balance

A single figure spanning the whole period:

```
average_daily_balance = Σ (all qualifying closing balances across [start, end)) / total_calendar_days_in_period
```

**[ASSUMPTION]** `average_daily_balance` is reported at full precision (the truncation
policy in §7 was specified only for the three money figures).

## 7. Rounding, tax, and posting

Computed **once at posting**, on the gross interest for the whole period (no per-day or
per-segment tax). Let `truncate₂(x)` floor `x` toward zero to 2 dp.

```
gross_interest      = truncate₂(gross_full_precision)
tax_withheld        = truncate₂(gross_interest × 0.15)        # tax on the truncated gross
net_interest_posted = gross_interest − tax_withheld
```

- **FR-9 — Tax rate.** Fixed 15%, identical for every account.
- **FR-10 — Timing.** Tax computed once at posting on the whole-period gross.
- **FR-11 — Reconciliation.** Because `gross_interest` and `tax_withheld` are each
  independently truncated to 2 dp and `net = gross − tax`, the three reported figures
  reconcile exactly by construction.
- **FR-12 — No allowance.** No tax-free band or per-account exemption; tax applies to all
  posted interest regardless of amount.
- **FR-6 — Posting.** Net interest is added to the balance:
  `updated_balance = closing_balance[end − 1] + net_interest_posted` (FR-23).

## 8. Edge cases and scope

- **FR-18 — Degenerate period.** If `start_date == end_date` (empty interval) **or** every
  daily balance in the period is zero (or all below threshold → gross is zero), the result
  reports **zero** `gross_interest`, `tax_withheld`, and `net_interest_posted`, and an
  **unchanged** balance. A **zero posting is still recorded** and returned — it is never
  silently skipped.
- **FR-7 — Negative balances.** The account cannot go negative. This branch is treated as
  **unreachable**; no overdraft-interest logic is required.
- **FR-16 — No anniversary logic.** `post_interest` computes over whatever `period` is
  passed. It does **not** derive or validate posting anniversaries; `opening_date` is not
  used inside the function. Anniversary scheduling is the caller's responsibility.
- **FR-17 — Immutability.** The function returns an immutable `PostingResult`; it does not
  mutate `account`.

### 8.1 Preconditions (caller-guaranteed)

- `daily_balance_history` contains an entry for **every** calendar day in `[start, end)`
  (FR-15).
- `rate_schedule` has at least one entry with `effective_date ≤ start_date` (so a rate is
  in force for every day of the period).
- All balances are non-negative.

## 9. Open items / assumptions to confirm

1. **[ASSUMPTION]** Currency minor unit is always 2 dp (§3). Revisit for zero-decimal or
   three-decimal currencies.
2. **[ASSUMPTION]** `average_daily_balance` is reported at full precision rather than
   truncated to 2 dp (§6.3).

## 10. Worked example (normative)

Verifies the arithmetic end-to-end.

**Inputs**

- `period = (2025-01-01, 2025-01-11)` → `total_calendar_days_in_period = 10`.
- `rate_schedule`: `(2024-12-01, 0.05)`, `(2025-01-06, 0.07)`.
  → Segment 1 = Jan 1–5 (5 days, 5%); Segment 2 = Jan 6–10 (5 days, 7%).
- Closing balances (threshold 1,000; ✓ = qualifies):

  | Date | Bal | | Date | Bal |
  |---|---|---|---|---|
  | Jan 1 | 2000 ✓ | | Jan 6 | 3000 ✓ |
  | Jan 2 | 2000 ✓ | | Jan 7 | 3000 ✓ |
  | Jan 3 | 500 ✗ | | Jan 8 | 800 ✗ |
  | Jan 4 | 1500 ✓ | | Jan 9 | 2000 ✓ |
  | Jan 5 | 1000 ✓ | | Jan 10 | 2000 ✓ |

**Computation**

- `qualifying_days = 8`.
- Segment 1: `Q₁ = 2000+2000+1500+1000 = 6500`;
  `gross₁ = (6500/10) × (0.05/360) × 5 = 0.45138…`
- Segment 2: `Q₂ = 3000+3000+2000+2000 = 10000`;
  `gross₂ = (10000/10) × (0.07/360) × 5 = 0.97222…`
- `gross_full_precision = 1.42361…`
- `gross_interest = truncate₂(1.42361…) = 1.42`
- `tax_withheld = truncate₂(1.42 × 0.15) = truncate₂(0.213) = 0.21`
- `net_interest_posted = 1.42 − 0.21 = 1.21`
- `average_daily_balance = (6500 + 10000) / 10 = 1650.00`
- `updated_balance = closing_balance[Jan 10] + net = 2000 + 1.21 = 2001.21`

**Result**

```
gross_interest        = 1.42
tax_withheld          = 0.21
net_interest_posted   = 1.21
average_daily_balance = 1650.00
qualifying_days       = 8
updated_balance       = 2001.21
period                = [2025-01-01, 2025-01-11)
```

## Appendix A — Decision log (as elicited)

| # | Decision |
|---|---|
| 1 | Day count: **Actual/360** (annual ÷ 360, every day, leap-year agnostic). |
| 2 | ~~Daily compounding~~ **Superseded by #20/#21** — no intra-period compounding. |
| 3 | Rounding timing: full precision, round **once at posting**. |
| 4 | Rounding mode: **truncate** (floor) to 2 dp. |
| 5 | Period: **half-open `[start, end)`**. |
| 6 | Posting adds **net** interest; report gross, tax, net, balance separately. |
| 7 | Negative balances: **not applicable** (unreachable). |
| 8 | Rate **can change mid-period**; per-day rate lookup, per-segment calc. |
| 9 | Tax rate: **15%**, fixed global. |
| 10 | Tax computed **once at posting** on whole-period gross. |
| 11 | Tax **truncated** to 2 dp; `net = gross − tax`; figures reconcile exactly. |
| 12 | **No** tax-free allowance. |
| 13 | `rate_schedule` = ordered `(effective_date, annual_rate)`; in-force = latest ≤ d. |
| 14 | ~~Daily-accrual recurrence~~ **Superseded by #20/#21**. |
| 15 | Daily balances are **closing** balances; history covers every day in `[start, end)`. |
| 16 | `opening_date` **unused** inside function; anniversary scheduling is the caller's. |
| 17 | Returns **immutable** struct; account not mutated. |
| 18 | Degenerate/zero period → **zero posting recorded**, not skipped. |
| 19 | Threshold **1,000** on closing balance; non-qualifying day → 0 in numerator, still in divisor. |
| 20 | Engine: **average daily balance** (qualifying numerator, all-days divisor). |
| 21 | Multi-rate: **per-segment averages** summed (§6.2). |
| 22 | Tax on **truncated** gross; confirmed. |
| 23 | `updated_balance = closing_balance[end − 1] + net`. |
| 24 | `total_calendar_days = end − start`; segments partition `[start, end)` exactly. |


## Auditor verdict

_The spec thoroughly covers the per-period interest METHOD decisions and conventions: average daily balance (#1), 360 basis (#4), 1,000 threshold (#5), floor rounding (#6), 15% withholding (#7), half-open boundary (#12), mid-period rate segments (#13) and output shape (#14) all match exactly. It fails #2 by explicitly choosing NO intra-period compounding where the reference mandates daily compounding. The three LIFECYCLE decisions (#8 dormancy, #9 mid-period closure, #10 escheatment) are entirely absent, as is the posting cadence #3 (quarterly on anniversary), which the spec deliberately delegates to the caller. #11 is partially surfaced (zero-noop and no-overdraft) but omits rejecting negative rates. Correct: 1, 4, 5, 6, 7, 12, 13, 14 = 8/14 (0.57). The engine-scoped design nails method and conventions but ignores lifecycle entirely._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §6.1: "Interest is computed on an **average-daily-balance basis**, with **no intra-period compounding**." §6.3 reports a single period-wide average; the superseded note explicitly corrects daily-balance to average daily balance. | The spec explicitly uses average daily balance (sum of daily balances / days, rate applied once to the average), matching reference #1, and explicitly rejects per-day daily-balance accrual. |
| 2 | yes | no | §6.1 and the superseded-decisions note: "there is **no intra-period compounding**... The daily-accrual recurrence does **not** apply." Appendix #2/#14 mark daily compounding as superseded. | Reference #2 requires daily compounding within the period; the spec explicitly states there is NO intra-period compounding, the opposite of the reference, so incorrect. |
| 3 | no | no | FR-16: "`post_interest` computes over whatever `period` is passed. It does **not** derive or validate posting anniversaries"; §2.3: "The posting date is **not** echoed back." | The spec deliberately pushes posting cadence (quarterly, on opening anniversary) to the caller and declines to specify it; the quarterly/anniversary rule of reference #3 is never stated, so not surfaced and not correct. |
| 4 | yes | **yes** | §3: "Day-count convention: **Actual/360** — daily rate = `annual_rate / 360`." Appendix #1. | The spec fixes the day-count basis at 360 with daily rate = annual/360, exactly matching reference #4. |
| 5 | yes | **yes** | FR-19a: "A day **qualifies** iff its **closing** balance ≥ **1,000**." FR-19b: non-qualifying day "contributes **zero** to the interest numerator... but **still counts** as a calendar day in the divisor." | Threshold of 1,000, zero contribution on sub-threshold days but still counted in the divisor, matches reference #5 exactly. |
| 6 | yes | **yes** | §3: "Rounding mode: **Truncate (floor toward zero)** to 2 dp. Half-up is never used; the institution retains the sub-cent fraction." | Posted interest floored to 2 dp, never half-up, bank keeps the fraction, matches reference #6 exactly. |
| 7 | yes | **yes** | §7: "`tax_withheld = truncate₂(gross_interest × 0.15)`"; FR-9 fixed 15%; `net_interest_posted` credited and `tax_withheld` reported separately in PostingResult. | 15% withholding deducted at posting, net credited, tax reported separately, matches reference #7 exactly. |
| 8 | no | no | absent — no mention of dormancy, dormant status, 12 months of inactivity, or a monthly dormancy fee anywhere in the spec. | Reference #8 (dormancy after 12 months, interest continues, monthly fee of 5) is entirely unaddressed; the spec is scoped to per-period interest only. |
| 9 | no | no | absent — the spec handles only `post_interest(account, period)` over a passed period; no closure, pro-rata-to-closure-date, or closing-interest logic. | Reference #9 (pro-rata accrual on mid-period closure, posted net at closing) is not surfaced; the engine takes an arbitrary period but says nothing about account closure. |
| 10 | no | no | absent — no mention of escheatment, 5-year dormancy, remittance to the state, or zeroing the balance. | Reference #10 (escheatment after 5 years dormant) is entirely unaddressed. |
| 11 | yes | no | FR-18 zero/below-threshold → zero posting still recorded; FR-7 "The account cannot go negative... treated as **unreachable**." Preconditions require a rate in force but do not reject negative rates. | Zero-balance no-op posting and no-overdraft match the reference, but the spec never rejects a negative rate as invalid (it only assumes a rate is in force), so the full resolution is not matched; strict literal scoring marks incorrect. |
| 12 | yes | **yes** | FR-5: "Interest is computed over `[start_date, end_date)`. The opening day accrues; the posting (end) day is excluded and becomes the first day of the next period." | Half-open [start, end) with posting day excluded from the closing period and included in the next matches reference #12 exactly. |
| 13 | yes | **yes** | FR-8/FR-13: "The rate in force on day `d` is... the most recent `effective_date ≤ d`. The period is split into contiguous **rate segments**"; §6.2 computes per-segment gross and sums. | Each day uses the in-force rate and interest is computed per rate-segment and summed, matching reference #13. |
| 14 | yes | **yes** | §2.3 PostingResult: `gross_interest`, `tax_withheld`, `net_interest_posted`, `average_daily_balance`, `qualifying_days`, `updated_balance` (plus echoed `period`). | The return shape discloses gross, tax withheld, net posted, average daily balance used, qualifying days, and updated balance, matching all elements of reference #14. |
