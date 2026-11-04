# spec-kit — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 13 · Captured: 10/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like that prompt didn't go through. Let me put the questions to you directly so you can answer in whatever form suits you. These are the four decisions that most shape the engine; the brief leaves all of them open.

**1. Amortisation method.** What shape are the payments?
- *Equal instalment (annuity/French)* — every total payment identical, interest on declining balance, principal portion grows.
- *Equal principal (straight-line/German)* — principal portion constant, total payment falls over time.
- *Interest-only + balloon* — instalments pay interest only, principal repaid in full at the end.
- *Bullet* — single payment of principal plus interest at term end.

**2. Interest accrual / day count.** How does the annual nominal rate become a per-period charge?
- *Flat rate ÷ 12* — uniform monthly rate, ignores actual days in month.
- *Actual/365 fixed*, *Actual/360*, or *30/360* — interest scales with actual (or conventional) days in each period.

**3. Rounding.** To what precision, and how is the residual cleared?
- Typically: round to 2 dp each period, and adjust the final instalment so the closing balance lands exactly on zero. But I need your rounding mode (half-up vs banker's) and precision (2 dp / whole units / exact).

**4. First instalment timing.** When is the first payment due, and is there a stub?
- *One month after, full period* — first instalment one month out, every period a standard month, no stub.
- *Fixed due day, prorated stub* — instalments on a fixed day of month, first period possibly long/short with interest prorated for actual days.

If you answer those four, I'll follow up with a shorter second round (payment-in-arrears vs advance, zero/degenerate inputs, and the exact output fields) and then write `spec.md`.
A: 1. **Amortisation method:** Equal principal. The principal portion is constant each period (P/n); interest is charged on the reducing balance; the total instalment therefore falls over the term.

2. **Day count:** 30/360. Every month is treated as 30 days, the year as 360. The nominal annual rate is divided by 12 to give a uniform monthly rate — no scaling for actual days in the month.

3. **Rounding:** Round each instalment to the whole shilling (no cents). Accumulate the rounding difference across periods and settle it in the final instalment so the closing balance is exactly zero. Rounding mode (half-up vs. banker's): half-up [default, not policy].

4. **First instalment timing:** One month after the disbursement date; subsequent instalments monthly thereafter. If disbursement falls before the first period start, a stub interest charge is levied for those extra days — partial-period interest is charged, not waived.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Equal principal, 30/360 with rate ÷ 12, round to whole shillings with the residual cleared in the final instalment, first instalment one month out with a prorated stub for any extra days. Got it. That pins the core maths. A few of those answers open smaller questions I need to close before the spec is exact.

**5. The stub — this is the one I most need nailed down.** Your answer 4 says the first instalment is one month after disbursement, but *also* that a stub charge applies "if disbursement falls before the first period start." Those only coexist if the schedule has an anchor separate from the disbursement date. So:
- Is there a fixed **due-day anchor** (e.g. instalments always fall on the 1st, or on a set day of month), with the stub covering the gap from disbursement to the first anchored period? Or is the schedule purely relative (disbursement + 1 month, + 2 months, …) — in which case, under what circumstance does a stub ever arise?
- How is the stub **charged**: folded into the first instalment's interest line, or shown as its own separate row (instalment 0)?
- Stub interest = balance × (annual rate) × (stub days ÷ 360), with stub days counted by the 30/360 rule? Confirm the denominator is 360, not 30.
- The stub charges interest only; it does not repay principal or count as one of the *n* instalments. Correct?

**6. Payment timing.** Instalments in arrears (interest accrued over the period just ended, paid at period end)? I'm assuming yes.

**7. What exactly gets rounded to the whole shilling?** For equal principal the principal portion is P/n, which is rarely whole. Do you round the **principal portion** and the **interest** to whole shillings independently each period, or round only the **total instalment**? And the running residual you mention — is it a rounding residual on interest, on principal, or on the total, that the final instalment absorbs?

**8. Degenerate / invalid inputs.** How should `generate_schedule` behave for: zero interest rate (schedule of pure principal repayments — fine?); term of zero months; negative or zero principal; a non-integer term? Reject with an error, or is there a defined behaviour?

**9. Output shape.** What must each schedule row expose? I'm assuming: instalment number, due date, opening balance, interest due, principal due, total instalment, closing balance. Any others (e.g. cumulative interest)? And which currency is this — Kenyan shilling? What date format?

Answer these and I'll write `spec.md`.
A: 5. **Stub — confirmed.** There is a fixed due-day anchor (the day-of-month on which instalments fall). The stub covers the days from disbursement to that first anchor date; the first instalment then falls on the anchor date approximately one month later, and subsequent instalments on the same anchor day each month. Stub interest = opening balance × (annual rate ÷ 360) × stub days; stub days are counted by the 30/360 convention, denominator 360. The stub is interest-only — no principal is repaid and it does not consume one of the n scheduled instalments. It appears as its own row (instalment 0) ahead of the main schedule [row placement is default, not policy — adjust if the system treats it differently]. The stub closes with the same opening balance as instalment 1.

6. **Payment timing:** Instalments in arrears — interest accrues over the period just ended and is paid at period end. [Default, not policy.]

7. **What gets rounded.** Interest for the period is computed and rounded first (to the whole shilling). Principal for that period is the remainder: rounded instalment minus rounded interest. The total instalment is the rounded figure. The running residual is therefore a residual on the total instalment, accumulated period by period, and the final instalment absorbs it so the closing balance lands at exactly zero.

8. **Degenerate inputs.** Zero or negative principal, and a term of zero or fewer months: rejected with an error. Non-integer term: rejected with an error. Zero interest rate: valid — produces a schedule of pure equal-principal repayments with zero interest each period. [Zero-rate behaviour is default, not policy.]

9. **Output shape.** Each row: instalment number, due date, opening balance, interest due, principal due, total instalment, closing balance. Summary fields: total cost of credit (sum of all interest charges across all rows including the stub) and the disclosed APR, computed on an actual/365 basis regardless of the 30/360 accrual convention. Currency: Kenyan shilling (KES), with instalment amounts as whole shillings as per the rounding rule. Date format: ISO 8601 (YYYY-MM-DD) [default, not policy].

### Round 3
_Step reasoning:_ (live agent turn)

Q: Two of those answers create a dependency I have to resolve, and one needs its method pinned. Nearly there.

**10. Where does the due-day anchor come from?** This is the gap. The loan input in the brief carries only principal, rate, term and disbursement date — no anchor day. But the stub only exists because the anchor day-of-month differs from the disbursement day. So:
- Is the anchor a **product-level constant** (e.g. instalments always fall on the 1st), or an **additional per-loan field** I should add to the `loan` input?
- What determines the **first anchor date** — the next occurrence of the anchor day strictly after disbursement, so the first *instalment* is the anchor date roughly a month after *that*? Or is the first instalment the first anchor date on or after disbursement + 1 month?
- If disbursement falls **exactly on** the anchor day, the stub is zero days: do you omit the instalment-0 row entirely, or emit a zero-value stub row?
- Can the stub ever exceed a month (disbursement long before the first anchor), or is it always a partial month, 1–30 days?

**11. APR method.** "Disclosed APR on an actual/365 basis" — confirm this means: the APR is the annualised rate that discounts every cash flow (the stub charge and all instalments) back to the disbursement date so their present value equals the disbursed principal, with the time to each cash flow measured in actual days ÷ 365. That is, the internal rate of return of the loan's cash flows, annualised, actual/365. If you have a specific formula (e.g. a nominal periodic IRR × periods, versus a compounded effective annual rate), tell me which.

**12. Equal-principal rounding — confirming my reading.** Per period: nominal principal = P/n; nominal total instalment = P/n + exact interest. I round the **interest** to whole shillings, round the **total instalment** to whole shillings, and set **principal = rounded instalment − rounded interest** (so the constant P/n drifts by a shilling here and there). The running balance reduces by that principal; the final instalment's principal is forced to whatever clears the balance to zero. Correct?

These three and I'll write it.
A: 10. **Anchor source.** The anchor day is an additional per-loan input field — add it to the `loan` object alongside principal, rate, term and disbursement date [default, not policy; the brief does not specify, so treat it as a required field rather than a product constant]. The first anchor date is the first occurrence of that anchor day-of-month strictly after the disbursement date; the first instalment falls on the same anchor day approximately one month after that. If disbursement falls exactly on the anchor day, the stub is zero days — omit the instalment-0 row entirely. The stub is always a partial month, 1–30 days (capped at 30 by the 30/360 convention); it cannot exceed one month.

11. **APR method.** Confirmed as XIRR/IRR: the APR is the compounded effective annual rate r such that the present value of all cash flows — stub charge (if any) and each instalment — discounted at r back to the disbursement date equals the disbursed principal, with each cash flow's time measured in actual days ÷ 365. Use the compounded effective annual rate, not nominal periodic IRR × n [default, not policy — a specific regulatory formula would override this].

12. **Rounding — confirmed.** Your reading is correct. Per period: compute exact interest on the opening balance; round to the whole shilling; the nominal total instalment is that rounded interest plus P/n, rounded again to the whole shilling; principal is rounded instalment minus rounded interest. The balance reduces by that principal. The final instalment's principal is forced to whatever clears the closing balance to exactly zero, absorbing all accumulated rounding residual.

### Round 4
_Step reasoning:_ (live agent turn)

Q: It's done. `spec.md` is saved in this directory.

The specification pins down the six policy decisions the brief left open, each confirmed with you rather than inferred: equal-principal amortisation, 30/360 interest with the nominal rate divided by 12, whole-shilling round-half-up with the residue cleared in the final instalment, a fixed anchor-day schedule with an interest-only 30/360 stub for the days before the first anchor date, total cost of credit as the sum of all interest, and a compounded effective-annual APR on actual/365.

A few things worth flagging in what I wrote:

- **The anchor day became a required input field.** The brief's `loan` carries no anchor, but the stub can't exist without one, so I added `anchor_day` to the input and said so explicitly rather than smuggling in a product constant.
- **The golden example is fully worked and self-checking.** Principal sums to 100,000, total cost of credit lands on 7,000, and the final instalment closes at exactly zero. It doubles as an acceptance test.
- **I did not fabricate an APR figure.** The method is specified precisely, but the numeric APR for the example is left as the solver's output since it needs iteration I didn't run by hand.
- **Two small edges you didn't rule on, defaulted and flagged:** month-end clamping for anchor days of 29–31, and rejection of negative rates. Both are in "Assumptions and defaults" so you can overturn either without touching policy.

If any of those defaults should be firmer policy, tell me and I'll fold the decision in.
A: The spec sounds complete and well-grounded. On the two open defaults: both can stay as flagged rather than being elevated to policy. Month-end clamping — clamp to the last valid day of the month for anchor days 29–31 [default, not policy]. Negative rates — reject as invalid [default, not policy]. No changes needed to the policy sections.

### Round 5
_Step reasoning:_ (live agent turn)

Q: Both already match what's in the spec, and they stay where they are: in "Assumptions and defaults" as flagged defaults, not elevated to policy. Month-end clamp for anchor days 29–31 (FR-010, FR-011) and negative-rate rejection (FR-004) are both recorded that way. No edits needed.

The spec is final at `spec.md`.
A: Understood. The specification is final.

## Produced specification

# Repayment schedule engine — requirements specification

Status: draft for build
Interface: `generate_schedule(loan)`
Currency: Kenyan shilling (KES), whole shillings only

## Summary

Given a disbursed loan, produce its full repayment schedule: for each instalment the
interest due, the principal due, the total instalment and the running balance, plus a
leading interest-only stub charge where one applies and two summary figures (total cost
of credit and disclosed APR). The engine amortises on an equal-principal basis with a
30/360 interest convention, rounds to whole shillings, and settles all rounding residue
in the final instalment so the schedule closes at exactly zero.

Every material policy below was fixed with the stakeholder. Points marked *default* were
chosen sensibly where the stakeholder deferred, and may be revisited without reopening
policy. They are collected in "Assumptions and defaults".

## Inputs

`generate_schedule(loan)` takes a single `loan` object with these fields:

| Field | Type | Meaning |
|---|---|---|
| `principal` | integer, KES | Disbursed amount, a positive whole number of shillings. Denoted P. |
| `annual_rate` | decimal | Annual **nominal** interest rate, as a fraction (0.12 for 12%). |
| `term` | integer | Number of monthly instalments. Denoted n. |
| `disbursement_date` | date | Date the funds were disbursed (ISO 8601, YYYY-MM-DD). |
| `anchor_day` | integer 1–31 | Day of month on which instalments fall. Added to the loan object because the brief supplies no anchor and the stub depends on it. |

### Input validation

- **FR-001** Reject with an error when `principal` is zero or negative.
- **FR-002** Reject with an error when `term` is zero or negative.
- **FR-003** Reject with an error when `term` is not an integer.
- **FR-004** Reject with an error when `annual_rate` is negative. Zero is valid (see FR-020).
- **FR-005** Reject with an error when `anchor_day` is outside 1–31.

Rejection is an explicit, typed failure, not a silent empty schedule or a null return.

## Policy decisions

These are the pinned choices the engine implements. They are not inferable from the brief;
each was confirmed with the stakeholder.

| Decision | Choice |
|---|---|
| Amortisation method | **Equal principal** (straight-line). Principal portion is P/n each period; interest is charged on the reducing balance; the total instalment falls over the term. |
| Interest convention | **30/360.** Every month is 30 days, the year is 360. The nominal annual rate is divided by 12 for a uniform monthly rate. No scaling for actual days in the month. |
| Rounding | Whole shillings, no cents. Round-half-up. Interest rounded first; total instalment rounded; principal is the difference. Accumulated residue cleared in the final instalment. |
| First instalment timing | One anchored month after the first anchor date. Payments in arrears. |
| Stub | Interest-only charge for the days between disbursement and the first anchor date, on a 30/360 basis. It does not repay principal and does not consume one of the n instalments. |
| Total cost of credit | Sum of every interest charge, the stub included. |
| APR | Compounded effective annual internal rate of return of all cash flows, actual/365. |

## Schedule construction

### Dates and the stub

- **FR-010** The **first anchor date** A0 is the first occurrence of `anchor_day` strictly
  after `disbursement_date`. When a month is shorter than `anchor_day`, the date falls on
  the last day of that month (*default*, month-end clamp).
- **FR-011** Instalment k (for k = 1..n) falls on `anchor_day` in the month k months after
  A0, with the same month-end clamp. Instalment 1 is therefore one anchored month after A0.
- **FR-012** The **stub period** runs from `disbursement_date` to A0. Its length in days is
  counted on a 30/360 basis, with each day-of-month capped at 30 (30E/360). The result is
  always 1–30 days; a stub cannot exceed one month.
- **FR-013** When `disbursement_date` falls exactly on `anchor_day`, the stub is zero days.
  In that case omit the stub row entirely; A0 equals the disbursement date and instalment 1
  falls one month later.

### Stub charge (instalment 0)

- **FR-014** When a stub applies, emit one leading row, instalment number 0, due on A0:
  - opening balance = P
  - interest due = round( P × (`annual_rate` / 360) × stub_days )
  - principal due = 0
  - total instalment = the stub interest
  - closing balance = P (unchanged; the same opening balance instalment 1 sees)
- Placement of the stub as a leading instalment-0 row is *default*; adjust if the host
  system files stub interest differently.

### Regular instalments

For each instalment k = 1..n, in order, carrying the opening balance forward:

- **FR-015** Compute exact interest on the opening balance: `interest_exact = opening × (annual_rate / 12)`.
- **FR-016** Round interest to the whole shilling (half-up): `interest = round(interest_exact)`.
- **FR-017** Form the nominal total instalment `interest + P/n` and round it to the whole
  shilling (half-up): `instalment = round(interest + P/n)`.
- **FR-018** Set `principal = instalment − interest`.
- **FR-019** Set `closing = opening − principal`; carry `closing` forward as the next
  opening balance.
- **FR-020** When `annual_rate` is zero, interest is zero every period and each instalment
  is pure principal repayment. This is valid, not an error (*default*).

### Final instalment

- **FR-021** On the last instalment (k = n) the principal is forced to whatever clears the
  balance: `principal = opening`. The total instalment is `principal + interest`, and the
  closing balance is exactly zero. This absorbs all accumulated rounding residue, so the
  schedule always closes at zero regardless of how the per-period rounding drifted.

### Summary figures

- **FR-022** **Total cost of credit** is the sum of every interest charge across the whole
  schedule, the stub interest included.
- **FR-023** **APR** is the compounded effective annual rate r for which the present value
  of all cash flows equals the disbursed principal:

  P = Σ CF_t / (1 + r)^(days_t / 365)

  where each CF_t is a positive cash inflow to the lender (the stub charge, then each total
  instalment), and days_t is the actual calendar days from `disbursement_date` to that cash
  flow's due date. This is the internal rate of return of the loan's cash flows, expressed
  as a compounded effective annual rate on an actual/365 basis, deliberately independent of
  the 30/360 accrual convention. Solve numerically. Report as a percentage to two decimal
  places (*default* precision). A specific regulatory APR formula, if mandated, overrides
  this method.

## Output

`generate_schedule` returns the schedule as an ordered collection of rows plus the two
summary figures.

Each row exposes:

| Field | Notes |
|---|---|
| instalment number | 0 for the stub (when present), then 1..n |
| due date | ISO 8601, YYYY-MM-DD |
| opening balance | KES, whole shillings |
| interest due | KES, whole shillings |
| principal due | KES, whole shillings; 0 for the stub |
| total instalment | KES, whole shillings |
| closing balance | KES, whole shillings; 0 on the final row |

Summary:

| Field | Notes |
|---|---|
| total cost of credit | KES, whole shillings; sum of all interest, stub included |
| APR | percentage, effective annual, actual/365 |

## Worked example (golden)

Input: `principal = 100000`, `annual_rate = 0.12`, `term = 12`,
`disbursement_date = 2026-01-20`, `anchor_day = 5`.

Monthly rate 1%. First anchor date A0 = 2026-02-05. Stub days on 30/360 from 2026-01-20 to
2026-02-05 = 15. Stub interest = 100000 × 0.12 / 360 × 15 = 500.

| # | Due date | Opening | Interest | Principal | Instalment | Closing |
|---:|---|---:|---:|---:|---:|---:|
| 0 | 2026-02-05 | 100000 | 500 | 0 | 500 | 100000 |
| 1 | 2026-03-05 | 100000 | 1000 | 8333 | 9333 | 91667 |
| 2 | 2026-04-05 | 91667 | 917 | 8333 | 9250 | 83334 |
| 3 | 2026-05-05 | 83334 | 833 | 8333 | 9166 | 75001 |
| 4 | 2026-06-05 | 75001 | 750 | 8333 | 9083 | 66668 |
| 5 | 2026-07-05 | 66668 | 667 | 8333 | 9000 | 58335 |
| 6 | 2026-08-05 | 58335 | 583 | 8333 | 8916 | 50002 |
| 7 | 2026-09-05 | 50002 | 500 | 8333 | 8833 | 41669 |
| 8 | 2026-10-05 | 41669 | 417 | 8333 | 8750 | 33336 |
| 9 | 2026-11-05 | 33336 | 333 | 8333 | 8666 | 25003 |
| 10 | 2026-12-05 | 25003 | 250 | 8333 | 8583 | 16670 |
| 11 | 2027-01-05 | 16670 | 167 | 8333 | 8500 | 8337 |
| 12 | 2027-02-05 | 8337 | 83 | 8337 | 8420 | 0 |

Principal sums to 100000 (eleven periods of 8333 plus a final 8337). Total interest =
6500 across the instalments plus 500 stub = **total cost of credit 7000**. APR is the
solver output for the cash flows above; it exceeds the 12% nominal rate because the stub
front-loads interest and instalments fall due monthly.

Note the final instalment: its principal is 8337, not 8333, because the earlier rounding
drift is settled here so the closing balance lands on zero.

## Edge cases

- **Zero-day stub.** Disbursement on the anchor day: no stub row, first instalment one
  month after disbursement (FR-013).
- **Zero rate.** Valid; every instalment is pure principal, stub interest is zero, APR is
  zero (FR-020).
- **Short months and the anchor.** An `anchor_day` of 29–31 clamps to the last day of any
  shorter month for both A0 and instalment dates (*default*, FR-010, FR-011).
- **Rounding drift.** Per-period rounding may push individual principal amounts a shilling
  either side of P/n; the final instalment always reconciles to zero (FR-021).
- **Indivisible principal.** P not divisible by n is expected and handled by the rounding
  and final-instalment rules; no special case.

## Assumptions and defaults

Recorded so they can be revisited without reopening settled policy.

- Rounding mode is round-half-up.
- Payments are in arrears: interest accrues over the period just ended and is paid at
  period end.
- The stub appears as a leading instalment-0 row.
- `anchor_day` is a required per-loan input field rather than a product-level constant.
- Zero interest rate produces a valid zero-interest schedule.
- APR is a compounded effective annual IRR on actual/365; report to two decimal places.
- Dates are ISO 8601 (YYYY-MM-DD).
- Anchor days beyond a month's length clamp to month-end.
- Negative nominal rates are rejected.
- `principal` is a whole number of shillings.

## Out of scope

Prepayment, early settlement, arrears and penalty interest, fees other than interest,
rate changes mid-term, payment holidays, multi-currency, and persistence or presentation
of the schedule. The engine computes a schedule for a single disbursed loan under the
policy above and nothing more.

## Acceptance criteria

- The worked example reproduces the golden table exactly, including total cost of credit
  of 7000 and a final closing balance of zero.
- Principal portions sum to P for any valid input; the final closing balance is exactly
  zero in every case.
- A stub is emitted precisely when disbursement does not fall on the anchor day, with
  interest on a 30/360 basis and no principal.
- Invalid inputs (FR-001 to FR-005) raise an explicit error.
- Total cost of credit equals the sum of all interest rows, stub included.
- APR discounts the returned cash flows back to P on an actual/365 basis within solver
  tolerance.


## Auditor verdict

_The spec resolves 10 of 14 decisions correctly. It nails the bespoke method/rounding/temporal choices (equal principal #2, 30/360 #3, per-period interest #4, stub #5, whole-shilling rounding #7, interest-first ordering #8) and the non-obvious dual day-count APR disclosure (#14), plus inferable anchors #1, #9, #12. It misses #10 and #11 by declaring early settlement and prepayment out of scope, contradicts #6 by fixing whole-shilling precision instead of 2 decimal places, and deviates on #13 by inventing an anchor_day model so the first due date is not disbursement + one month. Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | Policy table: 'interest is charged on the reducing balance'; FR-015 'Compute exact interest on the opening balance: interest_exact = opening × (annual_rate / 12)'. | The spec charges interest on the declining/reducing balance each period, matching declining-balance interest method. |
| 2 | yes | **yes** | Policy table: 'Equal principal (straight-line). Principal portion is P/n each period; interest is charged on the reducing balance; the total instalment falls over the term.' | Exact match: constant P/n principal, interest on reducing balance, decreasing total instalment; explicitly not EMI. |
| 3 | yes | **yes** | Policy table: '30/360. Every month is 30 days, the year is 360. The nominal annual rate is divided by 12 for a uniform monthly rate.' | Day-count convention matches 30/360 exactly, not actual/365. |
| 4 | yes | **yes** | FR-015 computes interest once per instalment on the opening balance via annual_rate/12; regular periods are not daily-accrued (only the stub is day-counted). | Interest is calculated once per monthly repayment period, matching 'same as the repayment period', not daily accrual. |
| 5 | yes | **yes** | FR-012/FR-014: stub period from disbursement_date to A0 with 'interest due = round(P × (annual_rate/360) × stub_days)'; policy table 'Stub: Interest-only charge for the days between disbursement and the first anchor date'. | Interest accrues from disbursement and a partial-period stub interest charge is levied for the days before the first period, matching the reference. |
| 6 | yes | no | Header: 'Currency: Kenyan shilling (KES), whole shillings only'. | Currency (KES) matches, but the reference precision is 2 decimal places whereas the spec fixes amounts to whole shillings only, so the stated precision does not match. |
| 7 | yes | **yes** | Policy table 'Rounding: Whole shillings... Accumulated residue cleared in the final instalment'; FR-021 forces final principal to clear the balance, absorbing rounding residue. | Each instalment is rounded to the whole shilling and accumulated rounding difference is settled in the final instalment, matching the reference. |
| 8 | yes | **yes** | FR-016 'Round interest to the whole shilling'; FR-017 round total instalment; FR-018 'Set principal = instalment − interest'. Policy table: 'Interest rounded first; total instalment rounded; principal is the difference.' | Interest is computed and rounded first and principal is the remainder of the rounded instalment, matching the reference ordering. |
| 9 | yes | **yes** | FR-021 'the closing balance is exactly zero. This absorbs all accumulated rounding residue, so the schedule always closes at zero'. | Final instalment reconciles so the closing balance is exactly zero, matching the reference. |
| 10 | no | no | Out of scope: 'Prepayment, early settlement, arrears and penalty interest... are out of scope'. | Early full settlement rebate is explicitly excluded, so the Rule-of-78 policy is neither surfaced nor resolved. |
| 11 | no | no | Out of scope: 'Prepayment... are out of scope'. | Partial prepayment handling is explicitly out of scope, so re-amortisation keeping term fixed is not addressed. |
| 12 | yes | **yes** | FR-001 'Reject with an error when principal is zero or negative'; FR-002 'Reject with an error when term is zero or negative'. | Zero/negative principal or term are rejected as explicit typed errors, matching the reference. |
| 13 | yes | no | FR-010/FR-011: first anchor date A0 is first occurrence of anchor_day after disbursement; instalment 1 falls one anchored month after A0. Golden: disbursement 2026-01-20, first instalment 2026-03-05. | The reference sets first due date = disbursement date + one month; the spec instead anchors to an invented anchor_day so the first instalment (e.g. 2026-03-05) is not one month after disbursement (2026-02-20), a material deviation. |
| 14 | yes | **yes** | Output tables list per-row due date, opening, interest, principal, instalment, closing; FR-022 total cost of credit = sum of all interest; FR-023 'APR... on an actual/365 basis, deliberately independent of the 30/360 accrual convention'. | Full schedule fields, total cost of credit as sum of interest, and the non-obvious 30/360-accrual-but-actual/365-disclosure APR split all match the reference. |
