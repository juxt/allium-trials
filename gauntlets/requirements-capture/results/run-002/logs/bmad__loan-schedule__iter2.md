# bmad — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 13 · Captured: 11/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured-question tool isn't available in this session. I'll ask the same decisions in plain text — please answer each by number (a short answer per item is fine, and tell me if any of my framings are off).

These are the material policy choices the brief leaves open. Each has several plausible answers; I don't want to guess, because guessing wrong produces a schedule that's confidently incorrect.

**1. Amortization method** — how each instalment splits into principal vs. interest:
- (a) **Equal instalments / annuity** — same total payment each period; interest share declines, principal share grows (common "French" method)
- (b) **Equal principal / declining** — fixed principal each period; total payment falls over time ("German" method)
- (c) **Interest-only + balloon** — interest each period, full principal at the end
- (d) **Bullet** — single principal + accrued interest payment at maturity

**2. Day-count / interest accrual convention** — how each period's interest is derived from the annual nominal rate:
- (a) **Nominal ÷ 12** per month on the outstanding balance (period-based, 30/360-style; disbursement date does *not* affect interest amounts)
- (b) **Actual/365** — balance × annual rate × (actual days in period ÷ 365); exact dates and the disbursement date drive interest
- (c) **Actual/360**
- (d) **30/360**

**3. First instalment timing & period alignment:**
- (a) **One month after disbursement, clean whole months** — payment day-of-month = disbursement day-of-month, no stub
- (b) **Fixed day-of-month + stub** — payments on a fixed day (e.g. the 1st); odd first period with pro-rated interest
- (c) **Grace period** of N months first (and does interest accrue/capitalize or is it waived during grace?)
- (d) **Period numbers only** — disbursement date is informational, rows are periods 1..N with no calendar dates

**4. Rounding & residual handling:**
- (a) **2 decimals, final instalment absorbs residual** so closing balance is exactly 0.00
- (b) **2 decimals, interest-first allocation**, residual lands naturally in the last row (may leave a tiny non-zero balance)
- (c) **Full precision / unrounded** — rounding left to the caller
- (d) **Whole currency units**, residual absorbed in final instalment
- Also: which **rounding mode** — half-up, half-even (banker's), or truncate?

A few smaller ones I'll also need, which I can batch once you've answered the big four:
- **5.** What currency / how many minor-unit decimal places (2 for most; 0 for e.g. JPY)?
- **6.** Should each schedule row carry a **due date**, or just an instalment number? (Tied to your answer on #3.)
- **7.** Any **validation rules** for the input (zero/negative principal, 0% rate, zero term) and what `generate_schedule` should do with them?

Once I have your answers I'll lock them into `spec.md`. Over to you.
A: Answers by number:

**1. Amortisation method:** (b) Equal principal / declining. Fixed principal portion each period (P/n), interest on the reducing balance, so the total instalment decreases over the term.

**2. Day-count / accrual convention:** (d) 30/360 — every month treated as 30 days, year as 360. Interest is computed once per monthly period (not daily accrual), so the disbursement date does not affect the per-period interest amounts once the schedule is set.

**3. First instalment timing:** Closest to (a), with one addition: the first due date is disbursement date plus one month; subsequent instalments follow monthly from there. If the disbursement date precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged.

**4. Rounding:** (d) whole currency units (whole shilling, no cents), with the accumulated rounding difference settled in the final instalment so the closing balance is exactly zero. Rounding order within a period: interest is computed and rounded first; principal is the remainder of the rounded instalment. Rounding mode: half-up.

**5. Currency:** Kenyan shilling (KES), amounts to 2 decimal places (even though instalments round to the whole shilling, intermediate values and disclosures use 2 d.p.).

**6. Due dates:** Yes — each schedule row carries a due date.

**7. Validation:** Zero or negative principal, and zero or negative term, are rejected as invalid with an error. [default, not policy] A zero nominal rate should be accepted and will produce a zero-interest schedule.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that's most of what I need. Before I write the spec, there are three places where your answers interact in ways I can't resolve by inference, plus two smaller gaps. I'd rather surface them than silently pick a reading.

**A. When does a stub actually arise?** This is the big one. Answer 3 picked (a) — *first due date = disbursement + 1 month, payment day tracks the disbursement day* — but also said a stub is charged "if the disbursement date precedes the first period start." Under a literal reading of (a), the disbursement date *is* the first period start, so the first period is always a clean month and a stub never occurs. So there must be a separate rule defining "first period start." The usual way this happens: due dates are normalized to a fixed cycle day (e.g. always the 1st, or a product-wide billing day), and the days between disbursement and that first cycle date form the stub. **Can you state the rule that creates the stub period precisely — what sets the "first period start" date relative to disbursement?**

**B. Stub mechanics (once A is defined):**
- How are the stub's extra days counted — on the **30/360** basis (consistent with #2), or actual calendar days?
- Is stub interest = full principal × annual rate × (stub days / 360)?
- Does the stub appear as its **own row** (e.g. instalment 0, with its own due date), or is it **folded into instalment 1's** interest?
- I'm assuming the stub affects **interest only** — the principal schedule stays P/n across the n regular instalments. Correct?

**C. Reconciling B with #2.** You said the disbursement date does *not* affect per-period interest. I read that as: every *regular* period's interest is the flat annual÷12 on the balance, and the disbursement date influences *only* the one-off stub charge — nothing else. Confirm?

**D. Rounding flow for an equal-principal loan.** Your rounding rule — "interest computed and rounded first; principal is the remainder of the rounded instalment" — describes a *fixed-instalment (annuity)* loan, where the instalment is the known quantity. But you chose **equal principal (b)**, where the instalment is *not* fixed; the principal is. For equal-principal I'd expect the flow to be:
- principal each period = P/n, rounded to the whole shilling (half-up);
- interest = round(outstanding balance × annual rate ÷ 12);
- instalment = principal + interest;
- the **final** instalment's principal is adjusted to clear the exact remaining balance, absorbing all accumulated rounding so the closing balance is exactly zero.

Is that the intended treatment, or did you mean something closer to the annuity-style "remainder" rule?

**E. Due-date roll convention.** When the disbursement day-of-month doesn't exist in a later month (e.g. disbursed on the 31st, or 29–31 → February), how should due dates roll — **clamp to the last day of the month**, or some other rule?

**F. Return shape.** Confirm the fields per row: **instalment number, due date, opening balance, interest due, principal due, total instalment, closing/running balance**. Anything to add or drop? And if the stub is its own row (per B), is it numbered **0**?
A: A. The stub trigger is not an explicit policy item in my brief, so: [default, not policy] — the most common mechanism is a product-wide cycle day (e.g. the 1st of each month); days between disbursement and that first cycle date form the stub. If your implementation uses disbursement-day-anchored months exclusively (as strict (a) implies), no stub ever arises and that clause becomes dead text. Flag it; I will confirm the cycle-day rule with operations.

B. Stub mechanics — taking the cycle-day model as the working assumption:
- Day count for stub days: 30/360 for consistency with the main convention [default, not policy].
- Stub interest = full opening principal × annual rate × (stub days / 360). Correct.
- Row treatment: [default, not policy] — fold into instalment 1's interest charge rather than a separate row; it is simpler and avoids a row-0 edge case.
- Principal: yes, the stub is interest-only. The principal schedule remains P/n across the n regular instalments.

C. Confirmed. The disbursement date influences only the one-off stub charge. Every regular period's interest is annual-rate ÷ 12 on the opening balance for that period, unchanged by when disbursement happened.

D. Your proposed flow is correct for equal-principal. The key's 'remainder' phrasing was written with annuity structure in mind and does not apply here. The intended flow: principal per period = round(P/n, half-up to whole shilling); interest = round(opening balance × annual rate ÷ 12, half-up); instalment = principal + interest; final instalment's principal is adjusted to exactly clear the remaining balance so closing balance is zero.

E. [default, not policy] Clamp to the last calendar day of the month.

F. Confirmed fields per row: instalment number, due date, opening balance, interest due, principal due, total instalment, closing balance. If a stub row is added, number it 0. Summary-level output: total cost of credit (sum of all interest charges) and disclosed APR computed on actual/365 basis.

### Round 3
_Step reasoning:_ (live agent turn)

Q: Done — the specification is saved at `spec.md` in this directory.

## What it covers

A complete requirements spec for `generate_schedule(loan)`, built entirely from your answers rather than inference:

- **Confirmed policy (P1–P10):** equal-principal/declining-balance method, 30/360 convention (`r/12` per month, disbursement date doesn't move regular-period interest), KES whole-shilling half-up rounding with the final instalment absorbing the residual to close at exactly zero, first due date = disbursement + 1 month, per-row due dates, the summary block, and the validation rules.
- **Interface:** input fields and the full return shape (rows + summary).
- **Computation:** explicit formulas and the period-assembly loop, with closure post-conditions.
- **A verified worked example** (100,000 KES, 12%, 12 months, 15-day stub) — I ran the arithmetic; principals sum to P, interest totals 7,000, and the balance closes to exactly 0.
- **NFRs:** decimal-not-float, determinism, exact closure, purity.

## Things I deliberately flagged rather than silently resolved

These are called out in the **Open Items & Assumptions Register (§10)** so nothing you marked as provisional is buried:

1. **The stub trigger (A1)** is the one real soft spot. Your pick of strict option (a) — first due = disbursement + 1 month — means, read literally, *a stub never arises and that clause is dead text*. The spec documents the cycle-day model you offered as the working assumption but explicitly notes it needs operations' confirmation, and requires the engine to behave correctly with `stub_days = 0` either way.
2. **A2–A5** (stub day-count, stub formula, fold-into-instalment-1, month-end clamp) are recorded as your flagged defaults, not policy.
3. **A6/A7** (negative rate, invalid date) are my own assumptions beyond what you stated.
4. **APR methodology (Q1)** is left open: you specified an actual/365 basis, but "APR" has a CBK-sensitive definition you didn't pin down, so I wrote a working definition and marked it *confirm before customer disclosure*.

One note on process: the BMAD PRD skill I started with expects a `_bmad/` project scaffold, which isn't installed here, so I followed its documented fallback (use defaults, run Discovery) and saved to `spec.md` as you asked rather than its run-folder structure.

If you want, I can resolve any of the §10 items now (A1 and Q1 are the two that most affect correctness) or fold in your operations confirmation when you have it.
A: Good summary — the spec sounds well-structured and the worked example gives a solid closure check. On the two items you flagged: A1 genuinely needs operations; I cannot give you a policy answer on the cycle-day trigger, so leave it open until that confirmation arrives. Q1: I can confirm the actual/365 basis for the disclosed APR, but the precise CBK regulatory definition is outside what I can pin down here, so your 'confirm before customer disclosure' flag is the right call. No further questions from me — fold in the operations answer when it comes.

## Produced specification

---
title: Repayment Schedule Engine — Requirements Specification
status: draft
created: 2026-11-08
updated: 2026-11-08
owner: hga@juxt.pro (product stakeholder)
---

# Repayment Schedule Engine — Requirements Specification

## 1. Purpose & Scope

Build `generate_schedule(loan)`, a function that produces the full repayment
schedule for a **disbursed** loan: for each instalment, the interest due, the
principal due, the total instalment, and the running (closing) balance, plus a
summary block.

The loan product uses the **equal-principal (declining-balance)** method with a
**30/360** interest convention, denominated in **Kenyan shillings (KES)**,
rounded to the **whole shilling**. These are confirmed institutional policy, not
defaults — see §3.

**In scope:** schedule generation for a single loan from its contractual terms.

**Out of scope (not mentioned in the brief; flag if needed later):** fees and
charges, insurance, VAT/excise on interest, prepayment/early-settlement,
restructuring, arrears/penalty interest, variable rates, and persistence. No fee
of any kind is modelled; "total cost of credit" here is interest only (§6).

## 2. Definitions

| Term | Meaning |
|---|---|
| Principal (P) | Disbursed loan amount, in KES. |
| Annual nominal rate (r) | Contractual annual nominal interest rate (e.g. `0.18` for 18%). |
| Term (n) | Number of monthly instalments; positive integer. |
| Disbursement date | Date funds were advanced. |
| Opening balance | Outstanding principal at the start of a period. |
| Closing balance | Outstanding principal at the end of a period (= running balance). |
| Instalment | Total amount due in a period = principal due + interest due. |
| Stub period | Optional short first period between disbursement and the first full-period start (§5.3). |

## 3. Confirmed Policy Decisions

These were decided by the stakeholder and are **binding**.

- **P1 — Amortisation method: equal principal (declining balance).** A fixed
  principal portion of `P / n` is repaid each period; interest is charged on the
  reducing balance, so the total instalment **decreases** over the term.
- **P2 — Interest convention: 30/360.** Every month is treated as 30 days and
  the year as 360 days. Interest is computed **once per monthly period**, not by
  daily accrual. A full regular period therefore carries a factor of
  `30/360 = 1/12`, i.e. the monthly rate is `r / 12`.
- **P3 — Disbursement date does not affect regular-period interest.** Every
  regular period's interest is `r / 12` applied to that period's opening balance,
  independent of when disbursement occurred. The disbursement date affects
  **only** the one-off stub charge (§5.3).
- **P4 — First instalment timing.** The first due date is the disbursement date
  plus one month; subsequent instalments fall monthly thereafter.
- **P5 — Rounding: whole shilling, half-up.** All schedule amounts (interest,
  principal, instalment, balances) are rounded to the **whole KES** using
  **round-half-up**. Within a period, interest is computed and rounded first;
  the principal portion is the fixed `P / n` (also rounded — see P6).
- **P6 — Residual settled in the final instalment.** Accumulated rounding
  differences are absorbed by setting the **final** instalment's principal equal
  to the exact remaining balance, so the closing balance is **exactly zero**.
- **P7 — Currency: KES.** Intermediate values and disclosures are expressed to
  **2 decimal places**, even though per-row schedule amounts round to the whole
  shilling.
- **P8 — Each schedule row carries a due date** (§4.2).
- **P9 — Summary outputs:** total cost of credit (sum of all interest) and a
  disclosed APR on an **actual/365** basis (§6).
- **P10 — Validation:** zero/negative principal and zero/negative term are
  rejected as errors; a **zero** nominal rate is accepted and yields a
  zero-interest schedule (§7).

## 4. Interface

### 4.1 Input — `loan`

| Field | Type | Required | Notes |
|---|---|---|---|
| `principal` | decimal (KES) | yes | Must be `> 0` (§7). |
| `annual_nominal_rate` | decimal | yes | e.g. `0.18`; `0` is valid (§7). |
| `term_months` | integer | yes | Must be `>= 1` (§7). |
| `disbursement_date` | date | yes | Used for due dates and the stub charge. |
| `cycle_day` | integer (1–31) | optional | Product billing day; drives the stub (§5.3). **[ASSUMPTION A1]** |

### 4.2 Output

`generate_schedule(loan)` returns a **schedule object** with:

- `rows`: ordered list, one per instalment. Each row has:
  - `instalment_number` — `1 … n` (a stub row, if emitted, is `0` — but under
    the confirmed fold-in policy no row 0 is produced; see §5.3 / A4).
  - `due_date`
  - `opening_balance`
  - `interest_due`
  - `principal_due`
  - `total_instalment` (= `principal_due + interest_due`)
  - `closing_balance`
- `summary`:
  - `total_interest` / `total_cost_of_credit` — sum of all `interest_due` (incl. stub).
  - `total_repayable` — `principal + total_interest`.
  - `apr` — disclosed APR, actual/365 basis (§6). **[OPEN Q1 — methodology]**

The final row's `closing_balance` is exactly `0`.

## 5. Computational Requirements

Let `P = principal`, `r = annual_nominal_rate`, `n = term_months`,
`monthly_rate = r / 12`. All monetary results are rounded to the whole KES,
half-up (P5), via a helper `round_kes(x)`.

### 5.1 Principal schedule (FR-1)

- `base_principal = round_kes(P / n)`.
- For instalments `1 … n-1`: `principal_due = base_principal`.
- For instalment `n`: `principal_due = opening_balance` of that period (i.e. the
  exact remaining balance), which absorbs all rounding residual (P6). This may be
  larger or smaller than `base_principal`.

### 5.2 Interest per period (FR-2)

For each period `k`:

```
interest_regular(k) = round_kes(opening_balance(k) * monthly_rate)
```

With `monthly_rate = r / 12` per P2/P3. When `r = 0`, every `interest_regular`
is `0` and the schedule is principal-only.

### 5.3 Stub period (FR-3) — **[ASSUMPTION, pending ops confirmation]**

The brief did not specify the stub trigger. Working model, to be confirmed by
operations (**A1/A2/A3/A4**):

- **A1 (trigger).** If the product defines a `cycle_day` and disbursement does
  not fall on it, the days between `disbursement_date` and the first full-period
  start form a **stub**. If the product instead anchors periods strictly to the
  disbursement day (a literal reading of P4), **no stub ever arises** and this
  section is inert — the engine must still behave correctly, producing
  `stub_days = 0`.
- **A2 (day count).** Stub days are counted on the **30/360** basis, consistent
  with P2.
- **A3 (amount).** `stub_interest = round_kes(P * r * stub_days / 360)`, charged
  on the full opening principal.
- **A4 (placement).** The stub is **interest-only** and is **folded into
  instalment 1's interest** (no separate row 0). The principal schedule remains
  `P / n` across the `n` regular instalments.

So instalment 1 interest = `interest_regular(1) + stub_interest`; all other
periods use `interest_regular(k)`.

> If operations later require a distinct stub **row**, number it `0` with its own
> due date (the first full-period start) and `principal_due = 0`.

### 5.4 Period assembly (FR-4)

```
balance = P
for k in 1 … n:
    opening_balance = balance
    interest_due    = interest_regular(k) + (stub_interest if k == 1 else 0)
    principal_due   = base_principal if k < n else balance
    total_instalment= principal_due + interest_due
    balance         = balance - principal_due        # closing_balance
emit row(k, due_date(k), opening_balance, interest_due,
         principal_due, total_instalment, closing_balance = balance)
```

Post-condition: final `closing_balance == 0` (FR-5).

### 5.5 Due dates (FR-6)

- `due_date(k) = disbursement_date + k months` (P4), with the
  **month-end clamp** below.
- **Month-end clamp [ASSUMPTION A5]:** when the disbursement day-of-month does
  not exist in a target month (e.g. the 31st, or 29–31 → February), clamp to the
  **last calendar day** of that month.
- If the confirmed stub model (A1) uses a `cycle_day`, due dates anchor to the
  cycle day instead; this is to be settled with operations alongside A1.

## 6. Summary & APR

- **Total cost of credit (FR-7):** sum of every row's `interest_due`, including
  the stub. There are no fees, so this equals total interest.
- **Total repayable:** `principal + total_cost_of_credit`.
- **Disclosed APR (FR-8):** computed on an **actual/365** basis (P9).
  **[OPEN Q1]** The exact APR methodology was not specified. APR in Kenya has a
  regulator-sensitive definition (CBK total-cost-of-credit / effective rate
  disclosure). Pending confirmation, the working definition is: the annualised
  effective rate that equates the present value of the scheduled instalment
  cash-flows to the disbursed principal, discounting on actual elapsed days ÷ 365
  between disbursement and each due date. Confirm before relying on this figure
  for customer disclosure.

## 7. Validation (FR-9)

`generate_schedule` must reject invalid input with a clear error (not a silent
or malformed schedule):

| Condition | Result |
|---|---|
| `principal <= 0` | Error — invalid principal. (P10) |
| `term_months <= 0` or non-integer | Error — invalid term. (P10) |
| `annual_nominal_rate == 0` | **Accepted** — zero-interest schedule. (P10) |
| `annual_nominal_rate < 0` | Error — invalid rate. **[ASSUMPTION A6]** (not stated; negative rates rejected) |
| `disbursement_date` missing/invalid | Error — invalid date. **[ASSUMPTION A7]** |

**Edge note:** when `P < n`, `base_principal` may round to `0` for early
periods; the final instalment still clears the exact balance (P6), so the
schedule remains valid. Behaviour should be covered by a test.

## 8. Non-Functional Requirements

- **NFR-1 — Monetary precision.** Use exact decimal arithmetic (e.g. a Decimal
  type), never binary floating point, for all money math. Rounding is explicit
  and half-up (P5).
- **NFR-2 — Determinism.** Same input ⇒ identical schedule.
- **NFR-3 — Exact closure.** Final closing balance is exactly `0`; the sum of
  `principal_due` equals `P`; the sum of `interest_due` equals `total_interest`.
- **NFR-4 — Purity.** No I/O, persistence, or clock/locale dependence in
  `generate_schedule`; all inputs arrive via `loan`.

## 9. Worked Example (verification fixture)

`P = 100,000 KES`, `r = 0.12` (12%), `n = 12`, with a **15-day stub** (A3:
`stub_interest = round(100000 × 0.12 × 15/360) = 500`). `monthly_rate = 0.01`,
`base_principal = round(100000 / 12) = 8,333`.

| # | Opening | Interest | Principal | Instalment | Closing |
|--:|--------:|---------:|----------:|-----------:|--------:|
| 1 | 100,000 | 1,500 | 8,333 | 9,833 | 91,667 |
| 2 | 91,667 | 917 | 8,333 | 9,250 | 83,334 |
| 3 | 83,334 | 833 | 8,333 | 9,166 | 75,001 |
| 4 | 75,001 | 750 | 8,333 | 9,083 | 66,668 |
| 5 | 66,668 | 667 | 8,333 | 9,000 | 58,335 |
| 6 | 58,335 | 583 | 8,333 | 8,916 | 50,002 |
| 7 | 50,002 | 500 | 8,333 | 8,833 | 41,669 |
| 8 | 41,669 | 417 | 8,333 | 8,750 | 33,336 |
| 9 | 33,336 | 333 | 8,333 | 8,666 | 25,003 |
| 10 | 25,003 | 250 | 8,333 | 8,583 | 16,670 |
| 11 | 16,670 | 167 | 8,333 | 8,500 | 8,337 |
| 12 | 8,337 | 83 | **8,337** | 8,420 | **0** |

Row 1 interest = `1,000` regular + `500` stub. Instalment 12 principal = `8,337`
(absorbs the `+4` rounding residual from `11 × 8,333 = 91,663`).
`total_interest = 7,000`. Without the stub, row 1 interest is `1,000` and
`total_interest = 6,500`.

## 10. Open Items & Assumptions Register

**Confirm before build / before customer disclosure:**

| ID | Item | Status |
|---|---|---|
| A1 | Stub trigger = product `cycle_day` model | **Assumption** — stakeholder to confirm with operations. If strict disbursement-anchored months are used, stub is always 0 and §5.3 is dead text. |
| A2 | Stub days counted on 30/360 | Default, not policy. |
| A3 | Stub = `P × r × stub_days / 360` on full principal | Default, not policy. |
| A4 | Stub folded into instalment 1 (no row 0) | Default, not policy. |
| A5 | Due-date month-end clamp to last calendar day | Default, not policy. |
| A6 | Negative rate rejected | Assumption (not in brief). |
| A7 | Missing/invalid disbursement date rejected | Assumption (not in brief). |
| Q1 | Exact APR methodology (actual/365) | **Open question** — CBK-sensitive; working definition in §6 pending confirmation. |

**Confirmed and closed:** P1–P10 (§3).


## Auditor verdict

_The spec correctly nails 11 of 14 decisions (coverage 11/14), including the bespoke 30/360 convention (#3), same-as-period interest (#4), equal-principal amortisation (#2), whole-shilling rounding with final-instalment residual (#7), and the non-obvious 30/360-accrual-but-actual/365-disclosure split (#14). It misses decision 8 (orders interest first but fixes principal at P/n rather than making principal the remainder of the rounded instalment) and decisions 10 and 11 (Rule-of-78 rebate and principal-first/term-fixed re-amortisation), both explicitly pushed out of scope as prepayment/early-settlement. Decision 5 (stub/partial-period interest from disbursement) is matched in mechanism but hedged as an unconfirmed assumption. The gap concentrates on the core-method prepayment decisions (10, 11) and the rounding-order subtlety (8)._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | P1: "equal principal (declining balance)... interest is charged on the reducing balance"; §5.2 interest_regular(k) = round_kes(opening_balance(k) * monthly_rate) | Spec explicitly uses declining balance on the reducing principal, matching the reference method exactly. |
| 2 | yes | **yes** | P1: "A fixed principal portion of P / n is repaid each period; interest is charged on the reducing balance, so the total instalment decreases over the term." | Matches reference equal-principal method (constant P/n, decreasing total instalment, not EMI) precisely. |
| 3 | yes | **yes** | P2: "Interest convention: 30/360. Every month is treated as 30 days and the year as 360 days." | Exact match to the reference 30/360 convention. |
| 4 | yes | **yes** | P2: "Interest is computed once per monthly period, not by daily accrual." | Matches reference: interest calculated once per repayment period, not daily accrual. |
| 5 | yes | **yes** | §5.3/A3: "stub_interest = round_kes(P * r * stub_days / 360), charged on the full opening principal"; A2 counts stub days on 30/360; folded into instalment 1 interest | Spec models partial-period stub interest for days from disbursement on a 30/360 basis, matching the reference mechanism; it is hedged as an assumption but the resolution aligns with interest accruing from the disbursement date with a stub charge. |
| 6 | yes | **yes** | P7: "Currency: KES... expressed to 2 decimal places"; §4.1 principal in KES | KES with 2 decimal places for disclosures matches the reference units and precision. |
| 7 | yes | **yes** | P5: "rounded to the whole KES"; P6: "Accumulated rounding differences are absorbed by setting the final instalment's principal equal to the exact remaining balance" | Instalments rounded to whole shilling with residual settled in the final instalment, matching the reference exactly. |
| 8 | yes | no | P5: "Within a period, interest is computed and rounded first; the principal portion is the fixed P / n (also rounded)" | Spec correctly orders interest-rounded-first, but the reference requires principal to be the REMAINDER of the rounded instalment; the spec instead fixes principal at P/n, so the second half of the resolution does not match. |
| 9 | yes | **yes** | P6/§4.2: "the closing balance is exactly zero"; "The final row's closing_balance is exactly 0." | Final instalment reconciles to an exactly zero closing balance, matching the reference. |
| 10 | no | no | §1 Out of scope: "prepayment/early-settlement" (listed as not modelled, flag if needed later) | Early full-settlement rebate is explicitly excluded, not resolved; the reference Rule-of-78 rebate method is absent. |
| 11 | no | no | §1 Out of scope: "prepayment/early-settlement" | Partial prepayment handling is declared out of scope; the reference's principal-first, term-fixed re-amortisation is not addressed. |
| 12 | yes | **yes** | P10 / §7: "principal <= 0 \| Error"; "term_months <= 0 or non-integer \| Error" | Zero/negative principal and term are rejected as invalid, matching the reference edge rule. |
| 13 | yes | **yes** | P4: "The first due date is the disbursement date plus one month; subsequent instalments fall monthly thereafter." | First due date = disbursement + one month with monthly cadence, matching the reference. |
| 14 | yes | **yes** | §4.2 rows (due_date, opening_balance, interest_due, principal_due, total_instalment, closing_balance) + summary; §6 FR-8: "Disclosed APR... computed on an actual/365 basis" while accrual uses 30/360 (P2) | Spec returns the full per-period schedule, total cost of credit (sum of interest), and an APR disclosed on actual/365 while accrual uses 30/360, capturing the reference's dual day-count disclosure quirk; APR formula is left open but the actual/365 basis matches. |
