# bmad — savings-interest — iteration 1

Model (author): claude-opus · Questions asked: 16 · Captured: 6/14 · Bespoke captured: 5/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: The structured-question tool isn't going through in this environment, so I'll just ask directly. Here's the first batch. Computing interest correctly hinges on these, and each is a policy your institution has chosen rather than something I can safely infer.

**1. Day-count convention.** How is the daily rate derived from the annual rate?
- Actual/365 fixed (÷365 every year, leap years included)
- Actual/360 (÷360)
- Actual/actual (÷365, or ÷366 in a leap year)

**2. Compounding within a period.** Does accrued interest itself earn interest before it's posted?
- Simple: each day's interest = that day's balance × daily rate, summed; no compounding until posting
- Daily compounding: each day's accrued interest joins the balance and earns on later days

**3. What the annual rate means.**
- Nominal annual rate (divided by the day-count to get the daily rate)
- Effective annual rate / AER (the true annualised yield; daily rate derived so compounding reproduces it)

**4. Negative-balance days** (if the account can go overdrawn):
- No interest on negative or zero balance (floor at zero)
- Charge negative interest at the same rate
- Reject a negative balance as invalid input

**5. Which balance counts for a day.**
- Closing balance (end of day, after that day's transactions)
- Opening balance (start of day, before them)

Answer in whatever form is easy, and I'll follow with a second batch on rounding and period boundaries before writing the spec.
A: 1. Actual/360 — the daily rate is annual_rate / 360.
2. Daily compounding — each day's accrued interest joins the balance and earns on later days within the period.
3. Nominal annual rate — divided by 360 to get the daily rate.
4. Reject a negative balance as invalid input — the account never goes negative.
5. Closing balance (end of day, after that day's transactions). [default, not policy]

### Round 2
_Step reasoning:_ (live agent turn)

Q: Batch two, then I'll write the spec.

**6. Rounding — precision and mode.** To what precision is the posted interest rounded, and how?
- Currency minor unit (e.g. whole pence/cents), half-up
- Minor unit, banker's rounding (half-to-even)
- Minor unit, truncate toward zero
- Something else (state precision and mode)

**7. Rounding — when.** Given daily compounding, this matters:
- Accrue at full precision internally, round only the final posted total once
- Round each day's interest (and the running balance it compounds on) to the minor unit each day

**8. Period boundaries.** A period runs from a start date to an end date. Which days accrue?
- Both endpoints inclusive (every day from start to end earns)
- Start inclusive, end exclusive (half-open; the end date doesn't accrue)
- Start exclusive, end inclusive

**9. Minimum balance to earn interest.** Is there a threshold below which a day earns nothing, or does every eligible day earn regardless of balance? (Brief mentions a single rate, so I'm assuming no balance tiers unless you say otherwise.)

**10. Currency and posting.** What currency/minor unit should the engine assume (or is it carried on the account)? And confirm: posted interest is added to the balance, so the returned updated balance = prior balance + interest posted.
A: 6. Minor unit (2 dp), truncated toward zero — floor, not half-up. The bank keeps the sub-unit fraction.

7. Accrue at full precision internally; round only the final posted total once at posting. [default, not policy — the key specifies rounding at posting, not per-day]

8. Start inclusive, end exclusive — periods are half-open [start, end). The posting day is excluded from the period it closes and included in the next.

9. There is a threshold: interest accrues only on days the closing balance is at or above 1,000. Days below that threshold contribute zero interest but still count as days in the average-balance divisor.

10. Currency is carried on the account; the engine should not hardcode one. [default, not policy] The minor unit is 2 dp. On posting: the gross interest is computed, 15% withholding tax is deducted, and the account is credited the net amount. Updated balance = prior balance + net interest. Tax withheld is reported separately.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Two of your answers pull in different directions, and I don't want to paper over it in the spec, so let me reconcile before writing.

Answer 2 said **daily compounding**: each day's interest is `running_balance × daily_rate`, and the accrued interest joins the balance so later days compound on it. That method has no divisor and no averaging — total interest is just the sum of daily accruals.

Answer 9 introduced an **average-balance divisor**: sub-threshold days "contribute zero interest but still count as days in the average-balance divisor." That's the vocabulary of a different method: average daily balance over the period, then apply the rate once. There's no divisor in a daily-compounding calc.

Which is the real method?

**11a.** Pick one:
- **Daily compounding accrual.** Walk the period day by day. On each day with closing balance ≥ 1,000, accrue `running_balance × daily_rate` and fold it into the running balance so it compounds. Days below 1,000 accrue nothing but the running balance carries forward. No divisor anywhere. (If this is it, what did "average-balance divisor" in answer 9 refer to?)
- **Average daily balance.** Average the daily closing balances across the period, then apply the rate. The divisor is the day count. But then there's no daily compounding, so answer 2 was wrong.
- **Something hybrid** — describe it.

**11b. The threshold and the divisor.** When you said sub-threshold days "still count as days in the divisor": if the method is daily accrual, there's no divisor, so I read this as meaning the *period length* is unaffected by which days qualify (sub-threshold days are skipped for accrual but the period still spans them). Correct? Or is the qualifying-day count used somewhere specific?

**12. Tax rounding and reconciliation.** Gross → deduct 15% → credit net, truncating to 2 dp. In what order?
- Gross truncated to 2 dp first, then tax = 15% of that (rounded/truncated how?), net = gross − tax — so gross = net + tax exactly.
- Gross and tax both at full precision, then truncate at the end — which may leave net + tax_withheld off gross by a sub-unit.

Which, and how is the tax figure itself rounded so the reported withholding reconciles against the credited net?

**13. Threshold value.** Is 1,000 fixed policy, or configurable per product/account? And it's in the account's own currency (so 1,000 of whatever the account holds), yes?
A: 11a. Average daily balance is the real method. My answer to question 2 was wrong — or at best described inter-period behaviour rather than intra-period. Within a quarterly period: sum every day's closing balance, divide by the number of calendar days in the period, apply the annual rate (÷ 360) once to that average. There is no day-by-day accrual walk and no within-period compounding. What compounds is the posted interest across quarters — each quarterly posting joins the balance and so raises the average for the next period. That is what "compounds daily" should have pointed at, not a day-by-day running product.

11b. Your reading is correct. Sub-threshold days contribute a zero balance to the sum, not zero days to the divisor. The divisor is always the full calendar length of the period — a 92-day quarter is divided by 92 regardless of how many days cleared the threshold. The qualifying-day count appears in the output for transparency but does not alter the formula.

12. Order: compute gross at full precision, then truncate to 2 dp. Tax withheld = floor(gross_rounded × 0.15, 2 dp). Net credited = gross_rounded − tax_withheld. With this order gross_rounded = net + tax exactly, so the three reported figures reconcile to the cent. [default, not policy — the key specifies floor rounding and separate tax reporting but does not prescribe the sequencing; this ordering minimises reconciliation gaps]

13. 1,000 is fixed policy, not configurable per product or account. Yes, it is denominated in the account's own currency.

### Round 4
_Step reasoning:_ (live agent turn)

Q: It's done. Saved as `spec.md` in the working directory.

The specification pins down the policy decisions the brief left out, all confirmed with you:

- **Method**: average daily balance, not a day-by-day accrual walk. Sum qualifying daily closing balances, divide by the full period length, apply the rate once.
- **Day-count and rate**: nominal annual rate on an Actual/360 basis.
- **Threshold**: only days with a closing balance ≥ 1,000 (account currency) contribute; the divisor is always the full calendar length, so sub-threshold days add a zero balance, not a lost day.
- **Rounding and tax**: truncate toward zero to 2 dp once at posting; 15% withholding deducted from rounded gross, net credited, gross/tax/net reconciling to the cent.
- **Boundaries**: half-open `[start, end)`. **Negative balances**: rejected as invalid.

I also caught and resolved the one real contradiction: your answer 2 (daily compounding) and answer 9 (average-balance divisor) described different engines. You clarified it's average daily balance, with compounding happening across quarters rather than within one, and the spec records that so it can't be misread later.

Two things left flagged for you in the spec:

- Defaults I chose rather than you (closing vs opening balance, the tax rounding *sequence*, "interest posted" meaning net) are marked as such, so you can veto any.
- Two genuine open questions: what rejection should *do* (raise vs error result — a platform-convention call), and whether the 15% withholding rate ever varies.

There's also a worked example in the spec that exercises the truncation on both gross and tax, in case it's useful for seeding tests.
A: Received. The spec looks accurate from my side. On the two open items: the withholding rate is fixed at 15% — it does not vary by customer, product or period, so you can hardcode it rather than making it a parameter. On rejection behaviour, that is a platform convention rather than product policy — handle it however the rest of the engine surfaces invalid inputs. [default, not policy]

## Produced specification

# Interest engine — requirements specification

## Purpose

Compute the interest a savings account earns over a period and post it to the account.
The single entry point is `post_interest(account, period)`, which computes the interest for
`period`, deducts withholding tax, credits the net amount to the account, and returns the
interest posted alongside the updated balance.

## Scope

In scope: the interest calculation for one period, the rounding and withholding-tax rules,
input validation, and the posting effect on the account.

Out of scope: how balances are stored, how the daily balance history is assembled, transaction
processing, the scheduling that decides when `post_interest` runs, and any reporting beyond the
figures this function returns. Cross-period compounding is not computed here; it emerges when
the engine is run period after period, because each posting raises the balance that feeds the
next period's average (see "Compounding" below).

## Interface

```
post_interest(account, period) -> result
```

`account` carries at least:

- its **currency** and minor unit (the engine does not hardcode a currency; the minor unit is 2
  decimal places),
- its current **balance**,
- a **daily balance history** giving the **closing balance** (end of day, after that day's
  transactions) for every calendar day in `period`.

`period` is a half-open date range `[start, end)`: the start date is included, the end date is
excluded. The end date belongs to the next period, not this one. The **period length** is the
number of calendar days in `[start, end)`, i.e. `end - start`.

A single **annual interest rate** is supplied (nominal, see below). There is one rate; the engine
does not model balance tiers.

## The calculation

The method is **average daily balance**, applied once to the period. There is no day-by-day
accrual walk and no within-period compounding.

### Step 1 — qualifying daily balances

For each calendar day in `[start, end)`, take that day's closing balance.

- If the closing balance is **at or above the threshold of 1,000** (in the account's own
  currency), the day contributes its **closing balance** to the running sum.
- If the closing balance is **below 1,000**, the day contributes **zero** to the sum.

The threshold is fixed policy at 1,000. It is not configurable per product or per account.

### Step 2 — average balance

```
average_balance = (sum of qualifying daily closing balances) / period_length
```

The divisor is always the **full calendar length of the period**, regardless of how many days
cleared the threshold. A 92-day quarter is divided by 92 even if only 40 days qualified.
Sub-threshold days contribute a zero *balance* to the numerator, not zero *days* to the divisor.

### Step 3 — gross interest

Apply the annual rate to the average, on an **Actual/360** basis. The rate is **nominal**: the
daily rate is `annual_rate / 360`, and it is applied across the actual days in the period.

```
gross_interest = average_balance * annual_rate * (period_length / 360)
```

Because the divisor in Step 2 and the day-count multiplier here are both `period_length`, they
cancel. The formula is equivalently, and more directly:

```
gross_interest = (sum of qualifying daily closing balances) * annual_rate / 360
```

`gross_interest` is held at **full precision** through this step. No rounding happens yet.

### Step 4 — rounding, tax, and net

Rounding happens **once**, at posting, and is **truncation toward zero** (floor for the
non-negative amounts this engine produces) to the minor unit of 2 decimal places. The bank keeps
the sub-unit fraction. The sequence is fixed so the three reported figures reconcile exactly:

```
gross_rounded = truncate(gross_interest, 2 dp)          -- toward zero
tax_withheld  = truncate(gross_rounded * 0.15, 2 dp)    -- 15% withholding, toward zero
net_interest  = gross_rounded - tax_withheld
```

With this ordering, `gross_rounded = net_interest + tax_withheld` to the cent, so gross, tax and
net always reconcile.

### Step 5 — post

```
updated_balance = prior_balance + net_interest
```

The **net** amount is credited to the account. The account balance becomes
`prior_balance + net_interest`. The withholding tax is reported separately and is not credited
to the account.

## Compounding

There is no compounding *within* a period. Compounding across periods is emergent: each posting
adds the net interest to the balance, which raises the daily balances (and therefore the average)
of subsequent periods. The engine does not compute this; it is the consequence of running
`post_interest` on successive periods.

## Withholding tax

A flat **15%** withholding tax is deducted from the (rounded) gross interest on every posting.
Tax is computed and reported per posting, truncated to 2 decimal places toward zero as above, and
reported separately from the net credit.

## Validation — rejected inputs

The account is never expected to go negative. The engine rejects, rather than silently handling:

- **Any negative closing balance** on any day in the period. This is invalid input; the function
  refuses to post.
- **A zero-length or negative period** (`end <= start`), which would leave the divisor at zero.
- **Missing daily balance data** for any day in `[start, end)`. Every day in the period must have
  a closing balance available.

A day with a **zero** closing balance is valid; it simply falls below the threshold and
contributes zero.

## Output

`post_interest` returns, at minimum:

- **net interest posted** — the amount credited to the account,
- **updated balance** — `prior_balance + net_interest`,
- **gross interest** (`gross_rounded`) and **tax withheld**, so the posting reconciles,
- the **count of qualifying days** (days at or above the threshold), for transparency. This count
  is informational only; it does not affect the formula, which always uses the full period length
  as the divisor.

## Worked example

Account in GBP, `annual_rate = 0.0365` (3.65%). Period `[1 Jan, 1 Apr)`, a 90-day quarter
(31 + 28 + 31). Suppose the closing balance is 2,000 for 60 of those days and 500 for the other
30 days.

- Qualifying days: the 60 days at 2,000 clear the 1,000 threshold and each contribute 2,000. The
  30 days at 500 are below the threshold and contribute 0. Qualifying-day count = 60.
- Sum of qualifying closing balances = 60 × 2,000 = 120,000.
- Average balance = 120,000 / 90 = 1,333.33… (divisor is the full 90 days).
- Gross interest = 120,000 × 0.0365 / 360 = 12.1666…
- `gross_rounded` = truncate to 2 dp = **12.16** (the bank keeps 0.0066…).
- `tax_withheld` = truncate(12.16 × 0.15, 2 dp) = truncate(1.824, 2 dp) = **1.82**.
- `net_interest` = 12.16 − 1.82 = **10.34**.
- Reconciliation: 10.34 + 1.82 = 12.16. ✓
- Updated balance = prior balance + 10.34.

## Policy decisions (confirmed with the stakeholder)

| Decision | Choice |
|----------|--------|
| Method | Average daily balance over the period, applied once |
| Day-count | Actual/360; daily rate = annual_rate / 360 |
| Rate meaning | Nominal annual rate |
| Within-period compounding | None (compounding is cross-period, emergent) |
| Threshold | Days with closing balance ≥ 1,000 (account currency) qualify; fixed, not configurable |
| Divisor | Always the full calendar length of the period |
| Balance per day | Closing balance (end of day) |
| Period boundaries | Half-open `[start, end)` |
| Rounding | Truncate toward zero to 2 dp, once, at posting |
| Withholding tax | 15%, deducted from rounded gross; net credited; tax reported separately |
| Tax sequencing | gross_rounded → tax = floor(15%) → net = gross_rounded − tax |
| Negative balance | Rejected as invalid input |

## Assumptions and defaults (not stakeholder policy — flag if any are wrong)

- **Closing (not opening) balance** is used per day. Stated as a sensible default rather than a
  policy call.
- **Currency is carried on the account**; the engine assumes a 2-dp minor unit and does not
  hardcode a currency.
- **Tax sequencing** (round gross first, then tax, then net) was chosen to minimise reconciliation
  gaps; the stakeholder confirmed floor rounding and separate tax reporting but did not originally
  prescribe the order.
- **"Interest posted"** in the return value is the **net** amount credited. Gross and tax are also
  returned for reconciliation.
- **Edge-case validation** (zero-length period, missing daily data) is specified above as a
  rejection. These were derived from the "account never goes negative / reject invalid input"
  stance rather than asked explicitly; confirm the exact failure behaviour (exception vs. error
  result) fits your platform.

## Open questions

- What should the function *do* on rejection — raise, or return an error result? The platform
  convention should decide; the spec only fixes *which* inputs are invalid.
- Is the 15% withholding rate ever varied (by jurisdiction, account type, or over time), or is a
  single flat rate safe to assume for all postings this engine handles?


## Auditor verdict

_The spec deeply and correctly covers the core per-period calculation (average daily balance method, 360 basis, 1,000 threshold with full-period divisor, floor rounding, 15% withholding, half-open boundaries): decisions 1, 4, 5, 6, 7 and 12 match. It fails the compounding decision (2, explicitly rejects within-period compounding vs required daily compounding), omits the entire lifecycle set (3 posting period/anniversary, 8 dormancy, 9 closure, 10 escheatment) and mid-period rate changes (13), partially covers edge cases but misses negative-rate rejection (11), and omits the average daily balance from the output shape (14). Coverage = 6/14; of the core in-focus six [1,2,3,8,9,10] only decision 1 is correct._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "The method is **average daily balance**, applied once to the period." and Step 2: "average_balance = (sum of qualifying daily closing balances) / period_length" | Spec applies the rate once to the average of daily balances over the period, dividing by days in period, which matches the reference average-daily-balance method (not per-day daily-balance). |
| 2 | yes | no | "There is no compounding *within* a period." and "There is no day-by-day accrual walk and no within-period compounding." | The spec explicitly rejects within-period compounding, whereas the reference requires interest to compound daily within the period; addressed but the resolution is the opposite. |
| 3 | no | no | "Out of scope: ... the scheduling that decides when `post_interest` runs" | Posting frequency and anniversary alignment are declared out of scope; the 90-day quarter in the worked example is only an illustrative period, not a statement of quarterly anniversary posting. |
| 4 | yes | **yes** | "Apply the annual rate to the average, on an **Actual/360** basis ... the daily rate is `annual_rate / 360`" | Spec fixes the days-in-year basis at 360 with daily rate annual_rate/360, matching the reference exactly. |
| 5 | yes | **yes** | Step 1 threshold 1,000: "If the closing balance is **below 1,000**, the day contributes **zero**"; Step 2: "The divisor is always the **full calendar length of the period**, regardless of how many days cleared the threshold." | Threshold of 1,000 with sub-threshold days contributing zero balance but still counting in the divisor matches the reference precisely. |
| 6 | yes | **yes** | "Rounding happens **once**, at posting, and is **truncation toward zero** (floor for the non-negative amounts this engine produces) to the minor unit of 2 decimal places. The bank keeps the sub-unit fraction." | For the non-negative amounts here, truncation toward zero equals floor to 2 dp with the bank keeping the fraction, matching the reference's floor rounding. |
| 7 | yes | **yes** | "A flat **15%** withholding tax is deducted from the (rounded) gross interest on every posting ... reported separately from the net credit." | 15% withholding deducted at posting, net credited, tax reported separately, all matching the reference. |
| 8 | no | no | absent | The spec makes no mention of dormancy, a 12-month inactivity trigger, continued accrual while dormant, or a monthly dormancy fee of 5. |
| 9 | no | no | absent | The spec addresses only single-period posting and says nothing about account closure mid-period or pro-rata accrual to the closure date. |
| 10 | no | no | absent | No mention of escheatment, a 5-year dormancy horizon, or remitting the balance to the state. |
| 11 | yes | no | "The engine rejects ... **Any negative closing balance** ..." and "A day with a **zero** closing balance is valid; it simply falls below the threshold and contributes zero." | The spec covers the zero-balance no-op and never-negative/no-overdraft stance, but does not state the reference's rejection of a negative rate; being strict, one required component is absent. |
| 12 | yes | **yes** | "`period` is a half-open date range `[start, end)`: the start date is included, the end date is excluded. The end date belongs to the next period, not this one." | Half-open [start, end) boundary excludes the posting/end day from the period and assigns it to the next, matching the reference. |
| 13 | no | no | "A single **annual interest rate** is supplied ... There is one rate; the engine does not model balance tiers." | The spec assumes a single fixed rate and does not address mid-period rate changes or per-rate-segment computation, contradicting the reference requirement. |
| 14 | yes | no | Output returns "net interest posted ... updated balance ... gross interest (`gross_rounded`) and tax withheld ... the **count of qualifying days**" | Output shape is addressed and includes gross, tax, net, qualifying days and updated balance, but omits the reference-required average daily balance used, so the disclosure set is incomplete. |
