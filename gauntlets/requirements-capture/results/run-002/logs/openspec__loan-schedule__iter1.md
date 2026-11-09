# openspec — loan-schedule — iteration 1

Model (author): claude-opus · Questions asked: 7 · Captured: 12/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: Let me ask these in plain text instead.

I've reviewed the brief. Several policy decisions are omitted that materially change the computed schedule and that I can't reliably infer — there are multiple plausible answers and your institution has presumably picked specific ones. Could you confirm each?

**1. Amortization method** — How is each instalment split?
- (a) **Equal instalment / annuity (EMI)** — constant total payment, interest declines, principal rises
- (b) **Equal principal** — constant principal chunk, total payment declines
- (c) **Interest-only + balloon** — interest each period, full principal at the end

**2. Interest basis (day-count convention)** — How is each period's interest derived from the annual nominal rate?
- (a) **Flat monthly** = balance × (annual_rate / 12), identical each month
- (b) **Actual/365**, (c) **Actual/360**, or (d) **30/360** — based on actual days in the period

**3. First instalment timing & partial first period** —
- When is the first instalment due — exactly one month after disbursement, or on a fixed day of the month?
- If disbursement doesn't align to the payment day, is there a pro-rated (short/long) first period, or is the first period treated as a normal full month?

**4. Rounding** —
- How many decimal places and which rounding mode (half-up, banker's/half-even, or integer minor units like cents)?
- Where does the rounding residue go — absorbed into the final instalment so the balance closes to exactly zero, or spread another way?

**5. Business-day adjustment** — If an instalment due date falls on a weekend or holiday, does it roll (forward/backward), and if so does that rolling change the interest accrued? Or are due dates used as-is regardless of weekends/holidays?

**6. Loan input & output shape** — Just to pin the interface: what fields does the `loan` input carry (principal, annual rate, term in months, disbursement date — anything else like a fixed payment day or currency?), and what should each schedule row contain (e.g. instalment number, due date, opening balance, interest due, principal due, total payment, closing balance)?

Once you confirm these, I'll generate the OpenSpec change artifacts and save the final `spec.md`.
A: Confirmed, in order:

**1. Amortisation method:** Equal principal — (b). A constant principal portion (P/n) each period, interest on the reducing balance, so the total instalment decreases over the term. Not EMI/annuity.

**2. Day-count convention:** 30/360 — (d). Every month is treated as 30 days, the year as 360. Not actual/365 or actual/360.

**3. First instalment timing & stub period:** The first instalment is due exactly one month after the disbursement date; subsequent instalments fall monthly thereafter. If disbursement precedes the first period start and creates a short stub, interest is charged for those extra days — pro-rated partial-period interest is levied, not waived.

**4. Rounding:** Currency is Kenyan shilling (KES), amounts to 2 decimal places internally, but each instalment is rounded to the whole shilling (no cents). Rounding order within a period: compute and round interest first; principal is the remainder of the rounded instalment. The accumulated rounding difference is settled in the final instalment so the closing balance is exactly zero.

**5. Business-day adjustment:** No policy defined for this. [default, not policy] Treat due dates as calendar dates with no weekend or holiday rolling; the institution can layer that on separately if needed.

**6. Input and output shape:** Inputs: principal (KES), annual nominal rate, term in months, disbursement date. Output: full amortisation schedule with one row per period containing — due date, opening balance, interest, principal, instalment, closing balance — plus the total cost of credit (sum of all interest charges) and the disclosed APR computed on an actual/365 basis (even though accrual uses 30/360).

### Round 2
_Step reasoning:_ (live agent turn)

Q: Captured. One tight follow-up on a detail inside your 30/360 + stub answer that still changes the numbers, then I'll build the artifacts:

**30/360 variant & stub trigger.** The 30/360 family has variants that differ precisely on the odd dates where your stub arises (month-ends / the 31st):
- **US/NASD 30/360** vs **European 30E/360** — these disagree on how a day-31 or end-of-February disbursement/due date is adjusted, which changes the first-period (stub) day count and hence its interest.
- And to confirm the stub mechanism: for a disbursement like the 31st (or end-of-Feb), where "one month later" isn't a clean 30-day period under 30/360, the first period's interest = opening balance × annual_rate × (30/360-day-count from disbursement to first instalment ÷ 360) — i.e. the extra days beyond 30 are charged. Is that the intended mechanism, and which 30/360 variant?

If you'd rather not pin the variant, say "use your default" and I'll document **30E/360 (European)** as a recorded assumption flagged for your confirmation, and proceed.
A: The 30/360 variant is not specified in policy. [default, not policy] Use **30E/360 (European)** as your recorded assumption and flag it for confirmation.

On the stub mechanism: confirmed. The first period's interest is calculated as opening balance × annual_rate × (30/360-day-count from disbursement date to first instalment date ÷ 360). If that day-count exceeds 30 (e.g. disbursement on the 31st where the first instalment falls more than 30 days later under 30E/360 adjustment), the extra days are charged — not waived.

### Round 3
_Step reasoning:_ (live agent turn)

Q: It is done. The specification is saved at `spec.md` in this directory.

## Summary

The brief was deliberately underspecified, so before writing anything I asked you — the stakeholder — the six material policy decisions that can't be reliably inferred, plus one follow-up on a sub-detail. Everything in the spec traces back to your confirmed answers:

| Decision | Confirmed policy |
|---|---|
| Amortisation | **Equal principal** (constant `principal/term`, declining instalment) — not EMI |
| Interest basis | **30E/360 (European)** *(variant assumed, flagged)* |
| First period | First instalment one month after disbursement; **pro-rated stub interest** charged for odd first periods |
| Rounding | **Whole KES**; interest rounded first, principal = rounded instalment − rounded interest; residue settled in final instalment |
| Business-day adj. | None (calendar dates as-is) — your stated default |
| Output | Per-period rows + **total cost of credit** + **APR on actual/365** |

Two items you left to default are recorded in `spec.md` as **assumptions pending confirmation** (the 30/360 variant → 30E/360, and the month-end "one calendar month" clamp rule), rather than silently baked in.

**Artifacts created** (OpenSpec change `add-repayment-schedule-engine`, validates clean):
- `proposal.md` — why, and the new `loan-repayment-schedule` capability
- `specs/loan-repayment-schedule/spec.md` — 10 testable requirements with WHEN/THEN scenarios
- `design.md` — exact-decimal arithmetic, 30E/360 helper, rounding order, stub, APR solver, open questions
- `tasks.md` — implementation steps grouped with per-task verification
- `spec.md` (this directory) — the consolidated, self-contained specification you asked for

Per the planning boundary of this workflow, I've stopped at planning — no engine code was written. When you're ready to implement, run `/opsx:apply`.
A: Received. The spec looks complete and the assumptions are correctly flagged.

## Produced specification

# Repayment Schedule Engine — Specification

`generate_schedule(loan)` produces the full repayment schedule for a disbursed loan.
Every policy decision below was confirmed by the product stakeholder. Two items are
recorded as **assumptions pending confirmation** and are marked as such.

## 1. Input

`loan` carries exactly four fields:

| Field             | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `principal`       | Disbursed amount, in Kenyan shillings (KES), > 0     |
| `annual_rate`     | Annual **nominal** interest rate (e.g. `0.12` = 12%), ≥ 0 |
| `term`            | Number of monthly instalments, a positive integer    |
| `disbursement_date` | Calendar date the funds were disbursed             |

**Validation.** A non-positive principal, a negative rate, or a non-positive /
non-integer term is rejected with an error — no schedule is produced.

## 2. Output

`generate_schedule(loan)` returns:

- A **schedule**: one row per instalment, in due-date order, each containing
  `due_date`, `opening_balance`, `interest`, `principal`, `instalment` (total
  payment), and `closing_balance`. Each row's `opening_balance` equals the previous
  row's `closing_balance`.
- **Total cost of credit**: the sum of every period's (rounded) interest.
- **Disclosed APR**: computed on an actual/365 basis (see §7).

## 3. Amortisation method — Equal principal

The **equal-principal** method is used (not EMI/annuity):

- The scheduled principal portion each period is `principal / term` — a constant
  chunk.
- Interest is charged on the **reducing** (opening) balance.
- The **total instalment therefore declines** over the term.

## 4. Interest accrual — 30E/360 (European)

Period interest is:

```
interest = opening_balance × annual_rate × (day_count_30E360 / 360)
```

Under **30E/360 (European)**: a day-of-month of 31 on *either* endpoint is treated as
30; there is no special end-of-February rule. A clean whole month counts as 30 days,
so an ordinary period reduces to `annual_rate / 12`.

> **Assumption (pending confirmation):** the 30/360 *variant* was not set in policy.
> 30E/360 (European) is assumed. Switching to US/NASD 30/360 would change only
> month-end edge-date interest.

## 5. Instalment timing and the partial first period (stub)

- The **first instalment** is due **one calendar month after** the disbursement date;
  each subsequent instalment one calendar month after the previous.
- **No business-day adjustment**: due dates are used as calendar dates, even on
  weekends or holidays. (No policy was defined; this is the stated default.)
- **Stub / partial first period.** The first period's day count is the 30E/360 count
  from the disbursement date to the first instalment date. If this differs from 30
  (e.g. an end-of-month disbursement), interest is pro-rated to that count — extra
  days beyond 30 are **charged, not waived**; a short period is charged for fewer than
  30 days. All later periods use 30 days.

> **Assumption (pending confirmation):** for a month-end disbursement where the same
> day-of-month does not exist in the next month, "one calendar month after" is clamped
> to the last day of the target month (e.g. Jan 31 → Feb 28). The stub formula prices
> whatever date results.

## 6. Rounding — Whole Kenyan shilling

- Amounts are computed to 2 decimal places internally but **every emitted amount is
  rounded to the whole shilling** (no cents).
- **Order within a period:** interest is computed and **rounded first**; the instalment
  is rounded to the whole shilling; the **principal is the remainder of the rounded
  instalment** — `principal = rounded_instalment − rounded_interest`.
- **Final-instalment reconciliation:** the accumulated rounding difference is settled
  in the final instalment — the last period's principal is the entire remaining
  opening balance, so the **final closing balance is exactly zero** and the per-period
  principals sum to the original principal.

## 7. Disclosed APR — actual/365

APR is the annualised rate `a` that equates the present value of the instalment cash
flows to the disbursed principal, discounting on an **actual/365** basis:

```
Σ  instalment_k / (1 + a)^(days_k / 365)  =  principal
```

where `days_k` is the **actual** number of calendar days from disbursement to
instalment `k`. Accrual uses 30E/360 (§4); **only this APR disclosure uses
actual/365**. A zero-rate loan has APR 0.

## 8. Worked example (sanity check)

Loan: `principal = 12000` KES, `annual_rate = 0.12`, `term = 12`, disbursed
`2026-01-15` (first instalment `2026-02-15`, clean 30-day periods, no stub).

- Constant principal `12000 / 12 = 1000` per period.
- Monthly rate `0.12 × 30/360 = 1%`.

| # | Opening | Interest | Principal | Instalment | Closing |
|---|---------|----------|-----------|------------|---------|
| 1 | 12000   | 120      | 1000      | 1120       | 11000   |
| 2 | 11000   | 110      | 1000      | 1110       | 10000   |
| …  | …       | …        | …         | …          | …       |
| 12| 1000    | 10       | 1000      | 1010       | 0       |

**Total cost of credit** = 120 + 110 + … + 10 = **780 KES**. Final closing balance is
exactly **0**.

---

*The full OpenSpec change (proposal, delta spec, design, tasks) lives under
`openspec/changes/add-repayment-schedule-engine/`.*


## Auditor verdict

_The spec surfaces and correctly resolves 12 of 14 decisions (coverage 12/14). All inferable anchors (1, 6, 9, 12, 13) and most bespoke decisions (2, 3, 4, 5, 7, 8, 14) are matched exactly, including the non-obvious 30/360-accrual-but-actual/365-disclosure split. The two gaps are both off-default method choices the stakeholder was never asked about: the Rule-of-78 early-settlement rebate (#10) and the fixed-term re-amortisation of partial prepayments (#11), neither of which the spec mentions at all._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §3: "Interest is charged on the reducing (opening) balance"; §4: "interest = opening_balance × annual_rate × (day_count_30E360 / 360)" | Spec explicitly charges interest on the reducing/opening balance, matching declining balance on reducing principal. |
| 2 | yes | **yes** | §3 "Amortisation method — Equal principal ... scheduled principal portion each period is principal / term — a constant chunk ... The total instalment therefore declines over the term." | Spec names equal-principal (not EMI), constant P/n principal, interest on reducing balance, declining total instalment — exactly the reference. |
| 3 | yes | **yes** | §4 "A clean whole month counts as 30 days ... year as 360" (30E/360); formula uses day_count/360 | Reference answer is 30/360 (every month 30 days, year 360, not actual/365); spec adopts 30/360 (European variant), which matches the core convention. The variant is flagged as an unresolved assumption but the stated resolution is 30/360. |
| 4 | yes | **yes** | §4: period interest computed once via "opening_balance × annual_rate × (day_count / 360)"; "an ordinary period reduces to annual_rate / 12" | Interest is computed once per monthly period on the opening balance, not as daily accrual, matching same-as-repayment-period. |
| 5 | yes | **yes** | §5 Stub: "first period's day count is the 30E/360 count from the disbursement date to the first instalment date ... extra days beyond 30 are charged, not waived" | Spec accrues from the disbursement date and levies a pro-rated stub charge for extra days, matching the reference stub rule. |
| 6 | yes | **yes** | §1 "in Kenyan shillings (KES)"; §6 "Amounts are computed to 2 decimal places internally" | Currency is KES and 2-decimal precision is stated, matching the reference (even though emitted amounts are then rounded to whole shilling per #7). |
| 7 | yes | **yes** | §6 "every emitted amount is rounded to the whole shilling (no cents)"; "accumulated rounding difference is settled in the final instalment" | Spec rounds each instalment to whole shilling and settles the residual in the final instalment — exact match. |
| 8 | yes | **yes** | §6 "interest is computed and rounded first ... principal is the remainder of the rounded instalment — principal = rounded_instalment − rounded_interest" | Interest rounded first, principal as remainder of the rounded instalment, matching the within-period rounding order exactly. |
| 9 | yes | **yes** | §6 "the final closing balance is exactly zero"; §8 "Final closing balance is exactly 0" | Final instalment reconciles so closing balance is exactly zero, matching the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or any interest rebate, so Rule of 78 is neither surfaced nor resolved. |
| 11 | no | no | absent | The spec never mentions partial prepayment, re-amortisation, or term-vs-instalment handling of extra payments. |
| 12 | yes | **yes** | §1 Validation: "A non-positive principal, a negative rate, or a non-positive / non-integer term is rejected with an error — no schedule is produced." | Zero/negative principal and zero/negative term are explicitly rejected as invalid, matching the reference. |
| 13 | yes | **yes** | §5 "first instalment is due one calendar month after the disbursement date; each subsequent instalment one calendar month after the previous" | First due date is disbursement + one month with monthly instalments thereafter, matching the reference. |
| 14 | yes | **yes** | §2 schedule rows (due_date, opening_balance, interest, principal, instalment, closing_balance), total cost of credit = sum of interest, disclosed APR; §7 "only this APR disclosure uses actual/365" while accrual uses 30E/360 | Spec returns the full per-period schedule, total cost of credit as sum of interest, and an APR disclosed on actual/365 while accrual stays 30/360 — the exact dual day-count quirk. |
