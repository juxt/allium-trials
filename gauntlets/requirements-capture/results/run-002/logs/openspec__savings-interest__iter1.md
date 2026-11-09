# openspec — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 17 · Captured: 7/14 · Bespoke captured: 6/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured dialog didn't go through. Let me ask these in plain text — this is an interest engine handling money, so I need your institution's specific policies before I can write a correct spec. There are no safe defaults here; each choice changes the posted figure.

**Round 1 — the arithmetic core**

1. **Day-count basis** (how the annual rate becomes a daily rate):
   - (a) Actual/365 fixed — `annual/365` every day, leap years included
   - (b) Actual/Actual — `annual/366` in leap years, `annual/365` otherwise
   - (c) Actual/360
   - (d) 30/360

2. **Compounding within a period:**
   - (a) Simple — `Σ (daily_balance × daily_rate)`; accrued interest doesn't earn until posted
   - (b) Daily compounding — each day's accrued interest joins principal and earns on later days

3. **Rate type:**
   - (a) Nominal / APR — applied directly
   - (b) Effective / AER (APY) — daily rate derived so compounding reproduces the stated yield, e.g. `(1+AER)^(1/365)−1`

4. **Rounding (method + when):**
   - (a) Full precision all period, round final posted total to the cent, half-up
   - (b) Same but banker's rounding (half-even)
   - (c) Round each day to the cent, then sum
   - (d) Full precision, truncate final total to the cent

**Round 2 — balances, boundaries, edges**

5. **Daily balance & period boundaries:** Which balance earns on a given day — start-of-day or end-of-day? And is the period inclusive of both the start and end dates, or half-open (e.g. `[start, end)`)?

6. **Negative / overdrawn balances:** If a day's balance is ≤ 0, does it earn nothing (floored at zero), or does a negative balance accrue negative interest?

7. **Tiered / threshold rates:** Is there a single flat rate, or does the rate depend on balance tiers / a minimum balance to earn interest? (The brief passes one `annual_rate`, so I'll assume flat unless you say otherwise.)

8. **Currency precision:** Smallest unit is the cent (2 decimal places)? And is the posted interest added to the balance so it capitalizes going forward (the interface returns an updated balance, so I assume yes)?

Answer as many as you can — anything you leave I'll flag as an explicit assumption in the spec rather than silently guess.
A: Round 1:

1. **Day-count basis:** Actual/360 — option (c). Daily rate = annual_rate / 360, every day.

2. **Compounding within a period:** Daily compounding — option (b). Each day's accrued interest joins the principal and earns on subsequent days within the period.

3. **Rate type:** [default, not policy] Nominal/APR — option (a). The annual rate is applied directly; no AER conversion.

4. **Rounding:** Option (d) — full precision throughout, truncate (floor) the final posted total to the cent. The bank retains the sub-cent fraction. Never half-up.

Round 2:

5. **Daily balance & period boundary:** Periods are half-open: [start, end). The posting day opens the next period, not closes this one. Which balance earns on a given day: [default, not policy] end-of-day balance.

6. **Negative / overdrawn balances:** Floored — a day with balance ≤ 0 contributes zero interest. Additionally, there is a minimum balance threshold: interest accrues only on days the balance is at or above 1,000. Days below that threshold contribute zero interest but still count in the average-balance divisor.

7. **Tiered / threshold rates:** Single flat rate with a minimum balance floor of 1,000 (see above). No tiers above that threshold.

8. **Currency precision:** Yes, two decimal places (cents). Posted net interest is credited to the account balance, so it capitalises going forward.

### Round 2
_Step reasoning:_ (live agent turn)

Q: These answers mostly lock it down, but two of them point at a genuine conflict I won't resolve by guessing, because it changes the posted number materially.

**The one real conflict:** In Round 1 you chose **daily compounding** (accrued interest joins principal and earns on later days). In Round 2 Q6 you described below-threshold days as still counting in the **"average-balance divisor."** Those phrases come from two different computation methods — a day-by-day compounding loop has no "divisor," while an average-daily-balance method isn't compounding. I need to know which model is authoritative.

**Follow-ups:**

**A. Which method governs?**
   - (a) **Daily compounding is authoritative.** Iterate each day in `[start, end)`. On a qualifying day (end-of-day balance ≥ 1,000): `day_interest = earning_base × (annual_rate/360)`, and that interest capitalises into the earning base for later days. Below-threshold days (incl. ≤ 0) accrue nothing but still *elapse* — i.e. they don't shorten the period or the compounding timeline. Your "divisor" remark just means skipped days aren't removed from the timeline.
   - (b) **Average-daily-balance method.** `interest = (sum of qualifying days' balances ÷ total days in period) × daily_rate × day_count`, below-threshold days counted as 0 in the numerator but all days in the denominator. (This is not daily compounding.)

**B. Compounding base & threshold base** (only matters if A = compounding): On a qualifying day, does accrued-but-unposted interest earn *alongside* the recorded balance (so `earning_base = recorded_EOD_balance + accrued_so_far`)? And is the **≥ 1,000 threshold** tested against the customer's recorded end-of-day balance, or against that balance *plus* accrued interest?

**C. What the posting credits:** The returned "updated balance" = the account's final recorded end-of-day balance in the period **+** the (truncated) posted interest — correct? And can posted interest ever be negative, or is it floored at zero (given overdrawn/below-threshold days simply contribute nothing)?
A: A. Average-daily-balance is authoritative — option (b). My earlier 'daily compounding' answer was wrong about intra-period behaviour. The correct method: sum each day's end-of-day balance over [start, end), divide by the total number of days in the period, then apply the rate once to that average. Below-threshold days (balance < 1,000) contribute zero to the numerator but their day still enters the denominator. 'Compounds daily' in my earlier answer referred to inter-period capitalisation — posted net interest joins the recorded balance and therefore affects future periods' average — not an intra-period day-by-day compounding loop.

B. Not applicable — the ADB method has no intra-period compounding base, so the threshold test and earning-base questions in B fall away. The ≥ 1,000 threshold is tested against the customer's recorded end-of-day balance only.

C. Correct on the first part: updated balance = final recorded end-of-day balance in the period + truncated net interest posted. Net interest is gross interest less 15% withholding, then floored to the cent. Posted interest is never negative — below-threshold and zero-balance days contribute nothing to the numerator, so the worst outcome is a zero posting (which is still recorded).

### Round 3
_Step reasoning:_ (live agent turn)

Q: Got it — and that surfaces a new policy (15% withholding) plus a couple of remaining material points on the ADB formula itself. A few last questions and I think the spec is fully pinned:

**D. Period scaling of the rate.** You said "apply the rate *once* to that average." Combined with Actual/360 (Q1), does "once" mean apply the period's accrued daily rate — i.e. `gross = ADB × (annual_rate/360) × N_days` where `N_days` is the number of days in `[start, end)` — or does it literally mean apply the full `annual_rate` a single time regardless of how long the period is? (The first honours Actual/360 and period length; the second would pay a full year's interest on, say, a 30-day period. I want to be sure which you mean.)

**E. Withholding details.**
   - Is the 15% withholding applied to **every** posting unconditionally (no exemption threshold)?
   - Order of operations: `net = floor_to_cent(gross × (1 − 0.15))` — i.e. gross stays full-precision, withholding computed on full-precision gross, and the **floor-to-cent happens on the net** (bank/tax authority retains the sub-cent)? Or is gross floored first, then withholding?
   - Does `post_interest` need to **report** the withheld amount separately, or only return `(net_interest_posted, updated_balance)`?

**F. Balance-history gaps & empty periods.**
   - Is the account guaranteed to have a recorded end-of-day balance for **every** day in `[start, end)`? If a day is missing, carry forward the last known balance, or treat it as an error?
   - If the period is **zero-length** (`start == end`, so `N_days = 0`), the divisor is zero — should that return a zero posting (no division performed) rather than erroring?

And one format check — **G:** is `annual_rate` a decimal fraction (e.g. `0.05` for 5%) and the `1,000` threshold expressed in the account's main currency unit (so `1000.00`)?
A: D. The first interpretation: `gross = ADB × (annual_rate / 360) × N_days`. The rate scales with the actual length of the period. A 30-day period accrues 30 days' worth of interest on the average balance, not a full year's.

E. Withholding:
- Applied unconditionally at every posting; no exemption threshold.
- Order of operations: gross stays full-precision, withholding is computed on full-precision gross, floor-to-cent is applied to the net. `net_posted = floor(gross × 0.85, 2)`. The sub-cent fraction is retained by the bank/tax authority.
- The tax withheld must be reported separately. Per posting, return: gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated balance.

F.
- Missing days: carry forward the last known end-of-day balance. A gap is not an error. [default, not policy]
- Zero-length period (start == end, N_days = 0): return a zero posting — gross 0, tax 0, net 0, updated balance unchanged. No division is performed and no error is raised. [default, not policy]

G. [default, not policy] Yes on both: `annual_rate` is a decimal fraction (0.05 = 5%) and the 1,000 minimum-balance threshold is in the account's main currency unit.

### Round 4
_Step reasoning:_ (live agent turn)

Q: One last detail on a required output field and I'll write the spec. You want `tax_withheld` reported separately, and `net_posted = floor(gross × 0.85, 2)` with the sub-cent retained by the bank/tax authority. Because `net_posted` is floored, there's more than one way to define the reported `tax_withheld`, and they disagree at the sub-cent:

**H. How is the reported `tax_withheld` defined?**
   - (a) `tax_withheld = floor(gross × 0.15, 2)` — net and tax are each floored independently from their 85% / 15% shares; the leftover sub-cent on *both* sides is the bank's retention. (Then `net + tax ≤ gross`.)
   - (b) `tax_withheld = gross − net_posted` (then rounded/floored to the cent) — i.e. tax absorbs the entire remainder after the customer's floored net, so `net + tax` reconciles exactly to gross-at-cents.
   - (c) Something else you have in mind.

And for the reported **`gross_interest`** figure itself — report it at full precision, or rounded/floored to the cent for display?
A: H. [default, not policy] Option (b): `tax_withheld = gross − net_posted`. Net and tax reconcile exactly to gross-at-cents; the entire sub-cent remainder goes to the tax authority rather than being split. `gross_interest` is reported at full floating-point precision — it is the input to the withholding calculation and should not be floored before reporting.

### Round 5
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory. **It is done.**

I didn't guess on anything material — I asked you through every policy decision the brief left open, and the spec records exactly what you decided (with the handful of stakeholder-designated defaults flagged as **[default]** so they're distinguishable from deliberate institutional policy).

What the spec pins down:

- **Method:** average-daily-balance (not intra-period compounding — the corrected answer), Actual/360, nominal rate applied directly, scaled by actual period length.
- **Floor:** days qualify only at balance ≥ 1,000; sub-threshold/zero/overdrawn days add 0 to the numerator but still count in the divisor.
- **Period:** half-open `[start, end)`, end-of-day balances, carry-forward for gaps, zero-length → zero posting (no division, no error).
- **Money:** full precision throughout, net = `floor(gross × 0.85)`, 15 % withholding unconditional, `tax = floor(gross) − net` so net + tax reconcile to gross-at-cents, sub-cent to the tax authority, gross reported at full precision.
- **Outputs:** gross, tax withheld, net posted, ADB, qualifying days, updated balance; net credited to the balance so it capitalises into future periods.

I also flagged one thing worth your awareness: with your formula, the `N_days` divisor in the ADB and the `× N_days` period-scaling factor **cancel algebraically**, so `gross == Σ(qualifying balances) × annual_rate / 360`. The ADB figure still matters as a reported output and for the threshold accounting, but it has no net effect on the gross amount. The spec notes this as an equivalence rather than changing your stated method. A worked acceptance example is included in §6.

Per the planning boundary, I've stopped at the spec and haven't written any implementation code. Let me know if you'd like any policy revisited.
A: Noted — the spec looks complete and correctly captures every policy decision. The algebraic equivalence observation is a useful sanity check; glad it's recorded as an equivalence rather than a method change. No questions pending from my side.

## Produced specification

# Specification — Savings Account Interest Engine (`post_interest`)

## 1. Purpose

Compute and post the interest a savings account earns over a period, using the
institution's **average-daily-balance** method with a minimum-balance floor,
**Actual/360** day-count, and **15 % withholding tax**. Credit the net interest to
the account and report the full breakdown.

All policy values below were confirmed with the product stakeholder. Items marked
**[default]** were explicitly designated by the stakeholder as sensible defaults
rather than deliberate institutional policy, but are nonetheless binding for this
implementation.

## 2. Interface

```
post_interest(account, period) -> PostingResult
```

- **`account`** — a savings account with:
  - a **daily balance history**: the recorded **end-of-day** balance for each
    calendar day (see §4.4 for gaps),
  - a current **balance**, in the account's main currency unit, to which net
    interest is credited.
- **`period`** — a date range with a **`start`** and **`end`** date, interpreted as
  the **half-open** interval `[start, end)` (see §4.1).

### 2.1 Return value

`post_interest` returns a `PostingResult` containing **all** of the following and
mutates/updates the account balance to `updated_balance`:

| Field | Meaning | Precision |
|---|---|---|
| `gross_interest` | Gross interest before tax | **Full precision** (not floored/rounded) |
| `tax_withheld` | Withholding tax (15 %) | Cents (2 dp) |
| `net_interest_posted` | Net interest credited to the account | Cents (2 dp), floored |
| `average_daily_balance` | ADB used in the calculation (§3.2) | Full precision |
| `qualifying_days` | Count of days whose balance met the ≥ 1,000 threshold | Integer |
| `updated_balance` | Account balance after crediting net interest | Cents (2 dp) |

## 3. Computation

### 3.1 Day count (denominator)

`N_days` = the number of days in the half-open interval `[start, end)` =
`(end - start)` in whole days. This is the **average-daily-balance divisor** and
**counts every day in the period**, including days excluded from the numerator by
the minimum-balance floor.

### 3.2 Average daily balance (ADB)

For each day `d` in `[start, end)`:

- Let `b_d` = the account's **end-of-day** balance for day `d`
  (carry-forward rule for missing days: §4.4).
- A day **qualifies** iff `b_d >= 1000` (the minimum-balance threshold, in the
  account's main currency unit). Days with `b_d < 1000` — including zero and
  overdrawn/negative balances — are **non-qualifying**.

Then:

```
numerator = Σ over qualifying days of b_d          # non-qualifying days add 0
qualifying_days = count of qualifying days
average_daily_balance = numerator / N_days         # divisor includes non-qualifying days
```

> Non-qualifying days contribute **0** to the numerator but still increment the
> `N_days` denominator, lowering the ADB.

### 3.3 Gross interest

Nominal annual rate applied directly (no AER conversion), Actual/360, scaled by the
actual period length:

```
daily_rate = annual_rate / 360          # annual_rate is a decimal fraction, e.g. 0.05 = 5%
gross_interest = average_daily_balance * daily_rate * N_days
```

The rate scales with the real length of the period: a 30-day period accrues 30 days'
interest on the ADB, not a full year's. `gross_interest` is kept at **full
precision** and is **never** floored or rounded before it is reported or used as the
input to withholding.

> **Algebraic note (equivalence, not a separate rule):** because
> `average_daily_balance = numerator / N_days`, the `N_days` factor cancels, so
> `gross_interest == numerator * annual_rate / 360` exactly. Implementations may use
> either form; both are correct and must agree to full precision. The two-step ADB
> form is canonical because `average_daily_balance` is a required reported output.

### 3.4 Withholding tax and net posting

15 % withholding is applied **unconditionally** to every posting (no exemption
threshold). Withholding is computed on the **full-precision** gross; only the
customer-facing **net** is floored to the cent.

```
net_interest_posted = floor_to_cent(gross_interest * 0.85)       # truncate toward zero, never half-up
tax_withheld        = floor_to_cent(gross_interest) - net_interest_posted
```

Reconciliation identity (must hold for every posting):

```
net_interest_posted + tax_withheld == floor_to_cent(gross_interest)
```

The sub-cent fractional remainder of the gross (`gross_interest -
floor_to_cent(gross_interest)`) is **not** paid to the customer; it accrues entirely
to the tax authority. Net and tax therefore reconcile exactly to the gross-at-cents.

`net_interest_posted` is **never negative**: non-qualifying, zero, and overdrawn days
contribute nothing to the numerator, so the worst case is a **zero** posting (which
is still a valid, recorded posting).

### 3.5 Updated balance

```
updated_balance = (final recorded end-of-day balance within the period)
                  + net_interest_posted
```

Posting **capitalises**: the credited net interest joins the recorded balance and so
affects the average daily balance of **future** periods. There is no intra-period
compounding (the method is average-daily-balance, applied once per period).

## 4. Boundaries and edge cases

### 4.1 Period boundary — half-open `[start, end)`

The period **includes** `start` and **excludes** `end`. The posting/`end` day opens
the **next** period rather than closing the current one; it must not be
double-counted across adjacent periods.

### 4.2 Minimum-balance floor

A single flat rate applies. There are **no tiers** above the threshold. The only
balance-dependent rule is the ≥ 1,000 qualifying threshold of §3.2. The separate
"overdrawn earns nothing" rule is subsumed by it (anything ≤ 0 is `< 1000`).

### 4.3 Zero-length period — **[default]**

If `start == end` (so `N_days == 0`): return `gross_interest = 0`,
`tax_withheld = 0`, `net_interest_posted = 0`, `average_daily_balance = 0`,
`qualifying_days = 0`, and leave the balance unchanged. **No division is performed
and no error is raised.**

### 4.4 Missing days in the balance history — **[default]**

A day with no recorded end-of-day balance is **not** an error. **Carry forward** the
last known end-of-day balance for that day.

### 4.5 Rate and threshold formats — **[default]**

`annual_rate` is a **decimal fraction** (`0.05` = 5 %). The `1,000` threshold is
expressed in the account's **main currency unit** (`1000.00`). Monetary amounts are
held to two decimal places (cents).

## 5. Policy decisions (summary)

| # | Decision | Value | Source |
|---|---|---|---|
| 1 | Day-count basis | **Actual/360**; `daily_rate = annual_rate / 360` | Policy |
| 2 | Accrual method | **Average daily balance**, no intra-period compounding | Policy (corrected from an initial "daily compounding" answer) |
| 3 | Rate type | **Nominal / APR**, applied directly | [default] |
| 4 | Rounding | Full precision throughout; **truncate (floor)** net to the cent; never half-up; bank/tax authority retains sub-cent | Policy |
| 5 | Period boundary | **Half-open `[start, end)`** | Policy |
| 6 | Balance per day | **End-of-day** balance | [default] |
| 7 | Minimum-balance floor | Day qualifies iff balance **≥ 1,000**; sub-threshold (incl. ≤ 0) adds 0 to numerator but its day still counts in the divisor | Policy |
| 8 | Tiers | **None** — single flat rate above the floor | Policy |
| 9 | Period scaling | `gross = ADB × (annual_rate/360) × N_days` (scales with period length) | Policy |
| 10 | Withholding | **15 %**, unconditional; computed on full-precision gross; floor applied to net | Policy |
| 11 | Tax reported | `tax_withheld = floor(gross) − net`; net + tax reconcile to gross-at-cents; sub-cent → tax authority | [default] |
| 12 | Reported gross | **Full precision**, not floored before reporting | Policy |
| 13 | Capitalisation | Net interest credited to balance; affects **future** periods' ADB; no intra-period compounding | Policy |
| 14 | Missing days | Carry forward last known end-of-day balance | [default] |
| 15 | Zero-length period | Zero posting, no division, no error | [default] |
| 16 | Formats | `annual_rate` decimal fraction; threshold in main currency unit; cents precision | [default] |

## 6. Worked example (acceptance test)

- `annual_rate = 0.05`, `period = [2025-01-01, 2025-01-31)` → `N_days = 30`.
- End-of-day balances: Jan 1–10 = `2000`, Jan 11–20 = `500` (below threshold),
  Jan 21–30 = `3000`.

Computation:

- Qualifying days: Jan 1–10 and Jan 21–30 → `qualifying_days = 20`;
  Jan 11–20 are non-qualifying (0 to numerator, still in the divisor).
- `numerator = 10×2000 + 10×3000 = 50000`.
- `average_daily_balance = 50000 / 30 = 1666.6667` (full precision 1666.666…).
- `gross_interest = 1666.666… × (0.05/360) × 30 = 50000 × 0.05 / 360 = 6.94444…`.
- `net_interest_posted = floor(6.94444… × 0.85, 2) = floor(5.90277…, 2) = 5.90`.
- `tax_withheld = floor(6.94444…, 2) − 5.90 = 6.94 − 5.90 = 1.04`.
- Check: `5.90 + 1.04 = 6.94 = floor(gross)` ✓ ; sub-cent `0.00444…` → tax authority.
- `updated_balance = 3000 (final recorded EOD, Jan 30) + 5.90 = 3005.90`.

Returned: `gross_interest ≈ 6.94444…`, `tax_withheld = 1.04`,
`net_interest_posted = 5.90`, `average_daily_balance ≈ 1666.6667`,
`qualifying_days = 20`, `updated_balance = 3005.90`.

## 7. Out of scope

- Multi-currency conversion.
- Tiered or promotional rate schedules.
- Tax remittance/reporting to the authority beyond returning `tax_withheld`.
- Persistence, transaction logging, and idempotency/duplicate-posting guards
  (the engine computes and returns a posting; durable recording is the caller's
  responsibility).


## Auditor verdict

_Coverage 7/14 correct (1, 4, 5, 6, 7, 12, 14). The spec is strong on the per-period computation and output: average-daily-balance method, 360 basis, 1,000 floor with divisor rule, 15% withholding, floor rounding, half-open boundary, and the full reporting shape all match. It fails the method/lifecycle in-focus subset badly: it explicitly rejects daily compounding (#2, actively wrong), and is silent on quarterly anniversary posting (#3), dormancy (#8), mid-period closure (#9), escheatment (#10), and mid-period rate changes (#13). #11 is only partially addressed (zero-balance no-op correct, but negative-rate rejection and no-overdraft missing/contradicted). Of the core in-focus six [1,2,3,8,9,10], only #1 is correct — lifecycle and non-trivial method decisions in this fresh savings domain were largely not surfaced._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3.2 'average_daily_balance = numerator / N_days'; §5.2 'Average daily balance, no intra-period compounding' | Spec sums daily balances and divides by days in period, applying the rate once to the average — exactly the reference's average-daily-balance method, not per-day daily balance. |
| 2 | yes | no | §3.5 'There is no intra-period compounding (the method is average-daily-balance, applied once per period)'; §5.2 'no intra-period compounding (corrected from an initial "daily compounding" answer)' | The reference requires daily compounding. The spec explicitly rejects it, even noting it 'corrected' away from a daily-compounding answer — a direct contradiction of the correct value. |
| 3 | no | no | absent | The spec treats period as a given input and never specifies posting frequency; nothing about quarterly posting or posting on the account-opening anniversary appears. |
| 4 | yes | **yes** | §3.3 'daily_rate = annual_rate / 360'; §5.1 'Actual/360' | Day-count basis is 360 with daily rate annual/360, matching the reference exactly. |
| 5 | yes | **yes** | §3.2 'A day qualifies iff b_d >= 1000 ... Non-qualifying days contribute 0 to the numerator but still increment the N_days denominator' | Threshold of 1,000 gives zero interest on sub-threshold days while they remain in the divisor — matches the reference precisely. |
| 6 | yes | **yes** | §3.4 'floor_to_cent ... truncate toward zero, never half-up'; §5.4 'truncate (floor) net to the cent; never half-up' | Posted interest is floored to 2 dp and never rounded half-up, matching the reference rounding rule (spec routes the sub-cent to the tax authority rather than 'the bank', but the rounding method itself is identical). |
| 7 | yes | **yes** | §3.4 '15 % withholding is applied unconditionally to every posting'; §2.1 fields 'tax_withheld', 'net_interest_posted' | 15% withholding is deducted from gross at posting, net is credited, and tax withheld is reported separately — exactly the reference answer. |
| 8 | no | no | absent | No dormancy concept anywhere: no 12-month inactivity trigger, no continued accrual while dormant, and no monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec addresses pro-rata scaling for a given period but never the closure lifecycle: no mid-period closure, no pro-rata-to-closure posting net of withholding, no forfeiture rule. |
| 10 | no | no | absent | No escheatment at all: no 5-year dormant trigger, no remittance to the state, no zero-balance closure. |
| 11 | yes | no | §3.4 'the worst case is a zero posting (which is still a valid, recorded posting)'; §3.2 lists 'overdrawn/negative balances' as merely non-qualifying | The zero-balance zero-posting no-op matches, but the spec never rejects a negative rate and explicitly tolerates overdrawn/negative balances as normal, contradicting the reference's 'reject negative rate' and 'account never goes negative' — so the full value is not matched. |
| 12 | yes | **yes** | §4.1 'includes start and excludes end. The posting/end day opens the next period rather than closing the current one' | Half-open [start, end) with the posting day excluded from the closing period and opening the next — exactly the reference boundary rule. |
| 13 | no | no | absent | The spec uses a single annual_rate throughout and lists rate schedules as out of scope (§7); it never handles a mid-period rate change with per-day rate-in-force segmentation. |
| 14 | yes | **yes** | §2.1 return fields: 'gross_interest', 'tax_withheld', 'net_interest_posted', 'average_daily_balance', 'qualifying_days', 'updated_balance' | The PostingResult returns all six required disclosures including the average daily balance used and the qualifying-days count — matching the reference output shape exactly. |
