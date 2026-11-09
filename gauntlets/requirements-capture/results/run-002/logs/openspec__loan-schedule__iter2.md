# openspec — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 11 · Captured: 11/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the interactive question tool isn't the right channel here. Let me put the questions to you directly in text — these are the decisions I can't safely infer, so I'll hold off writing the spec until you've settled them.

**1. Amortization method** — how is each instalment's split determined?
- (a) **Equal instalment / annuity** — fixed total payment each period (French amortization)
- (b) **Equal principal** — constant principal portion, declining total payment
- (c) **Interest-only + balloon** — interest each period, principal repaid in full at the end

**2. Interest accrual basis** — how is each period's interest computed?
- (a) **Flat monthly** — balance × (annual nominal rate ÷ 12), ignoring actual day counts
- (b) **Actual/365** — balance × annual rate × (actual days in period ÷ 365)
- (c) **Actual/360 or 30/360** — a commercial day-count basis

**3. Rounding and residual** — what precision, and where does the leftover go?
- (a) **2 dp, final instalment absorbs the residual** so the closing balance is exactly zero
- (b) **2 dp, no adjustment** — accept small rounding drift
- (c) **Full precision** — return unrounded values

**4. Scheduling / dates** — how is the first instalment dated and awkward dates handled?
- (a) **One month after disbursement**, same day-of-month, clamp to month-end (Jan 31 → Feb 28), no business-day adjustment
- (b) **As (a) but roll weekends/holidays** to the next business day
- (c) **Fixed day of month**, with a possible short/long first period

A few **follow-ups that depend on your answers above**, which I'll also need:

**5. First-period / stub interest** — if the gap between disbursement and the first instalment isn't exactly one month, do you charge pro-rata interest for that odd first period, or always treat the first period as a full standard period?

**6. Schedule output shape** — what should `generate_schedule(loan)` return for each instalment? I'm assuming a list of rows each with: instalment number, due date, opening balance, interest due, principal due, total payment, and closing/running balance. Is that the right set, and any naming conventions I should follow?

**7. Edge cases** — should I validate/handle zero interest rate (0%), a single-instalment term, and non-positive principal, and if so how (raise, or produce a degenerate schedule)?

Once you answer these, I'll write the spec and save it as `spec.md` in this directory.
A: 1. **Equal principal** (b). A constant principal portion P/n each period; interest applies to the reducing balance; the total instalment decreases over the term. Not an annuity/EMI structure.

2. **30/360** (c). Every month is treated as 30 days, the year as 360. Interest is computed once per monthly repayment period — no daily accrual.

3. Instalments are rounded to the **whole shilling** (no cents). The accumulated rounding difference is settled in the final instalment so the closing balance is exactly zero. Intermediate amounts (opening/closing balances, interest sub-calculations) carry 2 decimal places; it is the instalment that is rounded to the whole shilling. Within each period: compute and round interest first; principal is the remainder of that rounded instalment.

4. **First due date is disbursement date + one month**, same day-of-month. No business-day roll. [Clamping behaviour for month-end dates, e.g. Jan 31 → Feb 28, is default, not policy — treat as end-of-month clamp unless you hear otherwise.]

5. **Stub interest is charged.** Interest accrues from the disbursement date. If disbursement falls before the nominal start of the first full period, a partial-period (stub) charge is levied for those extra days. Pro-rata is correct.

6. Return a row per period containing: due date, opening balance, interest, principal, instalment, closing balance. Also return: total cost of credit (sum of all interest charges) and the disclosed APR computed on an **actual/365** basis — even though accrual uses 30/360. Field naming is [default, not policy]; those labels are fine.

7. Zero or negative principal, or a zero or negative term: **reject with an error**. Zero interest rate is [default, not policy] — produce a valid schedule with zero interest charges, principal only.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that resolves most of it. Two of your answers interact in a way I want to nail down before writing, because they change the first period's interest and a disclosed figure, and I can't infer the intended behaviour.

**A. How the stub period arises (answers 4 + 5 together).** Answer 4 anchors the first due date to *disbursement + 1 month* (same day-of-month). Under that rule the first period is normally exactly one month, so I want to be precise about when a stub actually occurs and how it's charged:

- **(i) 30/360 clamp only:** No separate stub. First-period interest is just `opening × annual_rate × (30/360-day-count from disbursement date to first due date) / 360`. For most dates that equals one month; the month-end clamp (e.g. disbursed Jan 31 → due Feb 28) makes the 30/360 count 28 days, so the first period is naturally short. Interest "accrues from disbursement" falls out of this automatically.
- **(ii) Separate anchor + pre-period stub:** Instalments are pegged to a regular anchor day, and disbursement earlier than the anchor adds extra days charged pro-rata *on top of* the first full period's interest (so instalment 1 carries stub + one full month).

Which model is correct? If (ii), what is the anchor day and does the stub fold into instalment 1 or sit as a separate line? A one-line worked example (a disbursement date → first due date → first-period interest) would let me lock this down.

**B. APR definition.** You want the disclosed APR on an actual/365 basis. I read that as: the annual rate that discounts all instalment cashflows back to the disbursed principal (an IRR/XIRR over the actual calendar day-gaps from disbursement to each due date, annualised with a 365-day year). Two choices there:
- Is the disclosed figure the **effective** annual rate (compounded), or a **nominal** annualised rate (periodic IRR × periods)?
- Should the disbursement itself be a cashflow at day 0 (standard), and are there any fees to include, or is it purely principal-vs-instalments?

**C. Currency unit (quick confirm).** "Whole shilling, no cents" — so the instalment is an integer number of shillings, and the loan currency is shillings. Correct?

Once I have A and B, I'll write `spec.md`.
A: A. Model (ii) is correct. Instalments are pegged to a regular anchor day; disbursement before that anchor creates a stub, which is charged pro-rata for those extra days on top of the first full period's interest, and folds into instalment 1 (not a separate line). The anchor day is [default, not policy — treat the 1st of the following calendar month as the anchor unless told otherwise]. Worked example at that default: disbursed 15 Jan → anchor/period-1 start 1 Feb → first due date 1 Mar. Stub covers 15 Jan to 1 Feb (17 actual days); first instalment carries stub interest + one full 30/360 month's interest on the same opening balance, plus the standard principal portion.

B. The disclosed APR is an IRR over actual calendar day-gaps from disbursement (day 0, the principal outflow) to each instalment cashflow, annualised on a 365-day year — so an XIRR in spreadsheet terms. Whether that is expressed as an effective (compounded) or nominal (periodic rate × 12) figure is [default, not policy — use the effective annual rate, which is the standard regulatory disclosure form]. Fees: [default, not policy — include only the principal-vs-instalments cashflows unless fees are confirmed separately].

C. Correct. Currency is Kenyan shilling (KES). Each instalment is an integer number of shillings; no cents.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as `spec.md` in this directory. It is done.

A few notes on what it captures and why:

- **Every material policy decision you confirmed** is encoded explicitly in §4 and §5: equal-principal amortisation, 30/360 accrual, model-(ii) stub folded into instalment 1, whole-shilling (KES) instalments, interest-first/principal-as-remainder, final-instalment residual settlement, and the actual/365 effective-APR via XIRR.
- **The worked example (§9)** is fully computed end-to-end (100,000 KES / 18% / 6 months / disbursed 15 Jan 2026) and ties out: principals sum to exactly 100,000, the final row zeroes the balance, and total cost of credit = 6,100 KES. It doubles as acceptance test #13.
- **Recorded assumptions (§10)** lists everything you marked "default, not policy" plus the items left unspecified, so the policy choices and the defaults are clearly separated.

One item I want to put in front of you rather than bury — it's the single choice I had to make without an explicit answer:

- **Stub day-count denominator (§5.2 / §10.3):** the stub is "pro-rata over actual days," but the year basis wasn't specified. I defaulted to **actual/360** to stay consistent with the 30/360 accrual year. In the worked example this gives stub interest of `100,000 × 0.18 × 17/360 = 850`. If you'd prefer **actual/365** (which would make it `~838`), tell me and I'll update §5.2, §9, and §10.3.

Per the planning boundary, I've stopped at the spec and have not written any engine code. If you'd like me to turn this into the full OpenSpec change (proposal/design/tasks) or start implementing `generate_schedule`, just say so.
A: Stub denominator: confirm **actual/360**. The year basis for the stub is 360, consistent with the 30/360 accrual convention. Your default is correct; no change needed to §5.2, §9, or §10.3.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is complete and finalized. `spec.md` is saved in this directory, and every policy decision — including the now-confirmed actual/360 stub denominator — is locked in. It is done.

All material choices are stakeholder-confirmed (equal-principal, 30/360 accrual, model-(ii) stub, whole-shilling KES instalments, final-instalment residual, actual/365 effective APR, and actual/360 stub). The only remaining items in §10 are genuine low-impact defaults (anchor day, month-end clamp, rounding mode, APR effective/fees, zero-rate, field labels) that you can revisit anytime.

Nothing further is pending. When you're ready to move from planning to building, let me know and I'll implement `generate_schedule` against this spec.
A: Confirmed. Specification is complete and all decisions are locked.

## Produced specification

# Loan Repayment Schedule Engine — Specification

## 1. Purpose

Given a disbursed loan, produce the full repayment schedule: one row per
instalment showing the interest due, the principal due, the instalment total, and
the running balance, together with the total cost of credit and a disclosed APR.

The engine implements an **equal-principal (constant amortisation)** product with
**30/360** interest accrual, **pro-rata stub interest** for the odd first period,
and **whole-shilling (KES) instalments**. These are deliberate institutional
policy choices, not inferences — see §4.

## 2. Interface

```
generate_schedule(loan) -> ScheduleResult
```

### 2.1 Input (`loan`)

| Field               | Type     | Meaning                                              |
|---------------------|----------|------------------------------------------------------|
| `principal`         | decimal  | Disbursed principal in KES. Must be > 0.             |
| `annual_rate`       | decimal  | Annual **nominal** interest rate, e.g. `0.18` = 18%. Must be ≥ 0. |
| `term_months`       | integer  | Number of monthly instalments. Must be ≥ 1.          |
| `disbursement_date` | date     | Date the funds were disbursed.                       |

### 2.2 Output (`ScheduleResult`)

- `schedule`: ordered list of instalment rows (one per `term_months`), each with:
  - `due_date`
  - `opening_balance`
  - `interest`
  - `principal`
  - `instalment`
  - `closing_balance`
- `total_cost_of_credit`: sum of `interest` across every row (KES).
- `apr`: disclosed Annual Percentage Rate (see §7).

Field names/labels are a non-policy default and may be adapted to house style.

## 3. Currency & precision

- Currency is the **Kenyan shilling (KES)**.
- **Instalment amounts are integers** — whole shillings, no cents.
- Intermediate values (opening/closing balances, raw interest sub-calculations)
  are carried at **2 decimal places**; only the instalment total is rounded to the
  whole shilling.
- Rounding mode for the whole-shilling step is **round-half-up** (non-policy
  default; see §10).

## 4. Confirmed policy decisions

1. **Amortisation: equal principal.** The principal portion is constant at
   `principal / term_months` each period (subject to rounding); interest is charged
   on the reducing balance, so the total instalment **decreases** over the term.
   This is **not** an annuity/EMI product.
2. **Interest accrual: 30/360.** Every month is treated as 30 days and the year as
   360 days. A full monthly period therefore accrues
   `opening_balance × annual_rate × 30/360` (= `opening_balance × annual_rate / 12`).
   There is no daily accrual for regular periods.
3. **Stub interest is charged (model (ii)).** Instalments are pegged to a regular
   **anchor day**; because disbursement normally falls *before* the start of the
   first full period, a **pro-rata stub charge** covers the gap days. The stub
   **folds into instalment 1** on top of the first full month's interest (not a
   separate schedule row).
4. **First due date and date scheme:** derived from the anchor (see §5.1).
5. **Rounding & residual:** instalments are whole shillings; the accumulated
   rounding difference is settled in the **final instalment** so the closing
   balance reaches exactly zero (see §5.4).
6. **Within a period:** interest is computed and rounded **first**; the principal
   is the **remainder** of the rounded instalment (see §5.3).
7. **APR:** disclosed as an **effective annual rate** via XIRR on **actual/365**
   day-gaps, independent of the 30/360 accrual basis (see §7).
8. **Validation:** non-positive principal or non-positive term are rejected (§8).

## 5. Computation

### 5.1 Date scheme

- **Anchor day** = the **1st of the calendar month following disbursement**
  (non-policy default — see §10).
- **Stub period** = from `disbursement_date` (inclusive) to the anchor date,
  measured in **actual calendar days**.
- **Period 1** runs from the anchor to the first due date; the first due date is
  the anchor **+ 1 month**.
- **Due dates:** `due_i = anchor + i months`, for `i = 1 … term_months`, always
  falling on the anchor day-of-month. Month-end clamp applies to the date
  arithmetic (e.g. a 31st anchor → 30th/28th where the day does not exist); this
  clamp is a non-policy default (§10).

> Worked date example: disbursed **15 Jan** → anchor **1 Feb** → stub = **15 Jan →
> 1 Feb = 17 actual days** → first due **1 Mar**, then 1 Apr, 1 May, …

### 5.2 Interest

For each period `i` with opening balance `B_i`:

- **Regular monthly interest** (all periods):
  `month_interest_i = B_i × annual_rate × 30/360` (2 dp).
- **Stub interest** (period 1 only):
  `stub_interest = B_1 × annual_rate × stub_days / 360` (2 dp).
  The stub uses the **actual** gap days over a **360-day** year, consistent with the
  30/360 accrual basis (denominator is a non-policy default — see §10).
- **Raw interest for the row:**
  - Period 1: `raw_interest_1 = stub_interest + month_interest_1`
  - Period i > 1: `raw_interest_i = month_interest_i`
- **Rounded interest:** `interest_i = round_half_up(raw_interest_i)` to the whole
  shilling.

Both the stub and the first full month accrue on the **same opening balance**
(full principal), because no principal has yet been repaid.

### 5.3 Principal & instalment

Let `base_principal = principal / term_months` (constant, carried at 2 dp).

For periods `i = 1 … term_months − 1`:

1. `interest_i` as in §5.2 (already a whole shilling).
2. `instalment_i = round_half_up(base_principal + interest_i)` (whole shilling).
3. `principal_i = instalment_i − interest_i` (the **remainder**; a whole shilling,
   equal to `round_half_up(base_principal)` each period).
4. `closing_balance_i = opening_balance_i − principal_i`.

### 5.4 Final instalment (residual settlement)

For the final period `i = term_months`:

- `interest_i` as in §5.2.
- `principal_i = opening_balance_i` — i.e. the **entire remaining balance**, so the
  accumulated whole-shilling rounding difference is settled here and
  `closing_balance_i = 0` exactly.
- `instalment_i = principal_i + interest_i`.

## 6. Total cost of credit

`total_cost_of_credit = Σ interest_i` over all rows (KES, whole shillings since
each `interest_i` is rounded).

## 7. Disclosed APR

- The APR is the **effective annual rate** `a` solving the cashflow equation:

  ```
  principal = Σ_i  instalment_i / (1 + a) ^ (day_offset_i / 365)
  ```

  where `day_offset_i` = **actual calendar days** from `disbursement_date` (day 0,
  the principal outflow) to `due_date_i`.

- This is an **XIRR** over actual/365 day-gaps, solved numerically (e.g.
  bisection/Newton). The 30/360 accrual basis does **not** apply to the APR.
- The disclosed figure is **effective (compounded)**, the standard regulatory
  form (non-policy default — see §10).
- Cashflows include **principal vs. instalments only**; no fees are included
  (non-policy default — see §10).

## 8. Validation & edge cases

- **Reject with an error:** `principal ≤ 0`, or `term_months ≤ 0` / non-integer.
- **Zero interest rate (`annual_rate = 0`):** produce a valid schedule — all
  interest (including stub) is 0; instalments are principal-only; the final row
  still zeroes the balance. (Non-policy default — see §10.)
- **Single instalment (`term_months = 1`):** one row; its principal equals the full
  principal and it carries the stub + one month's interest.

## 9. Worked example

Loan: `principal = 100,000` KES, `annual_rate = 0.18`, `term_months = 6`,
`disbursement_date = 15 Jan 2026`.

- Anchor = 1 Feb 2026; stub = 17 days; due dates 1 Mar … 1 Aug 2026.
- `base_principal = 16,666.67`; monthly rate = 1.5%; stub factor = `0.18 × 17/360
  = 0.0085`.

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---|----------|---------|----------|-----------|------------|---------|
| 1 | 1 Mar 26 | 100,000 | 2,350 (=850 stub + 1,500 month) | 16,667 | 19,017 | 83,333 |
| 2 | 1 Apr 26 |  83,333 | 1,250 | 16,667 | 17,917 | 66,666 |
| 3 | 1 May 26 |  66,666 | 1,000 | 16,667 | 17,667 | 49,999 |
| 4 | 1 Jun 26 |  49,999 |   750 | 16,667 | 17,417 | 33,332 |
| 5 | 1 Jul 26 |  33,332 |   500 | 16,667 | 17,167 | 16,665 |
| 6 | 1 Aug 26 |  16,665 |   250 | 16,665 | 16,915 |      0 |

- `total_cost_of_credit = 2,350 + 1,250 + 1,000 + 750 + 500 + 250 = 6,100` KES.
- Principal repaid = `16,667 × 5 + 16,665 = 100,000` (final row absorbs the
  −2 shilling rounding residual).
- APR: XIRR over actual/365 day-offsets `{45, 76, 106, 137, 167, 198}` against the
  instalment cashflows above; computed numerically (effective annual rate,
  somewhat above 18% because the stub front-loads interest).

## 10. Recorded assumptions (defaults — overridable by the stakeholder)

These were marked "default, not policy" or were left unspecified and defaulted:

1. **Anchor day = 1st of the following calendar month.**
2. **Month-end clamp** for date arithmetic (e.g. Jan 31 → Feb 28).
3. **Stub day-count denominator = actual/360** (actual gap days ÷ 360), for
   consistency with the 30/360 accrual year. *Confirmed by stakeholder.*
4. **Rounding mode = round-half-up** to the whole shilling.
5. **APR expressed as an effective (compounded) annual rate.**
6. **APR excludes fees** — principal-vs-instalments cashflows only.
7. **Zero interest rate** yields a valid principal-only schedule.
8. **Field names/labels** follow convenient defaults.

## 11. Acceptance criteria

1. `generate_schedule` returns exactly `term_months` rows.
2. Each `instalment` is a whole number of shillings.
3. `principal` is constant (= `round_half_up(principal / term_months)`) for all rows
   except the final one, which absorbs the residual.
4. The final row's `closing_balance` is **exactly 0**.
5. Σ `principal` across all rows equals the input `principal` exactly.
6. For each row, `instalment = interest + principal` and
   `closing_balance = opening_balance − principal`.
7. Instalment 1 includes stub interest (actual/360) plus one full 30/360 month on
   the full principal.
8. Regular-period interest equals `opening_balance × annual_rate / 12`, rounded.
9. `total_cost_of_credit` equals the sum of all `interest` values.
10. `apr` satisfies the §7 XIRR equation to the engine's tolerance.
11. `principal ≤ 0` or `term_months ≤ 0`/non-integer raises an error.
12. `annual_rate = 0` produces a valid, interest-free, balance-zeroing schedule.
13. The §9 worked example reproduces exactly.


## Auditor verdict

_The spec covers 11 of 14 reference decisions correctly (coverage 11/14 ≈ 0.79). It nails the core off-default method and rounding choices: equal-principal amortisation (#2), 30/360 accrual (#3), period-based (non-daily) interest (#4), stub/partial-period interest from disbursement (#5), whole-shilling instalments with residual in the final row (#7), interest-rounded-first/principal-as-remainder ordering (#8), zero closing balance (#9), and the non-obvious 30/360-accrual-but-actual/365-APR disclosure split (#14), plus the inferable anchors #1, #6, #12. Two bespoke method decisions are entirely absent: the Rule-of-78 early-settlement rebate (#10) and the term-fixed re-amortisation on partial prepayment (#11). Decision #13 is surfaced but wrong: the spec's anchor-to-1st-of-next-month scheme yields a first due date that differs from the reference's disbursement-date-plus-one-month rule. The gap concentrates on bespoke decisions (#10, #11), consistent with the reference's design intent._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §4.1 'interest is charged on the reducing balance'; §5.2 'month_interest_i = B_i × annual_rate × 30/360' where B_i is the opening (reducing) balance. | Interest is explicitly computed on the declining/reducing principal balance each period, matching declining balance. |
| 2 | yes | **yes** | §4.1 'Amortisation: equal principal. The principal portion is constant at principal / term_months each period ... so the total instalment decreases over the term. This is not an annuity/EMI product.' | Exact match: constant P/n principal, interest on reducing balance, decreasing instalment, explicitly not EMI. |
| 3 | yes | **yes** | §4.2 'Interest accrual: 30/360. Every month is treated as 30 days and the year as 360 days.' | Day-count convention stated as 30/360 exactly as in the reference. |
| 4 | yes | **yes** | §4.2 'There is no daily accrual for regular periods'; §5.2 interest computed once per monthly period as B_i × rate × 30/360. | Interest calculation period is the repayment period (one computation per month), explicitly not daily accrual. |
| 5 | yes | **yes** | §4.3 'a pro-rata stub charge covers the gap days'; §5.2 'stub_interest = B_1 × annual_rate × stub_days / 360'; §5.1 stub from disbursement date to anchor. | Partial-period (stub) interest is levied for the days between disbursement and the first period start, so interest effectively accrues from disbursement; matches the reference. |
| 6 | yes | **yes** | §3 'Currency is the Kenyan shilling (KES)'; 'Intermediate values ... are carried at 2 decimal places'. | Currency is KES and 2-decimal precision is stated (for intermediate values); the whole-shilling instalment refinement is the separate decision #7. Currency and base precision match. |
| 7 | yes | **yes** | §3 'Instalment amounts are integers — whole shillings, no cents'; §5.4 final instalment absorbs residual so 'closing_balance_i = 0 exactly'. | Instalments rounded to the whole shilling and the accumulated rounding difference settled in the final instalment, exactly the reference policy. |
| 8 | yes | **yes** | §4.6 'interest is computed and rounded first; the principal is the remainder of the rounded instalment'; §5.3 'principal_i = instalment_i − interest_i'. | Interest is rounded first and principal is the remainder of the rounded instalment, matching the ordering rule. |
| 9 | yes | **yes** | §5.4 'closing_balance_i = 0 exactly'; acceptance criterion 4 'The final row's closing_balance is exactly 0.' | Final instalment reconciles so the closing balance is exactly zero. |
| 10 | no | no | absent | The spec covers schedule generation, APR and validation but says nothing about early full settlement, rebate of unearned interest, or the Rule of 78. |
| 11 | no | no | absent | No mention of partial prepayment, applying extra payments to principal, or re-amortisation (term-fixed vs instalment-fixed) anywhere in the spec. |
| 12 | yes | **yes** | §8 'Reject with an error: principal ≤ 0, or term_months ≤ 0 / non-integer.' | Zero/negative principal and zero/negative term are explicitly rejected as invalid, matching the reference. |
| 13 | yes | no | §5.1 'Anchor day = the 1st of the calendar month following disbursement ... the first due date is the anchor + 1 month'; worked example disbursed 15 Jan → first due 1 Mar. | Reference sets first due = disbursement date + one month (e.g. 15 Jan → 15 Feb). The spec instead anchors to the 1st of the following month and adds a month, giving 1 Mar for a 15 Jan disbursement, a different first due date; so it does not match. |
| 14 | yes | **yes** | §2.2 schedule rows (due_date, opening_balance, interest, principal, instalment, closing_balance), total_cost_of_credit = Σ interest, apr; §7 'XIRR over actual/365 day-gaps. The 30/360 accrual basis does not apply to the APR.' | Full per-period schedule, total cost of credit as sum of interest, and APR disclosed on an actual/365 basis despite 30/360 accrual — the exact dual-day-count disclosure quirk. |
