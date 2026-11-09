# openspec — savings-interest — iteration 2

Model (author): claude-opus · Questions asked: 15 · Captured: 10/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. I'll ask in plain text — please answer inline. These are the policy decisions that materially change the computed interest and that I can't safely infer:

**1. Day-count basis** (sets daily rate from annual rate)
- (a) Actual/365 Fixed — `annual/365` every day, even in leap years
- (b) Actual/360 — `annual/360`
- (c) Actual/Actual — `/365` normal years, `/366` leap years

**2. Compounding within the period**
- (a) Simple — accrue daily on that day's balance, sum, post once; accrued interest doesn't itself earn interest
- (b) Daily compounding
- (c) Monthly compounding (capitalise at month boundaries)

**3. How period days are counted**
- (a) Half-open `[start, end)` — include start, exclude end date
- (b) Both inclusive `[start, end]`
- (c) Half-open `(start, end]` — exclude start, include end

**4. Rounding of posted interest**
- (a) Round only the final total to the cent, banker's rounding (half-even)
- (b) Round final total, half-up
- (c) Round each daily accrual to the cent, then sum

**5. Which daily balance is used for a given day?** End-of-day (closing) balance, start-of-day (opening) balance, or something else (e.g. lowest balance in the day)?

**6. Minimum balance / rate tiers** — Is the single annual rate applied flat to the whole balance? Or is there a minimum balance to earn any interest, and/or tiered rates by balance band?

**7. Zero or negative daily balances** — On days the balance is zero or negative, does the account earn nothing (floor at zero), or does a negative balance accrue a debit/overdraft charge (possibly at a different rate)?

**8. Posting mechanics** — When interest is posted: does it get **added to the account balance** (becoming principal going forward), and what **date** is it posted (e.g. last day of the period)? And `post_interest` returns the interest posted plus the updated balance — should it also mutate the account, or return a new value?

Answer whichever you have opinions on; for any you'd rather I default, say so and I'll pick the standard retail-savings convention and record it as an assumption.
A: Answers in order:

**1. Day-count basis:** (b) Actual/360. Daily rate is `annual_rate / 360`.

**2. Compounding within the period:** (b) Daily compounding. Each day's accrued interest joins the base for the next day's accrual within the period.

**3. Period day counting:** (a) Half-open `[start, end)`. The posting day is excluded from the period it closes and included in the next period.

**4. Rounding:** None of the listed options exactly. The posted total is floored (truncated down) to 2 decimal places — never half-up, never banker's rounding. The bank retains the fractional remainder.

**5. Which daily balance:** [default, not policy] End-of-day (closing) balance.

**6. Minimum balance / tiers:** There is a minimum balance of 1,000. Interest accrues only on days the balance is at or above that threshold; on days below it, the day contributes zero interest but still counts in the divisor when computing the average. Single flat rate — no tiers.

**7. Zero or negative balances:** A day with a zero (or below-minimum) balance contributes zero to interest accrual; it does not generate an overdraft charge. The account never goes negative — a negative rate is also rejected as invalid.

**8. Posting mechanics:** The net amount (gross interest minus 15% withholding tax) is credited to the account balance on the posting date, becoming principal going forward. The posting date is the quarterly anniversary of account opening, not a calendar quarter-end. On closure mid-period, interest is pro-rated to the closure date and posted as part of closing — the customer does not forfeit the partial period. As for `post_interest` return shape vs mutation: [default, not policy] prefer returning a new value. Policy does require the return to include gross interest, tax withheld, net interest posted, average daily balance, number of qualifying days, and updated balance.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that's rich. Several of your answers interact in ways I want to pin down exactly, because each one moves the posted number at the cent level or changes the function's contract. Six focused follow-ups:

**F1 — Interest method vs. the reported "average daily balance."** Your Q2 answer (daily compounding, accrued interest joins the base) and your Q6/Q8 answers (an "average daily balance" with a "divisor") describe two different things. Confirming my reading: **interest is computed by daily compounding on a running base** — each qualifying day accrues `running_base × rate/360` and that interest is added to `running_base` for the next day. The **average daily balance is a reported figure only**, not an input to the interest calculation. Correct?

**F2 — Exact definition of the reported average daily balance.** Which numerator?
- (a) Σ(closing balance over **all** days in the period) ÷ total days — below-minimum days' actual balances are included in the numerator; or
- (b) Σ(closing balance over **qualifying days only**) ÷ total days — below-minimum days contribute **0** to the numerator but still count in the divisor.

And "number of qualifying days" = count of days with closing balance ≥ 1,000; the divisor = total days in the `[start, end)` period. Confirm both.

**F3 — Compounding base: gross, and the threshold test.** Daily compounding adds each day's **gross (pre-tax)** accrued interest to the running base (the 15% tax is withheld only once, at posting). And the 1,000 threshold is tested against the **customer's closing balance**, excluding accrued-but-unposted interest (accrued interest can't push a day over the threshold). Correct?

**F4 — Order of flooring vs. withholding, so the three figures reconcile.** The return reports gross, tax withheld, and net posted. Please fix the exact order. My proposal:
`gross = floor(full_precision_accrual, 2dp)` → `tax = floor(0.15 × gross, 2dp)` → `net = gross − tax` (so `gross = tax + net` exactly, net is what credits the balance, bank keeps sub-cent remainders of both floors). Is that the order, or should net be `floor(0.85 × gross_full, 2dp)` with gross/tax derived from it?

**F5 — Shape of the balance history and gaps.** Is the account's balance history **one explicit entry per calendar day**, or a **sparse list of `(date, balance)` change-points** where the last balance carries forward until the next change? If sparse, confirm carry-forward. And if the history doesn't cover the whole `[start, end)` period (gap at the start, or missing days): error, carry forward, or treat as zero? (Also: negative annual rate → raise/invalid, you said — should a negative closing balance appearing in the input likewise be rejected as invalid, since the account can't go negative?)

**F6 — Who owns the period boundaries and posting date.** Does `post_interest` **derive** the posting date itself from the account's opening date (compute the quarterly anniversary, and detect closure), or does the **caller** pass `period` with `end` already set to the posting date (the anniversary, or the closure date for a mid-period closure) and the function simply accrues over `[period.start, period.end)` and posts at `period.end`? And confirm `updated_balance = (account balance as of the posting date) + net_interest`.
A: F1 — Confirmed, with one clarification. Daily compounding on a running base is the calculation; the ADB is an algebraically equivalent formulation of the same number and is the value returned in the output. For a constant balance with all days qualifying, sum-of-daily-accruals, ADB × rate × days/360, and standard compound interest are all equal; the equivalence holds by extension when non-qualifying days contribute 0 to the ADB numerator (as F2 covers). There is no separate reporting-only ADB: the figure in the output is derived from the same daily running-base values used to compute the posted amount.

F2 — Confirmed both. Option (b): non-qualifying days contribute 0 to the ADB numerator; all days (qualifying or not) count in the divisor. Qualifying-day count = number of days in [start, end) where the customer closing balance ≥ 1,000. Divisor = total days in [start, end).

F3 — Confirmed both. The running base grows each qualifying day using gross (pre-tax) accrued interest; withholding is applied only once at posting. The 1,000 threshold is tested against the customer's closing balance (transaction ledger only, excluding accrued-but-unposted interest). Accrued interest cannot lift a below-minimum day over the threshold.

F4 — Confirmed in the order you proposed: gross = floor(full-precision accrual, 2 dp) → tax = floor(0.15 × gross, 2 dp) → net = gross − tax (exact integer-arithmetic subtraction). gross = tax + net always holds exactly. The bank retains the sub-cent remainders discarded by both floor operations.

F5 — [default, not policy] Sparse (date, balance) change-points with carry-forward is the assumed shape. A gap at the very start of the period (no entry on or before period.start) is an error; require a balance entry covering the period start. A negative closing balance in the input is rejected as invalid — the account cannot go negative per policy.

F6 — [default, not policy] The caller passes period with end already set to the posting date (quarterly anniversary or closure date). post_interest accrues over [period.start, period.end) and posts at period.end. updated_balance = customer ledger balance as of period.end (before posting) + net_interest.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory. **It is done.**

It captures every policy you settled, each one that couldn't have been inferred from the brief:

- **Actual/360** day-count (`annual_rate / 360`)
- **Daily compounding** on a running base, using **gross** interest; the 1,000 threshold tests the ledger balance only, so accrued interest can't lift a day over it
- **Half-open `[start, end)`** periods; `end` is the caller-supplied posting date, excluded from this period
- **Floor to 2 dp** in the exact order `gross → tax = floor(0.15 × gross) → net = gross − tax`, so `gross = tax + net` holds and the bank keeps the sub-cent remainders
- **Minimum balance 1,000** — below-minimum days contribute 0 interest and 0 to the ADB numerator but still count in the divisor; flat rate, no tiers
- **15% withholding** at posting; net becomes principal; closure pro-rated by the caller via `period.end`
- **Validation**: negative rate, uncovered period start, negative balances, and `start > end` are all rejected
- A **normative worked example** with full numbers, plus a decision log flagging the three implementation-default choices (closing balance, sparse carry-forward/gap handling, return-vs-mutate).

One point I flagged and resolved in-spec rather than silently: your F1 called the ADB an "algebraically equivalent formulation," but under daily compounding with a varying balance the compounded accrual and `ADB × rate × days/360` aren't identically equal. Following your primary F1 instruction, the spec makes the **daily-compounded running base the computation of record** for the posted amount and treats the **ADB purely as a reported statistic** (defined per F2). If you actually intended the ADB formula to drive the posted figure, that's the one thing to redirect me on — otherwise the spec is internally consistent across all eight answers.
A: Redirect on the one open point. The ADB formula is the computation of record: sum the closing balances over all days in [start, end), divide by the number of days in the period, apply the annual rate once to that average. The posted gross is derived from that single application, not from a running compounding base. Daily compounding (the separate policy) describes how posted interest joins the principal at each quarterly posting — it governs the relationship between successive periods, not the within-period accrual. The spec needs updating on this: replace the daily-compounding running base with the ADB × rate calculation as the source of the posted amount, and treat the ADB as both the input to and the output of that calculation. Everything else in your summary stands.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The only match is the intended "No day-by-day compounding" clarification. The spec is updated and consistent. **It is done.**

The redirect is now the computation of record in `spec.md`:

- **§3 — Interest method rewritten.** The posted gross is `ADB × annual_rate × N/360`, the rate applied **once** to the average — no within-period running base. I kept F2 intact, so the ADB numerator is qualifying-day balances only; because that divisor `N` cancels the day-count numerator `N`, the formula reduces exactly to `(Σ qualifying-day closing balances) × annual_rate / 360`, which I noted explicitly.
- **Daily compounding reframed as a between-period effect.** §2 and the new R3.5 state that compounding is realised when posted **net** interest becomes principal at the posting date, raising later periods' balances (and ADB); `post_interest` computes a single period and cross-period compounding emerges from the caller re-posting net interest into the ledger.
- **ADB is now both input and output** (§1.2, §3, §5.1) rather than a reporting-only statistic.
- **Worked example reworked** to the ADB derivation. The floored figures are unchanged — `gross = 1.16`, `tax = 0.17`, `net = 0.99`, `ADB = 1400.00`, `qualifying_days = 4`, `updated_balance = 1500.99` — since `7000 × 0.06 / 360 = 1.1666…` still floors to `1.16`.
- **Decision log** updated: row 2 now records the simple ADB×rate method, with a new row 2a for between-period compounding.

Everything else you confirmed (Actual/360, half-open `[start, end)`, floor-then-withhold order with `gross = tax + net`, the 1,000 minimum with F2's numerator/divisor split, validation rules, caller-owned posting date, and the three implementation-defaults) stands unchanged.
A: Confirmed. The spec is complete and consistent.

## Produced specification

# Specification — Savings Account Interest Engine

`post_interest(account, period)` — compute the interest a savings account earns over a
period, withhold tax, post the net amount, and return a full breakdown.

This document is the authoritative behavioural contract. Every figure below reflects a
deliberate institution policy, not a default; where a value was left to implementer
discretion it is marked **[implementation default]**.

---

## 1. Interface

```
post_interest(account, period) -> InterestPosting
```

The call is **pure with respect to its inputs**: it does not mutate `account` or `period`.
It returns a new `InterestPosting` value. The caller is responsible for persisting the
updated balance.

### 1.1 Inputs

**`account`**
| Field | Meaning |
|---|---|
| `annual_rate` | Annual nominal interest rate as a decimal fraction (e.g. `0.06` = 6%). |
| `balance_history` | **Sparse** list of `(date, balance)` change-points, in currency units. The balance is the **end-of-day closing balance** (transaction ledger only). Each entry holds until the next-dated entry; the value **carries forward** on days with no entry. |

**`period`**
| Field | Meaning |
|---|---|
| `start` | First date of the accrual period (inclusive). |
| `end` | The **posting date** — the quarterly anniversary of account opening, or the closure date on a mid-period closure. The period is **half-open `[start, end)`**: `end` is *excluded* from this period's accrual and belongs to the next period. |

The caller owns period construction. `post_interest` does **not** derive the quarterly
anniversary or detect closure; it accrues over exactly `[start, end)` and posts at `end`.
**[implementation default]**

### 1.2 Output — `InterestPosting`

| Field | Definition |
|---|---|
| `gross_interest` | Gross interest accrued, floored to 2 dp (§4). |
| `tax_withheld` | 15% withholding tax, floored to 2 dp (§4). |
| `net_interest` | `gross_interest − tax_withheld`, the amount actually credited. |
| `average_daily_balance` | The ADB (§5) — both the input to the interest calculation and a returned figure. |
| `qualifying_days` | Count of days in `[start, end)` whose closing balance ≥ minimum (§5). |
| `updated_balance` | Ledger balance as of `end` (before posting) + `net_interest` (§6). |

---

## 2. Policy constants

| Constant | Value | Source policy |
|---|---|---|
| Day-count denominator | **360** | Actual/360: `daily_rate = annual_rate / 360`. |
| Compounding | **Across periods** | Within a period, accrual is **simple**: the rate is applied once to the ADB (§3). Compounding is realised **between** periods — posted **net** interest becomes principal at each posting date and so raises the balances (and ADB) of later periods. |
| Minimum qualifying balance | **1,000** | A day earns interest only if its closing balance ≥ 1,000. |
| Withholding tax rate | **15%** (`0.15`) | Applied once, at posting, to gross interest. |
| Currency precision | **2 dp** | |
| Rounding mode | **Floor (truncate down)** | Never half-up, never banker's. The bank retains discarded sub-cent remainders. |

---

## 3. Interest computation (the computation of record)

The posted gross is the **average daily balance applied once to the rate**, scaled by the
Actual/360 day-count fraction. There is **no** within-period compounding. The ADB is **both
the input to and an output of** this calculation (§5.1) — it is the same figure in each role.

```
N = number of days in [start, end)                 # half-open day count

qualifying_sum = 0                                  # Σ closing balances on qualifying days
for each day d in [start, end):                     # iterate start .. end-1
    cb = closing_balance(d)                          # carry-forward from balance_history
    if cb >= 1000:                                   # threshold tests the LEDGER balance only
        qualifying_sum += cb

ADB           = (N == 0) ? 0 : qualifying_sum / N
gross_accrual = ADB * annual_rate * N / 360          # full precision; rate applied once
              = qualifying_sum * annual_rate / 360   # algebraically identical (the N cancels)
```

Rules this encodes:

- **R3.1** The rate is applied **once** to the ADB, scaled by the Actual/360 fraction `N/360`,
  where `N` is the number of days in `[start, end)`. No day-by-day compounding within the
  period.
- **R3.2** The ADB used here is the same ADB returned in the output (§5.1): numerator = sum of
  **qualifying-day** closing balances, divisor = `N` (all days in the period). Because the
  divisor `N` and the day-count numerator `N` cancel, the gross equals
  `qualifying_sum × annual_rate / 360`.
- **R3.3** The 1,000 threshold is tested against the **customer closing balance only** (`cb`),
  excluding any accrued or previously posted-but-not-yet-reflected interest. (Across periods,
  prior net interest has already been posted into the ledger, so it is part of `cb`.)
- **R3.4** A non-qualifying day contributes **0** to `qualifying_sum` — hence 0 to the ADB
  numerator and 0 to the accrual — while still counting toward the divisor `N`.
- **R3.5** Compounding is realised **between** periods, not within one: the net interest
  posted at `period.end` (§6) becomes principal and is reflected in the closing balances —
  and therefore the ADB — of subsequent periods. `post_interest` computes a single period;
  cross-period compounding emerges from the caller posting net interest into the ledger before
  the next call.

---

## 4. Tax withholding and rounding

Applied **once**, after full-precision accrual, in this exact order:

```
gross_interest = floor(accrued, 2dp)              # truncate down to the cent
tax_withheld   = floor(0.15 * gross_interest, 2dp)
net_interest   = gross_interest - tax_withheld    # exact subtraction
```

- **R4.1** `gross_interest = tax_withheld + net_interest` holds **exactly** (net is defined by
  subtraction, not independent rounding).
- **R4.2** Both floors discard sub-cent remainders; those remainders are retained by the bank
  and are **not** credited to the customer.
- **R4.3** Tax is computed on the **floored gross**, not on the full-precision accrual.

> Implementation note: perform money arithmetic in integer minor units (cents) or an exact
> decimal type. Full-precision accrual (§3) should use a decimal type with ample precision;
> only the three figures above are floored.

---

## 5. Reported statistics

### 5.1 Average daily balance (ADB)

```
ADB = ( sum of closing_balance(d) over QUALIFYING days d in [start, end) )
      / ( total number of days in [start, end) )
```

- **R5.1** Numerator: only days with `closing_balance ≥ 1,000` contribute; a non-qualifying
  day contributes **0** to the numerator.
- **R5.2** Divisor: **all** days in `[start, end)` — qualifying or not — count toward the
  divisor.
- **R5.3** If `[start, end)` contains **0** days, `ADB = 0`.

### 5.2 Qualifying days

- **R5.4** `qualifying_days` = count of days `d` in `[start, end)` with
  `closing_balance(d) ≥ 1,000`.

---

## 6. Posting and updated balance

- **R6.1** The net amount is credited to the account on the posting date (`period.end`) and
  becomes principal going forward.
- **R6.2** `updated_balance = closing_balance(end) + net_interest`, where
  `closing_balance(end)` is the carry-forward ledger balance as of `period.end` **before**
  posting.
- **R6.3** The function returns the updated balance; it does **not** mutate `account`.
  **[implementation default]**
- **R6.4** Mid-period closure is handled entirely by the caller setting `period.end` to the
  closure date; interest is thereby pro-rated to closure and posted as part of closing. The
  customer does not forfeit the partial period. No special-casing inside `post_interest`.

---

## 7. Validation and error handling

`post_interest` rejects the following as invalid (raise an error; do not post):

- **R7.1** `annual_rate < 0` — negative rates are invalid.
- **R7.2** No balance entry on or before `period.start` — the period start must be covered by
  the balance history (gap-at-start is an error, not carry-from-nothing). **[implementation default]**
- **R7.3** Any closing balance applicable within `[start, end)` is negative — the account
  cannot go negative per policy. **[implementation default]**
- **R7.4** `period.start > period.end` — malformed period.

Permitted (not errors):

- **R7.5** `period.start == period.end` (empty period): 0 days → all interest/tax/net = 0,
  `ADB = 0`, `qualifying_days = 0`, `updated_balance = closing_balance(end) + 0`.
- **R7.6** Every day below the minimum: `accrued = 0` → gross = tax = net = 0.
- **R7.7** Below-minimum balances (≥ 0 and < 1,000) are valid; they simply contribute 0 to
  accrual and 0 to the ADB numerator.

---

## 8. Worked example (normative)

Inputs:
- `annual_rate = 0.06` → `daily_rate = 0.06 / 360 = 0.0001666…`
- `period = [2026-01-01, 2026-01-06)` → 5 days: Jan 1, 2, 3, 4, 5
- `balance_history` (sparse): `2025-12-20 → 2000`, `2026-01-03 → 500`, `2026-01-04 → 1500`

Carry-forward closing balances:

| Day | Closing balance | Qualifies (≥1000)? | Contributes to ADB numerator |
|---|---|---|---|
| Jan 1 | 2000 | yes | 2000 |
| Jan 2 | 2000 | yes | 2000 |
| Jan 3 | 500  | no  | 0 |
| Jan 4 | 1500 | yes | 1500 |
| Jan 5 | 1500 | yes | 1500 |

Calculation:
- `N = 5`, `qualifying_sum = 2000 + 2000 + 1500 + 1500 = 7000` (Jan 3 contributes 0)
- `ADB = 7000 / 5 = 1400.00`
- `gross_accrual = ADB × annual_rate × N/360 = 1400 × 0.06 × 5/360 = 1.16666…`
  (equivalently `7000 × 0.06 / 360 = 1.16666…`)
- `gross_interest = floor(1.16666…, 2) = 1.16`
- `tax_withheld   = floor(0.15 × 1.16, 2) = floor(0.174, 2) = 0.17`
- `net_interest   = 1.16 − 0.17 = 0.99`
- `qualifying_days = 4`
- `closing_balance(2026-01-06) = 1500` (carry-forward from Jan 4) → `updated_balance = 1500 + 0.99 = 1500.99`

---

## 9. Decision log (provenance)

| # | Decision | Value |
|---|---|---|
| 1 | Day-count | Actual/360 |
| 2 | Interest method | Simple: `gross = ADB × annual_rate × N/360` (= `Σ qualifying-day balances × rate / 360`), rate applied once; ADB is both input and output |
| 2a | Compounding | Between periods only — posted net interest becomes principal for later periods; no within-period compounding |
| 3 | Period bounds | Half-open `[start, end)`; `end` = posting date, excluded from this period |
| 4 | Rounding | Floor to 2 dp; bank keeps the remainder |
| 5 | Daily balance | End-of-day (closing) ledger balance *[implementation default]* |
| 6 | Minimum balance | 1,000; below-minimum day earns 0, counts in ADB divisor, 0 in ADB numerator; single flat rate, no tiers |
| 7 | Zero/negative | Below-minimum → 0 accrual, no overdraft charge; negative balance invalid; negative rate invalid |
| 8 | Posting | Net = gross − 15% tax, credited at `period.end`, becomes principal; closure pro-rated by caller; returns breakdown, no mutation *[implementation default for shape]* |


## Auditor verdict

_10 of 14 decisions correct (coverage 0.71). Strong on method/convention and edge decisions (1, 3, 4, 5, 6, 7, 11, 12, 14) and on mid-period closure (9). Three failures are missing lifecycle/temporal decisions entirely absent from the spec: dormancy (8), escheatment (10), and mid-period rate changes (13). One failure is a direct contradiction: the reference requires daily within-period compounding (2), but the spec explicitly adopts simple within-period accrual with compounding only between periods. On the core in-focus six [1,2,3,8,9,10] the spec scores 3/6 (1, 3, 9 correct; 2, 8, 10 wrong), revealing a gap in lifecycle coverage and a method mismatch on compounding._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "The posted gross is the average daily balance applied once to the rate, scaled by the Actual/360 day-count fraction"; "ADB = (N == 0) ? 0 : qualifying_sum / N"; "gross_accrual = ADB * annual_rate * N / 360 ... rate applied once". §9 log #2: "Simple: gross = ADB × annual_rate × N/360". | Spec uses average daily balance (sum of balances ÷ days) with the rate applied once to the average, explicitly not per-day daily-balance. Matches the reference method exactly. |
| 2 | yes | no | §2: "Compounding: Across periods. Within a period, accrual is simple: the rate is applied once to the ADB. Compounding is realised between periods"; R3.1 "No day-by-day compounding within the period"; §9 #2a "no within-period compounding". | Reference requires daily compounding within the period (each day's interest joins the base for the next day). The spec explicitly adopts simple within-period accrual with compounding only between periods, the direct opposite. Addressed but contradicts the reference value. |
| 3 | yes | **yes** | §1.1: "end — The posting date — the quarterly anniversary of account opening". §9 #3: "end = posting date". | Spec states posting occurs on the quarterly anniversary of account opening (not calendar quarter-ends), matching the reference, even though it delegates derivation of that date to the caller. |
| 4 | yes | **yes** | §2: "Day-count denominator 360 ... Actual/360: daily_rate = annual_rate / 360". §9 #1: "Day-count Actual/360". | Spec uses 360 as the day-count basis with daily_rate = annual_rate / 360, exactly matching the reference. |
| 5 | yes | **yes** | §3 R3.4: "A non-qualifying day contributes 0 to qualifying_sum ... while still counting toward the divisor N"; §2: "A day earns interest only if its closing balance ≥ 1,000"; §5 R5.1/R5.2. | Threshold of 1,000; days below it contribute zero to accrual/numerator yet still count in the divisor N. Matches the reference precisely. |
| 6 | yes | **yes** | §2: "Rounding mode Floor (truncate down). Never half-up, never banker's. The bank retains discarded sub-cent remainders." §4 R4.2. | Posted interest is floored to 2 dp, never half-up, with the fraction kept by the bank. Exact match. |
| 7 | yes | **yes** | §2: "Withholding tax rate 15% ... Applied once, at posting, to gross interest"; §4: "tax_withheld = floor(0.15 * gross_interest, 2dp); net_interest = gross_interest - tax_withheld"; output field tax_withheld. | 15% withholding deducted from gross at posting, net credited, tax reported as a separate output field. Matches the reference (tax computed on floored gross rather than full-precision gross is a minor variant, still 15% of gross). |
| 8 | no | no | absent | The spec never mentions dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. Not addressed. |
| 9 | yes | **yes** | §6.4: "Mid-period closure is handled entirely by the caller setting period.end to the closure date; interest is thereby pro-rated to closure and posted as part of closing. The customer does not forfeit the partial period." §1.1 "or the closure date on a mid-period closure". | On closure between posting dates, interest is pro-rated to the closure date and posted (net of withholding) as part of closing, with no forfeiture. Matches the reference. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy-to-state trigger, remittance of funds, or closure to zero balance. Not addressed. |
| 11 | yes | **yes** | §7 R7.1: "annual_rate < 0 — negative rates are invalid"; R7.3/§7 "the account cannot go negative"; R7.6: "Every day below the minimum: accrued = 0 → gross = tax = net = 0"; §7.5 empty-period zero posting. | Negative rate rejected, zero/below-minimum balance posts zero interest (a recorded zero no-op), and no overdraft/negative balance permitted. Matches the reference. |
| 12 | yes | **yes** | §1.1: "The period is half-open [start, end): end is excluded from this period's accrual and belongs to the next period." §9 #3. | Periods are half-open [start, end); the posting day (end) is excluded from the closing period and belongs to the next. Exact match. |
| 13 | no | no | absent | The account carries a single scalar annual_rate and the computation applies one rate (qualifying_sum × annual_rate / 360). There is no handling of mid-period rate changes or per-segment computation. Not addressed. |
| 14 | yes | **yes** | §1.2 InterestPosting fields: gross_interest, tax_withheld, net_interest, average_daily_balance, qualifying_days, updated_balance. | Output returns all six required figures: gross, tax withheld, net posted, average daily balance used, qualifying-day count, and updated balance. Matches the reference shape exactly. |
