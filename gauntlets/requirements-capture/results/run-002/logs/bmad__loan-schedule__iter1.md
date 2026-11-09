# bmad — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 12 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me put the same questions to you directly in prose — answer in whatever form is easiest, and feel free to say "use your default" on any of them.

These four decisions each change the numbers in every row of the schedule, and each has several plausible answers that I can't safely infer — so I need your institution's specific choice:

**1. Amortization method** — how is each instalment split between interest and principal?
- **(a) Equal total instalment (annuity/EMI)** — same total payment every period; interest portion shrinks, principal grows. (Most common for consumer loans.)
- **(b) Equal principal (straight-line)** — constant principal each period (principal ÷ term); total payment declines over time.
- **(c) Interest-only + balloon** — interest-only each period; full principal repaid at the final instalment.

**2. Interest basis / day-count** — how is per-period interest derived from the annual nominal rate?
- **(a) Nominal ÷ 12, flat monthly** (equivalent to a 30/360 monthly convention)
- **(b) Actual/365** — balance × rate × (actual days / 365)
- **(c) Actual/360**
- **(d) 30/360**

**3. First instalment timing & odd first period** —
- **(a) Exactly one month after disbursement** — clean whole-month periods, no stub interest; same day-of-month thereafter.
- **(b) Fixed billing day with a stub** — first period is odd-length and accrues pro-rata interest.
- **(c) Disbursement + grace period** (e.g. 30/45 days), interest accruing over the gap.

**4. Rounding & residual** — how are amounts rounded, and where does the residual land so the balance closes at exactly zero?
- **(a) Round to 2dp; absorb the accumulated residual into the final instalment.**
- **(b) Round to 2dp; carry sub-cent remainder forward each period.**
- **(c) Full precision, no rounding** — caller handles presentation.

A couple of smaller points I'll fold in once the above are settled, unless you want to speak to them now: the currency / number of minor units (I'm assuming a 2-decimal currency), and behaviour on edge inputs (zero interest rate, term of 1, non-positive principal).
A: 1. **Amortisation method:** (b) Equal principal — a constant principal portion each period (loan amount ÷ term), interest on the reducing balance, so the total instalment decreases over the term. Not equal instalments.

2. **Day-count / interest basis:** (d) 30/360 — every month counts as 30 days, the year as 360. Interest for a period is simply balance × (annual rate / 12).

3. **First instalment timing:** (a) exactly one month after disbursement, then monthly on the same day thereafter — so the standard periods are clean whole months. One addition: interest accrues from the disbursement date, so if the disbursement falls before the first period start there is a stub charge for those extra days. Partial-period interest is levied, not waived.

4. **Rounding:** Neither (a) nor (b) as stated — instalments are rounded to the whole shilling (no cents), not to two decimal places. The accumulated rounding difference is absorbed into the final instalment so the closing balance is exactly zero. Within each period, interest is computed and rounded first; principal is the remainder.

On your two smaller points, since you offered: currency is KES. Amounts (interest, principal, balances) are carried to two decimal places; it is only the instalment figure that rounds to the whole shilling. For edge inputs, zero or negative principal and zero or negative term are rejected as invalid — return an error, do not produce a schedule.

### Round 2
_Step reasoning:_ (live agent turn)

Q: These are clear and I've captured them. One of your answers contains a tension I don't want to paper over, because it directly changes the numbers — so let me resolve it before I write the spec, plus confirm one mechanical reading.

**The first-period / stub question (the real one).** You said two things that only coexist if there are *two distinct dates* in the model:

- "first instalment exactly one month after disbursement… standard periods are clean whole months" — which implies the first period runs disbursement → +1 month, i.e. no odd days; but
- "interest accrues from the disbursement date, so if the disbursement falls *before the first period start* there is a stub charge" — which implies a "first period start" that is a *separate anchor date*, distinct from disbursement, with disbursement able to precede it.

Those can't both describe the same single date. So I need to know which world we're in:

1. **Is there a separate billing-anchor / "first period start" date** (e.g. instalments fall on a fixed day-of-month, or a scheduled cycle start passed into `generate_schedule`), distinct from the disbursement date? Or is the normal input just the disbursement date, with the first instalment genuinely one month later (in which case the clean case has *no* stub, and a stub only arises from something like an end-of-month 30/360 edge)?

2. **When a stub exists, how are its days counted and charged?** Under 30/360, do you count the odd days as `days/30 × (balance × rate/12)` (i.e. a fraction of a normal month's interest)? And is that stub interest **folded into instalment 1's interest line**, or does it appear as its **own schedule row** (an "instalment 0")?

3. **Does a stub carry any principal, or is it interest-only?** (I'm assuming interest-only — you still repay principal in exactly `term` equal portions — but confirm.)

**One confirmation on the rounding mechanics** (so I state it correctly rather than guess). Reconciling "constant principal = loan ÷ term" with "instalment rounds to the whole shilling" and "interest is computed and rounded first; principal is the remainder," I read the per-period computation as:

1. `interest_t = round(opening_balance × rate/12, 2dp)`
2. `instalment_t = round(loan/term + interest_t, 0)` → whole shilling
3. `principal_t = instalment_t − interest_t` ← the "remainder"
4. `balance_t = opening_balance − principal_t`

…with the final instalment setting `principal = remaining balance` so the balance closes at exactly 0.00. So the "constant principal" is the *basis* for the instalment, and the whole-shilling rounding lands on the principal via the remainder. **Is that the intended reading** — or do you instead want the principal portion held at a constant `round(loan/term, 2dp)` independently, with the whole-shilling instalment being just a reported total?
A: 1. **Separate anchor date — yes.** The model takes two inputs: a disbursement date and a first-period-start date (the billing anchor). In the clean case those coincide and there is no stub. A stub arises when disbursement precedes the billing anchor — the gap between the two dates accrues interest before the regular schedule begins. The first due date is then one month after the first-period-start date, not one month after disbursement.

2. **Stub day-count and placement.** [default, not policy — the key does not prescribe this] Under 30/360 the stub days are counted as actual calendar days, and the charge is `stub_days / 30 × (disbursed_balance × annual_rate / 12)`. That amount is folded into instalment 1's interest line — it appears on the same row, not as a separate instalment-0 row.

3. **Stub carries no principal.** [default, not policy] The stub period is interest-only; principal repayment begins with instalment 1 as normal, in exactly `term` equal portions.

**Rounding confirmation — yes, that is the intended reading.** Your four-step sequence is correct: interest is rounded to 2dp first; the instalment is then `round(nominal_principal + rounded_interest, 0)`; principal is the remainder (instalment minus interest); balance reduces accordingly. The principal is not independently fixed at `round(loan/term, 2dp)` — it floats with the rounding. The final instalment sets principal equal to the remaining balance so closing balance is exactly 0.00.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done — the specification is saved at `spec.md`.

**What it captures.** The brief named only the domain and the interface; the spec pins down the four policy decisions that actually drive the numbers — all confirmed with you, not inferred:

1. **Equal-principal** amortisation (constant `principal ÷ term` basis, declining total instalment).
2. **30/360** interest — monthly interest = `balance × annual_rate / 12`.
3. **First-period stub** — two distinct dates (`disbursement_date` and `first_period_start_date`); interest accrues from disbursement, the gap is charged as a stub folded into instalment 1's interest line, interest-only.
4. **Whole-shilling instalment rounding** (KES, amounts to 2dp, instalment to whole shilling), interest rounded first, principal = the remainder, residual absorbed into the final instalment so the balance closes at exactly `0.00`.

It also specifies the interface (`loan` input incl. the two dates, `schedule`/row output, error contract), validation (non-positive principal/term rejected; zero rate valid), a fully traced 6-instalment **worked example** (verified: principals sum to 100,000.00, balance closes at 0.00), and acceptance criteria.

**Worth your attention — a few things I flagged in §10 rather than silently deciding:**

- I marked your stub answers (day-count `stub_days/30`, folded-into-instalment-1 placement, interest-only) as **stakeholder defaults, not prescribed policy**, per your note — so they're recorded as revisitable.
- One genuine **[confirm]**: since the final instalment is the plug that zeroes the balance, its *total* can carry cents rather than being a whole shilling (the worked example ends on `16,914.92`). That's the logical consequence of "whole-shilling instalments" + "residual absorbed in the final instalment" — but it's the one place those two rules interact, so I want your explicit sign-off.
- Three smaller **[assumption]** items I defaulted and want confirmed: rounding mode (round half up), negative rates rejected, and end-of-month day clamping for due dates (affects the date label only, not interest under 30/360).

If the `[confirm]` and assumption items are fine as written, I'll promote them from assumptions to confirmed policy and mark the spec final.
A: Three confirmations and one genuine policy answer.

**Final instalment carrying cents — confirmed.** The whole-shilling rounding rule applies to regular instalments only. The final instalment is the reconciling plug; it closes the balance to exactly 0.00 and may therefore carry cents. Promote that from [confirm] to confirmed policy.

**Rounding mode (round half up)** — [default, not policy]. Round half up is standard; proceed on that basis.

**Negative rates** — [default, not policy]. Reject as invalid with an error, same treatment as non-positive principal or term.

**End-of-month day clamping** — [default, not policy]. Clamp to the last day of the month; acceptable as a default since it affects only the due-date label and not the interest calculation under 30/360.

### Round 4
_Step reasoning:_ (live agent turn)

Q: The specification is **complete and marked final** at `spec.md`.

All elicited decisions are now resolved:

- **Final instalment carrying cents** → promoted to **confirmed policy** (whole-shilling rounding applies to regular instalments only; the final instalment is the reconciling plug that closes the balance to exactly 0.00).
- **Round half up**, **negative rates rejected**, and **end-of-month day clamping** → recorded as **confirmed stakeholder defaults** (correct for this build, flagged as revisitable rather than formally prescribed policy), alongside the three stub defaults from earlier.

No open questions remain. The spec contains the interface contract, the four load-bearing policy decisions (equal-principal / 30/360 / disbursement-vs-anchor stub / whole-shilling rounding with final-instalment residual), validation rules, a verified worked example, and acceptance criteria.

One process note for transparency: the BMad finalize pipeline (memlog audit, reviewer gate, polish passes) couldn't run as designed because there's no `_bmad` project installed in this directory — its scripts and reviewer subagents weren't available. I followed the fallback path (default workflow, decisions tracked inline in the spec's policy and open-items tables instead of a `.memlog.md`). If you want, I can run a review pass over the spec with a subagent to simulate the reviewer gate before you hand it to engineering.
A: Noted. The specification is complete.

## Produced specification

---
title: Repayment Schedule Engine — Requirements Specification
status: final
created: 2026-11-08
updated: 2026-11-08
owner: Product (stakeholder: hga@juxt.pro)
---

# Repayment Schedule Engine — Requirements Specification

## 1. Overview

The repayment schedule engine computes the full amortisation schedule for a disbursed
loan. Given a loan's principal, interest rate, term, and the relevant dates, it produces,
for every instalment, the interest due, the principal due, the total instalment, and the
running balance — with the balance closing at exactly zero on the final instalment.

The engine is a pure computation: `generate_schedule(loan)` takes a loan description and
returns the schedule (or an error for invalid input). It performs no I/O, no persistence,
and no side effects.

**Currency:** Kenyan Shilling (KES). Monetary amounts (interest, principal, balances) are
carried internally to **two decimal places**. The **instalment total** is the one figure
rounded to the **whole shilling** (no cents), per §6.

## 2. Scope

### In scope
- Computing a repayment schedule for a single disbursed loan.
- The **equal-principal** amortisation method (§5).
- 30/360 interest accrual (§5.2).
- A first-period interest stub when disbursement precedes the billing anchor (§5.3).
- Whole-shilling instalment rounding with residual absorbed into the final instalment (§6).
- Input validation and error signalling for invalid loans (§7).

### Out of scope
- Equal-instalment (annuity/EMI) and interest-only+balloon methods — **not** used by this
  product.
- Fees, insurance, penalties, late-payment interest, early repayment, restructuring.
- Variable/stepped interest rates; the rate is fixed for the life of the loan.
- Presentation, currency formatting, localisation, and persistence (caller's concern).
- Multi-currency and currencies with other than two minor units.

## 3. Interface

```
generate_schedule(loan) -> schedule | error
```

### 3.1 Input: `loan`

| Field                   | Type            | Description                                                                 |
|-------------------------|-----------------|-----------------------------------------------------------------------------|
| `principal`             | decimal (KES)   | Disbursed loan amount. Must be > 0.                                          |
| `annual_nominal_rate`   | decimal         | Annual nominal interest rate as a fraction (e.g. `0.18` for 18%). Must be ≥ 0. |
| `term`                  | integer         | Number of monthly instalments. Must be an integer ≥ 1.                       |
| `disbursement_date`     | date            | Date funds were disbursed. Interest accrues from this date.                  |
| `first_period_start_date` | date          | Billing anchor: the start of the first regular monthly period. Must be ≥ `disbursement_date`. |

Notes:
- `disbursement_date` and `first_period_start_date` are **distinct inputs**. In the common
  case they coincide and there is no stub (§5.3). When `disbursement_date` is earlier than
  `first_period_start_date`, the gap accrues a one-off interest stub.
- The periodic (monthly) rate is `annual_nominal_rate / 12`.

### 3.2 Output: `schedule`

An ordered collection of `term` instalment rows, plus a summary. Each row:

| Field               | Type          | Description                                                             |
|---------------------|---------------|-------------------------------------------------------------------------|
| `instalment_number` | integer       | 1 … `term`.                                                             |
| `due_date`          | date          | `first_period_start_date` + `instalment_number` months (§5.4).          |
| `opening_balance`   | decimal (2dp) | Balance brought forward into the period.                                |
| `interest`          | decimal (2dp) | Interest due this period. For instalment 1 this **includes** the stub interest (§5.3). |
| `stub_interest`     | decimal (2dp) | Stub interest folded into this row (non-zero on instalment 1 only; 0 otherwise). Exposed for transparency. |
| `principal`         | decimal (2dp) | Principal due this period = `instalment − interest` (§6).               |
| `instalment`        | decimal       | Total payment = `principal + interest`. Whole shilling for instalments 1…`term−1`; final instalment to 2dp (§6). |
| `closing_balance`   | decimal (2dp) | `opening_balance − principal`. Zero on the final row.                   |

Summary fields: `total_principal` (= `principal`), `total_interest` (sum of all `interest`,
including stub), `total_paid` (sum of all `instalment`).

### 3.3 Error

For invalid input (§7) the function returns an **error**, not a schedule. No partial
schedule is produced.

## 4. Policy decisions (confirmed with stakeholder)

The following were established with the product stakeholder; they are load-bearing and
cannot be inferred from the brief. Items tagged **[stakeholder default]** were confirmed as
sensible defaults that the institution has not formally prescribed as policy — they are
correct for this build but may be revisited.

| # | Decision                 | Choice                                                                                  |
|---|--------------------------|-----------------------------------------------------------------------------------------|
| 1 | Amortisation method      | **Equal principal** (constant principal basis = `principal ÷ term`; declining total).   |
| 2 | Interest basis / day-count | **30/360** — monthly interest = `balance × annual_nominal_rate / 12`.                 |
| 3 | Rate conversion          | Monthly periodic rate = `annual_nominal_rate / 12`.                                      |
| 4 | First instalment timing  | One month after `first_period_start_date`, same day-of-month thereafter.                 |
| 5 | Stub period              | Interest accrues from `disbursement_date`; gap to `first_period_start_date` is charged.  |
| 6 | Stub day-count           | **[stakeholder default]** `stub_days` = actual calendar days; charge = `stub_days / 30 × (principal × rate / 12)`. |
| 7 | Stub placement           | **[stakeholder default]** Folded into instalment 1's interest line (no separate row).    |
| 8 | Stub principal           | **[stakeholder default]** Interest-only; principal repaid in exactly `term` equal portions starting at instalment 1. |
| 9 | Rounding                 | Interest → 2dp; instalment → whole shilling; principal = remainder; residual to final instalment (§6). |
| 10| Edge inputs              | Non-positive principal or term → error (§7).                                             |

## 5. Computation

Let `P = principal`, `r = annual_nominal_rate`, `n = term`, and the monthly rate
`m = r / 12`. The nominal principal basis per period is `B = P / n` (not rounded; used only
as the basis for computing each instalment).

### 5.1 Equal-principal amortisation

Each period applies a constant principal basis `B = P / n`. Interest is charged on the
reducing opening balance, so the total instalment **declines** across the term. (The actual
principal booked each period floats slightly around `B` because of whole-shilling rounding —
see §6 — and the final period absorbs the residual.)

### 5.2 Interest accrual — 30/360

Every regular month counts as 30 days and the year as 360. Regular-period interest is
therefore independent of the actual number of calendar days in the month:

```
interest_t = round(opening_balance_t × m, 2dp)
```

### 5.3 First-period interest stub

If `disbursement_date < first_period_start_date`, interest accrues over the intervening
days before the regular schedule begins:

```
stub_days     = calendar days from disbursement_date to first_period_start_date   # actual days
stub_interest = round( (stub_days / 30) × (P × m), 2dp )
```

- The stub is **interest-only** — it carries no principal.
- The stub interest is **folded into instalment 1's interest line**: it appears on the same
  row as instalment 1, not as a separate "instalment 0". Thus
  `interest_line_1 = interest_1 + stub_interest`, and it is this combined line that feeds the
  instalment-1 rounding and remainder in §6.
- If `disbursement_date == first_period_start_date`, then `stub_days = 0` and
  `stub_interest = 0` (clean case, no stub).

### 5.4 Due dates

- Instalment `t` (for `t = 1 … n`) is due on `first_period_start_date + t months`, on the
  same day-of-month.
- Where the anchor day-of-month does not exist in a target month (e.g. the 31st in a 30-day
  month), clamp to the last day of that month ([stakeholder default]). Date rolling affects the
  `due_date` label only; it does not affect interest, which is fixed at `balance × m` under
  30/360.

## 6. Rounding and the final instalment

For each regular period `t = 1 … n−1`:

1. `interest_t   = round(opening_balance_t × m, 2dp)`
   (for `t = 1`, use `interest_line_1 = interest_1 + stub_interest`)
2. `instalment_t = round(B + interest_line_t, 0)`   — rounded to the **whole shilling**
3. `principal_t  = instalment_t − interest_line_t`   — the **remainder**
4. `closing_balance_t = opening_balance_t − principal_t`

The principal is **not** independently fixed at `round(P/n, 2dp)`; it floats with the
whole-shilling rounding of the instalment. Because the stub is folded into both the
instalment total and the interest line of instalment 1, it cancels out of `principal_1`,
keeping booked principal ≈ `B`.

For the **final period** `t = n`:

- `interest_n   = round(opening_balance_n × m, 2dp)`
- `principal_n  = opening_balance_n`   — set equal to the remaining balance, absorbing the
  accumulated rounding residual
- `instalment_n = principal_n + interest_n`
- `closing_balance_n = 0.00` (exactly)

**Confirmed policy.** The whole-shilling rounding rule applies to **regular instalments only**
(1…`term−1`). The final instalment is the reconciling plug: it closes the balance to exactly
`0.00` and may therefore carry sub-shilling precision (2dp) rather than being a whole shilling.

Rounding mode for the 2dp and whole-shilling operations: **round half up** ([stakeholder
default]).

## 7. Validation and error handling

The following inputs are **invalid** and cause `generate_schedule` to return an error
(no schedule produced):

- `principal` ≤ 0.
- `term` ≤ 0, or `term` not an integer.
- `first_period_start_date` earlier than `disbursement_date` (would imply a negative stub).
- `annual_nominal_rate` < 0. Negative rates are rejected, same treatment as non-positive
  principal or term ([stakeholder default]).

Valid but notable:

- `annual_nominal_rate == 0` is **valid**: all interest lines (and any stub) are 0.00; each
  instalment is `round(B, 0)`; the final instalment absorbs the principal residual.
- `term == 1`: a single instalment repaying the full principal plus one period's interest
  (plus stub, if any).

## 8. Worked example

Inputs: `P = 100,000.00 KES`, `r = 0.18` (18% nominal), `n = 6`,
`disbursement_date = 2026-01-10`, `first_period_start_date = 2026-01-25`.

Derived: `m = 0.18 / 12 = 0.015`; `B = 100,000 / 6 = 16,666.6667`.
Stub: `stub_days = 15` (Jan 10 → Jan 25); `stub_interest = (15/30) × (100,000 × 0.015) = 750.00`.

| # | Due date   | Opening     | Interest (incl. stub) | Stub   | Principal | Instalment | Closing    |
|---|------------|-------------|-----------------------|--------|-----------|------------|------------|
| 1 | 2026-02-25 | 100,000.00  | 2,250.00              | 750.00 | 16,667.00 | 18,917     | 83,333.00  |
| 2 | 2026-03-25 | 83,333.00   | 1,250.00              | 0.00   | 16,667.00 | 17,917     | 66,666.00  |
| 3 | 2026-04-25 | 66,666.00   | 999.99                | 0.00   | 16,667.01 | 17,667     | 49,998.99  |
| 4 | 2026-05-25 | 49,998.99   | 749.98                | 0.00   | 16,667.02 | 17,417     | 33,331.97  |
| 5 | 2026-06-25 | 33,331.97   | 499.98                | 0.00   | 16,667.02 | 17,167     | 16,664.95  |
| 6 | 2026-07-25 | 16,664.95   | 249.97                | 0.00   | 16,664.95 | 16,914.92  | 0.00       |

Checks:
- Instalment 1 interest = regular `1,500.00` + stub `750.00` = `2,250.00`.
- Instalments 1–5 are whole shillings; instalment 6 (`16,914.92`) carries cents as it
  absorbs the residual and zeroes the balance.
- Sum of principal = `100,000.00` (= `P`). Closing balance = `0.00`.
- Total interest = `2,250.00 + 1,250.00 + 999.99 + 749.98 + 499.98 + 249.97 = 5,749.92`.

## 9. Acceptance criteria

1. For a valid loan with no stub (`disbursement_date == first_period_start_date`), the engine
   returns `term` rows; `stub_interest` is 0 on every row.
2. For a valid loan with a stub, instalment 1's `interest` equals regular interest + stub, and
   `stub_interest` on row 1 equals `round((stub_days/30) × (P × m), 2dp)`.
3. Principal portions sum to exactly `principal`; the final `closing_balance` is exactly
   `0.00`.
4. Each regular-period `interest` equals `round(opening_balance × annual_nominal_rate/12, 2dp)`.
5. Instalments 1…`term−1` are whole shillings; `principal = instalment − interest` on every
   row; the final principal equals the opening balance of the final period.
6. Total instalment declines period-over-period for a positive rate (equal-principal shape),
   aside from the final-instalment residual adjustment.
7. Invalid inputs (§7) return an error and no schedule.
8. A zero-rate loan produces zero interest on every row and still closes at `0.00`.

## 10. Open items

All items raised during elicitation have been resolved with the stakeholder. Those marked
**[stakeholder default]** are confirmed defaults rather than formally prescribed institutional
policy, and may be revisited if a formal policy is issued.

| Item | Status | Note |
|------|--------|------|
| Final instalment may carry cents (not whole shilling) as the residual plug | **confirmed policy** | §6 — whole-shilling rule applies to regular instalments only; final instalment is the reconciling plug. |
| Stub day-count (`stub_days/30`) and placement (folded into instalment 1) | confirmed [stakeholder default] | §4 #6–7 — revisit if a formal stub policy is issued. |
| Stub is interest-only (no principal) | confirmed [stakeholder default] | §4 #8. |
| Rounding mode = round half up | confirmed [stakeholder default] | §6. |
| Negative `annual_nominal_rate` rejected | confirmed [stakeholder default] | §7 — same treatment as non-positive principal/term. |
| Day-of-month clamp for due dates (e.g. 31st → month end) | confirmed [stakeholder default] | §5.4 — affects `due_date` label only, not interest. |


## Auditor verdict

_The spec correctly resolves 10 of 14 decisions (1–9 and 12), including the bespoke amortisation, 30/360 day-count, same-as-period interest, stub accrual, whole-shilling rounding with residual in the final instalment, interest-first rounding order, and zero-close. It misses all four of: Rule-of-78 early-settlement rebate (#10) and term-fixed re-amortised partial prepayment (#11), both pushed out of scope; the first due date (#13), which the spec anchors to an invented first_period_start_date rather than disbursement + one month, diverging whenever a stub exists; and the actual/365 APR disclosure quirk (#14), where the output covers the schedule and total interest but omits the disclosed APR entirely. Coverage = 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §5.1 "Interest is charged on the reducing opening balance"; §5.2 "interest_t = round(opening_balance_t × m, 2dp)"; policy table #2 30/360 on balance. | Declining-balance interest on the reducing principal is explicitly stated and used throughout the computation. Matches the reference. |
| 2 | yes | **yes** | §5.1 "Equal-principal amortisation ... constant principal basis B = P/n ... the total instalment declines across the term"; policy table #1 "Equal principal ... declining total"; §2 excludes EMI. | Equal-principal with constant P/n and a declining total instalment is specified exactly, and equal-instalment/EMI is explicitly out of scope. Matches the reference. |
| 3 | yes | **yes** | §5.2 "Interest accrual — 30/360 ... Every regular month counts as 30 days and the year as 360"; policy table #2 "30/360". | 30/360 day-count is stated verbatim, the off-default choice. Matches the reference. |
| 4 | yes | **yes** | §5.2 "Regular-period interest is therefore independent of the actual number of calendar days ... interest_t = round(opening_balance_t × m, 2dp)" (one computation per monthly period). | Interest is computed once per monthly repayment period (balance × monthly rate), not by daily accrual. Matches the same-as-repayment-period choice. |
| 5 | yes | **yes** | §5.3 "If disbursement_date < first_period_start_date, interest accrues over the intervening days ... stub_interest = round((stub_days/30) × (P × m), 2dp)"; policy table #5 "Interest accrues from disbursement_date; gap ... is charged." | Interest accrues from the disbursement date and a stub interest charge is levied for the pre-period days, i.e. partial-period interest is allowed and charged. Matches the reference. |
| 6 | yes | **yes** | §1 "Currency: Kenyan Shilling (KES). Monetary amounts ... carried internally to two decimal places." | KES and 2-decimal precision are stated explicitly. Matches the reference (an inferable anchor). |
| 7 | yes | **yes** | §6 "instalment_t = round(B + interest_line_t, 0) — rounded to the whole shilling" for t=1…n−1; "principal_n = opening_balance_n ... absorbing the accumulated rounding residual". | Instalments are rounded to the whole shilling and the accumulated residual is settled in the final instalment, exactly the reference rule (the spec lets the final row carry cents, which is the stated reconciliation method). |
| 8 | yes | **yes** | §6 steps: "1. interest_t = round(... 2dp) ... 2. instalment_t = round(B + interest_line_t, 0) ... 3. principal_t = instalment_t − interest_line_t — the remainder"; policy table #9 "principal = remainder". | Interest is computed and rounded first; principal is the remainder of the rounded instalment. Matches the reference ordering. |
| 9 | yes | **yes** | §6 "closing_balance_n = 0.00 (exactly)"; acceptance criterion 3 "the final closing_balance is exactly 0.00". | The final instalment reconciles so the closing balance is exactly zero. Matches the reference. |
| 10 | no | no | absent — §2 Out of scope lists "early repayment"; no mention of Rule of 78 or any rebate method. | Early full-settlement rebate is explicitly out of scope; the Rule-of-78 off-default policy is never addressed. |
| 11 | no | no | absent — §2 Out of scope lists "early repayment, restructuring"; no mention of prepayment application or re-amortisation. | Partial prepayment handling (apply to principal, re-amortise keeping term fixed) is out of scope and never addressed. |
| 12 | yes | **yes** | §7 "principal ≤ 0" and "term ≤ 0, or term not an integer" → return an error; policy table #10 "Non-positive principal or term → error". | Zero/negative principal or term is rejected as invalid with an error. Matches the reference. |
| 13 | yes | no | §5.4 / §3.2 "Instalment t is due on first_period_start_date + t months" (worked example: disbursement 2026-01-10, first due 2026-02-25). | The spec anchors the first due date to first_period_start_date + 1 month, whereas the reference states disbursement_date + one month. These coincide only in the no-stub case; with a stub they diverge (reference would give 2026-02-10, spec gives 2026-02-25), so under a strict literal reading the resolution differs. |
| 14 | yes | no | §3.2 output rows carry due date/opening/interest/principal/instalment/closing and summary "total_interest (sum of all interest)"; but no APR field anywhere — disclosed actual/365 APR is absent. | The schedule shape and total cost of credit (total_interest) are covered, but the non-obvious regulatory quirk — a disclosed APR computed on an actual/365 basis despite 30/360 accrual — is entirely missing, so the decision is not correctly resolved. |
