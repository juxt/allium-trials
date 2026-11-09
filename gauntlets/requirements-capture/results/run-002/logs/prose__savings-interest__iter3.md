# prose — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 9 · Captured: 5/14 · Bespoke captured: 4/10

## Conversation

### Round 1
_Step reasoning:_ The brief omits several policy decisions (day-count, compounding, rounding, period boundaries, negative balances, rate tiering, posting semantics) that cannot be reliably inferred and must be confirmed with the stakeholder before specifying.

Q: Day-count / accrual basis: how is the annual rate converted to a daily rate — actual/365, actual/360, or actual/actual (handling leap years)?
A: actual/360 — the daily rate is annual_rate / 360.

Q: Compounding: is interest simple (daily balances accrued and posted once at period end) or compounded (each day's accrued interest added to the balance so it earns interest the following day)?
A: Compounded daily: each day's accrued interest is added to the running balance before the next day's accrual within the period.

Q: Rounding: to what precision is interest rounded (e.g. whole cents), using which rule (half-up, half-even/banker's), and is rounding applied per day or only once at posting?
A: Rounded down (floor) to 2 decimal places (the minor unit) at posting only; never half-up. The bank retains the sub-cent fraction. No per-day rounding is applied.

Q: Period boundaries: are the start and end dates both inclusive, and on which calendar days does the balance history drive accrual (how is a day's balance defined)?
A: Periods are half-open [start, end): the start date is inclusive; the posting date is excluded from the period it closes and belongs to the next period. How a single day's balance is sampled (e.g. end-of-day snapshot) is [default, not policy] — end-of-day is the conventional default.

Q: Negative balances: can the daily balance be negative, and if so is interest not accrued, or is a separate debit/overdraft rate applied?
A: The account never goes negative. A day with a zero balance contributes zero interest but still counts in the period-length divisor. No overdraft or negative-balance rate is defined.

Q: Rate structure: is the annual rate a single flat rate for the whole balance, or tiered/banded by balance level?
A: Single flat annual rate applied to the full balance — no tiers or bands. [default, not policy]

Q: Posting semantics: does post_interest add the computed interest to the account balance (so the returned updated balance = prior balance + interest), and is calling it twice for the same period idempotent or additive?
A: post_interest credits the net interest (gross minus 15% withholding tax) to the account; the returned updated balance equals prior balance plus net interest posted. Idempotency behaviour is not specified — [default, not policy] the operation is additive, so a duplicate call for the same period would double-post; callers must prevent that.

### Round 2
_Step reasoning:_ Two material policy gaps remain uninferable: the order of flooring vs 15% withholding, and how missing/extra daily-balance entries are handled.

Q: Withholding tax and rounding interaction: the 15% withholding is applied to gross interest, but at what point is the floor-to-2-decimal-places applied — is net computed as floor(gross × 0.85), or is gross first floored then tax applied, or are gross interest and the tax amount each floored separately? And is the withholding tax itself rounded, and if so by the same floor-to-cent rule?
A: The answer key does not specify the order of floor and tax operations. [default, not policy] The conventional implementation is: compute gross interest at full precision throughout the period, then floor(gross) to 2 decimal places to obtain the floored gross, then compute tax withheld as floor(floored_gross × 0.15) applying the same floor-to-2-dp rule, with net posted = floored_gross − tax_withheld. This gives three values each rounded once by floor: gross (floored), tax withheld (floored), and net (which is then exact as the difference of two 2-dp values and needs no further rounding).

Q: Does the daily balance history always contain an entry for every day in the half-open period, or can it have gaps that must be filled (e.g. carry forward the last known end-of-day balance), and may it contain entries outside the period that should be ignored?
A: The answer key does not specify balance history shape. [default, not policy] The conventional assumption is: gaps are filled by carrying forward the last known end-of-day balance (i.e. a balance holds until explicitly changed); entries whose date falls outside the half-open period [start, end) are ignored.

### Round 3 (process signalled done)
_Step reasoning:_ All material policy decisions (day-count, compounding, rounding, boundaries, withholding tax, floor/tax ordering, balance-history shape) are now resolved or confirmed as conventional defaults; no further questions are needed before writing the spec.

(no questions this round)

## Produced specification

# Requirements specification — savings account interest posting

## 1. Purpose and scope

This specifies `post_interest(account, period)`, the function that computes the interest a savings account earns over a period from its daily balance history and annual rate, deducts withholding tax, credits the net interest to the account, and returns the net interest posted together with the account's updated balance.

Every policy decision confirmed with the stakeholder is captured below. Items the stakeholder declined to rule on are implemented using the conventional default and are explicitly flagged as **[default — assumption, not confirmed policy]** so they can be revisited.

## 2. Inputs

`post_interest(account, period)` takes:

- **account** — carries at least:
  - the current (prior) balance, as a decimal amount in the account's currency with a 2-decimal minor unit;
  - the annual interest rate (a single flat rate — see §7);
  - a daily balance history: end-of-day balance snapshots keyed by calendar date (see §9).
- **period** — a half-open date interval `[start, end)` (see §5).

All monetary arithmetic must be performed with exact decimal arithmetic (e.g. a `Decimal` type), never binary floating point, to make the floor operations in §8 deterministic.

## 3. Day-count / accrual basis

Actual/360. The daily rate is `daily_rate = annual_rate / 360`. Every actual calendar day in the period accrues; the annualised rate is divided by a fixed 360-day year, not by the true number of days in the year. Leap years require no special handling.

## 4. Day set and the period divisor

Accrual runs over each calendar day in the half-open interval `[start, end)`: `start` inclusive, `end` excluded (see §5). Every such day counts toward the period, including days whose balance is zero. A zero-balance day contributes zero interest but still consumes one day of accrual — there is no compression or skipping of days.

## 5. Period boundaries

Periods are half-open: `[start, end)`.

- `start` is inclusive — it is the first day that accrues.
- `end` is the posting date. It is **excluded** from the period it closes and belongs to the next period. It does not accrue in this call.

A single day's balance is taken from its **end-of-day snapshot**. **[default — assumption, not confirmed policy]**: end-of-day is the conventional sampling convention; the stakeholder confirmed the choice of sampling point is a default rather than a deliberate policy.

## 6. Compounding

Interest compounds daily within the period. Each day's accrued interest is added to the running balance before the next day's accrual, so interest earned on one day itself earns interest on the following days of the same period. No per-day rounding is applied during compounding; the running accrual is carried at full precision throughout (see §8).

The compounding model combines the externally recorded balance history with the interest accrued so far:

```
accrued = 0                       # full-precision interest accumulated within this period
for each day d in [start, end):
    principal_d       = end-of-day balance for day d        # from history, with carry-forward (see §9)
    effective_balance = principal_d + accrued               # compounding: prior accrued interest earns interest
    daily_interest    = effective_balance * daily_rate      # daily_rate = annual_rate / 360
    accrued           = accrued + daily_interest            # added before the next day's accrual

gross_interest = accrued          # full precision, unrounded
```

Externally driven balance changes (deposits, withdrawals) enter through `principal_d`; compounding interest accumulates in `accrued` on top of the principal. The running balance for any day is that day's principal balance plus the interest accrued within the period up to that point.

## 7. Rate structure

A single flat annual rate is applied to the whole balance. There are no tiers or bands. **[default — assumption, not confirmed policy]**: the stakeholder confirmed a flat rate but noted the absence of tiering is a default rather than an explicit policy.

## 8. Rounding, withholding tax, and their interaction

The account currency has a 2-decimal minor unit. Rounding is applied **only at posting**, never per day, and always by **floor (round toward zero / round down)** to 2 decimal places — never half-up and never half-even. The bank retains the sub-cent fraction that floor discards.

Withholding tax is 15% of gross interest. The sequence of floor and tax operations is **[default — assumption, not confirmed policy]** (the stakeholder stated the answer key does not fix the order; the following is the conventional implementation):

1. Compute `gross_interest` at full precision over the whole period (§6).
2. `floored_gross = floor(gross_interest, 2dp)` — gross interest floored to the minor unit.
3. `tax_withheld = floor(floored_gross * 0.15, 2dp)` — tax computed on the floored gross and floored to the minor unit by the same rule.
4. `net_posted = floored_gross - tax_withheld` — the net is the exact difference of two 2-decimal values, so it is already at 2 decimal places and needs no further rounding.

This yields three values, each floored at most once: the floored gross interest, the floored tax withheld, and the net posted.

## 9. Balance history shape

**[default — assumption, not confirmed policy]** (the stakeholder stated the answer key does not fix the history shape; the following is the conventional assumption):

- **Gaps are carried forward.** A recorded end-of-day balance holds until explicitly changed. If a day in `[start, end)` has no entry, use the most recent known end-of-day balance preceding it.
- **Out-of-range entries are ignored.** History entries whose date falls outside `[start, end)` do not drive accrual, except that a prior entry may supply the carry-forward balance for the first in-range days.

## 10. Negative and zero balances

The account never goes negative; no overdraft or negative-balance rate is defined and none is implemented. A day with a zero balance accrues zero interest but still counts as one day of the period (§4). No special handling beyond this is required.

## 11. Posting semantics and return value

`post_interest` credits the **net** interest (gross minus 15% withholding) to the account:

```
updated_balance = prior_balance + net_posted
```

The function returns:

- **interest posted** — the net interest credited (`net_posted`);
- **updated balance** — `prior_balance + net_posted`.

It is recommended to also expose the floored gross interest and the tax withheld for audit and reconciliation, since both are retained/remitted amounts.

**Idempotency**: not specified by policy. **[default — assumption, not confirmed policy]**: the operation is **additive**, not idempotent. Calling it twice for the same period double-posts interest; callers are responsible for ensuring a period is posted at most once.

## 12. Worked procedure (summary)

1. Determine the day set `[start, end)` (§4, §5).
2. Resolve each day's end-of-day balance via carry-forward, ignoring out-of-range entries (§9).
3. Iterate day by day, compounding at full precision with `daily_rate = annual_rate / 360` (§3, §6).
4. Floor gross to 2 dp; compute tax as `floor(floored_gross * 0.15, 2dp)`; net = floored_gross − tax (§8).
5. Credit net to the balance; return net interest posted and the updated balance (§11).

## 13. Open items flagged for the stakeholder

The following were resolved by default rather than confirmed policy and should be ratified before production use: end-of-day balance sampling (§5); flat-rate structure (§7); the floor/tax ordering (§8); balance-history gap-filling and out-of-range handling (§9); and additive, non-idempotent posting (§11).

## Auditor verdict

_Of 14 decisions, 5 are correct: #2 (daily compounding), #4 (360 basis), #6 (floor rounding), #7 (15% withholding tax, net credited), and #12 (posting-day excluded via half-open periods). The core method decision #1 is surfaced but wrong — the spec implements per-day daily-balance compounding rather than the reference's average daily balance — and this error cascades: #14's required average-daily-balance and qualifying-days disclosure cannot be produced. The three lifecycle decisions (#8 dormancy, #9 closure mid-period, #10 escheatment) are entirely absent, as are #3 (quarterly-on-anniversary posting), #5 (1,000 minimum-balance threshold), and #13 (mid-period rate changes, explicitly foreclosed by the flat-rate assumption). #11 is partially addressed (no-overdraft, zero-balance-zero) but misses negative-rate rejection. Coverage = 5/14. Of the core in-focus six [1,2,3,8,9,10], only #2 is correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | no | §6: "for each day d in [start, end): ... daily_interest = effective_balance * daily_rate ... accrued = accrued + daily_interest" | The spec addresses the calculation method but implements per-day daily-balance accrual (rate applied to each day's balance), which is exactly what the reference says it is NOT. The reference requires average daily balance: sum the daily balances, divide by days, apply the rate once to that average. Different method, so not correct. |
| 2 | yes | **yes** | §6: "Interest compounds daily within the period. Each day's accrued interest is added to the running balance before the next day's accrual" | Daily compounding matches the reference exactly; prior accrued interest earns interest on following days within the period. |
| 3 | no | no | absent | The posting period/frequency is taken as a given input (`period` = [start, end)); the spec never specifies quarterly posting or anniversary-of-opening timing. The reference's quarterly-on-anniversary rule is not addressed. |
| 4 | yes | **yes** | §3: "Actual/360. The daily rate is daily_rate = annual_rate / 360 ... divided by a fixed 360-day year" | 360-day basis with daily rate = annual_rate/360 matches the reference exactly. |
| 5 | no | no | absent | No minimum-balance-to-earn-interest threshold appears anywhere. §10 only covers zero balances; there is no 1,000 threshold below which a day contributes zero interest. Not surfaced. |
| 6 | yes | **yes** | §8: "always by floor (round toward zero / round down) to 2 decimal places — never half-up ... The bank retains the sub-cent fraction that floor discards." | Floor rounding to the 2-dp minor unit with the bank keeping the fraction matches the reference exactly. |
| 7 | yes | **yes** | §8: "Withholding tax is 15% of gross interest"; §11: credits the net, "recommended to also expose the floored gross interest and the tax withheld" | 15% withholding deducted from gross, net credited to the account, and tax reported/exposed separately — all match the reference. |
| 8 | no | no | absent | Dormancy is not mentioned at all. No 12-month trigger, no continued accrual while dormant, no monthly dormancy fee of 5. Not surfaced. |
| 9 | no | no | absent | Closure mid-period and pro-rata accrual to the closure date are never addressed. The spec only covers posting over a given period. Not surfaced. |
| 10 | no | no | absent | Escheatment (5 years dormant, remit to the state, zero balance, no further interest) is not mentioned anywhere. Not surfaced. |
| 11 | yes | no | §10: "The account never goes negative; no overdraft or negative-balance rate is defined ... A day with a zero balance accrues zero interest" | The spec covers no-overdraft and zero-balance-earns-zero, but is silent on rejecting a negative rate as invalid and on recording a zero posting as a no-op. Being strict, the resolution is incomplete versus the reference, so not fully correct. |
| 12 | yes | **yes** | §5: "end is the posting date. It is excluded from the period it closes and belongs to the next period"; periods are half-open [start, end) | Posting day excluded from the period it closes and included in the next, via half-open [start, end), matches the reference exactly. |
| 13 | no | no | §7: "A single flat annual rate is applied to the whole balance. There are no tiers or bands." | The spec assumes a single flat rate and does not handle a rate change mid-period or per-rate-segment computation. The reference's in-force-per-day segmentation is not addressed. |
| 14 | yes | no | §11: returns "interest posted — the net interest credited" and "updated balance"; recommends exposing floored gross and tax withheld | The return shape covers net, gross, tax withheld and updated balance, but omits the average daily balance used and the number of qualifying days required by the reference (and no average balance exists under this method). The specific disclosure does not match, so not correct. |
