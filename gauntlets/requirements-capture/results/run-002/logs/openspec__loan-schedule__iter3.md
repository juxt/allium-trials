# openspec — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 9 · Captured: 12/14 · Bespoke captured: 4/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured prompt didn't go through. Let me just ask directly in text — you're the stakeholder, so answer however is easiest.

To compute the schedule correctly I need your institution's specific policy on these points. Each has several plausible answers and I don't want to guess:

**1. Amortization method** — how are instalments structured?
- (a) **Equal instalments / annuity** — same total each period, interest shrinks as principal grows
- (b) **Equal principal** — fixed principal chunk each period, declining total instalment
- (c) **Interest-only + balloon** — interest each period, full principal in the last instalment

**2. Interest basis (day-count)** — how is each period's interest derived from the *annual nominal* rate?
- (a) **Nominal ÷ 12** — flat monthly rate, ignores actual days
- (b) **Actual/365**, (c) **30/360**, or (d) **Actual/360** — all calendar-sensitive

**3. First instalment timing & the disbursement-to-first-payment gap**
- (a) **One month after, no stub** — every period a clean month
- (b) **Fixed due day each month + stub period** — first period accrues interest on its actual days
- (c) **One month after, but odd-days interest** on the first period

**4. Rounding & final-instalment reconciliation**
- (a) **Round interest & principal to cents each period; final instalment adjusts** so the balance closes to exactly zero
- (b) **Round the total instalment to cents; derive interest = round(balance × rate), principal = payment − interest**; final absorbs residual
- (c) **Full precision**, no rounding

A couple of smaller things, if you have a view (otherwise I'll note a reasonable assumption):

**5.** What should the `loan` input look like, and what fields should each schedule row expose beyond interest / principal due / running balance (e.g. instalment number, due date, opening balance, total payment)?

**6.** Currency/precision — is this cents-based decimal money (2 dp), or something else?

Once you answer 1–4 (and 5–6 if you have preferences), I'll write the OpenSpec artifacts and save the final `spec.md`.
A: Happy to answer these directly.

**1. Amortisation method:** Equal principal — option (b). A fixed principal portion each period (P/n), interest computed on the reducing balance, so the total instalment decreases over the term. Not an annuity/EMI structure.

**2. Interest basis (day-count):** 30/360 — option (c). Every month is treated as 30 days, the year as 360. Interest is computed once per monthly period (not daily accrual), so the monthly rate is simply the annual nominal rate divided by 12 under 30/360 conventions.

**3. First instalment timing:** One calendar month after disbursement, but with a stub period — closest to option (c). If the disbursement date precedes the first period start, a partial-period interest charge is levied for those extra days. Interest accrues from the disbursement date.

**4. Rounding:** Round each instalment to the whole shilling (no cents). Within a period, compute and round interest first; principal is the remainder of that rounded instalment. Accumulated rounding differences are settled in the final instalment, which is adjusted so the closing balance is exactly zero.

**5. Input and output shape:** The loan input should carry at minimum: principal amount, annual nominal rate, term in months, and disbursement date. Each schedule row should expose: period number, due date, opening balance, interest charge, principal charge, total instalment, closing balance. The output should also include the total cost of credit (sum of all interest charges) and the disclosed APR — computed on an actual/365 basis for disclosure purposes, even though accrual uses 30/360.

**6. Currency and precision:** Kenyan shilling (KES), amounts stored and displayed to 2 decimal places — except instalments, which are rounded to the whole shilling as noted above.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thanks — that resolves most of it. A few of your answers interact in ways I can't resolve by inference, and getting them wrong would produce a different schedule, so three more clarifications before I write the spec:

**A. Equal-principal split vs. your rounding rule.** These two answers are in slight tension. In a classic equal-principal loan the *principal* portion is the fixed quantity (P/n) and interest is added on top. But your rounding rule says "round the instalment, compute interest first, principal is the **remainder** of the rounded instalment" — which is annuity-style back-out logic. Which do you mean per period (before the final reconciliation)?
- **(i)** Principal fixed at `round(P/n)`; `interest = round(openingBalance × rate)`; `instalment = principal + interest`. Principal stays constant each period; the instalment is simply their sum.
- **(ii)** `instalment = round(P/n + interest)` first; `interest = round(openingBalance × rate)`; `principal = instalment − interest`. The instalment is the rounded quantity and principal drifts by a shilling or two around P/n.

**B. Stub mechanics & due-date anchoring.** You said "one calendar month after disbursement" *and* "if the disbursement date precedes the first period start, a partial charge for the extra days." For a stub to exist, period boundaries must be anchored to something other than the disbursement date. Which is it?
- What anchors the due dates — the **day-of-month of disbursement** (e.g. disbursed on the 12th → instalments on the 12th), or a **fixed cycle day** (e.g. always the 1st), with the gap from disbursement to that first cycle day being the stub?
- The stub interest — is it `openingBalance × rate × (stubDays / 30)` under 30/360, **added into period 1's interest** (so period 1 can exceed a full month's interest), or billed as a separate line?
- Month-end roll: if disbursed on the 31st (or 29th–31st), how do due dates behave in short months?

**C. Disclosed APR definition.** On an actual/365 basis — I read this as the annualized internal rate of return that equates the disbursed principal to the actual-dated instalment cash flows. Confirm:
- It's the **IRR of the net cash flows using actual calendar days / 365**, with **no fees** included (none were mentioned — interest only)?
- Expressed as a **nominal annual rate** (periodic IRR × periods) or an **effective annual rate** (compounded)?
- Computed on the **rounded** whole-shilling instalments (what the borrower actually pays), not the unrounded ones?
A: A. Option (ii). Interest is computed and rounded first (`round(openingBalance × monthlyRate)`); the nominal instalment (`P/n + interest`) is then rounded to the whole shilling; principal is the remainder (`roundedInstalment − roundedInterest`). Principal therefore drifts by at most one shilling around P/n each period, which is correct — the final instalment reconciles the accumulated drift so the balance closes to zero.

B. Due dates are anchored to the day-of-month of disbursement (key 13: first due = disbursement + one calendar month, subsequent instalments monthly thereafter). A stub arises only if your system chooses to open the first period on a date prior to disbursement — that is not our standard case. Under the standard case, period 1 starts on the disbursement date, runs one calendar month, and there is no stub. If a future implementation does introduce a fixed cycle day, stub interest would be `openingBalance × monthlyRate × (stubDays / 30)` added into period 1's interest charge, not a separate line. Month-end roll (disbursement on the 29th–31st): [default, not policy] — clamp to the last calendar day of the target month.

C. Confirmed: the disclosed APR is the IRR of the net cash flows (disbursement out, actual-dated rounded instalments in) using actual calendar days divided by 365. No fees are included — interest charges only. Express it as a nominal annual rate (periodic IRR × 12), not an effective annual rate. Use the rounded whole-shilling instalments, since that is what the borrower actually pays.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved as **`spec.md`** in this directory. It is done.

## What I did

Rather than guess the policy decisions the brief deliberately omitted, I asked you — and every material choice in the schedule now traces to your answers:

- **Equal-principal** amortisation (not annuity/EMI)
- **30/360** accrual, monthly rate = nominal ÷ 12 on the opening balance
- Due dates **anchored to the disbursement day-of-month**, no stub in the standard case (stub formula documented for the future fixed-cycle variant)
- **Whole-shilling rounding** — interest first, instalment rounded, principal as remainder; final instalment reconciles to a zero balance
- **KES**, balances to 2 dp, charges whole shillings
- Summary with **total cost of credit** and a **disclosed APR** (actual/365 IRR × 12, rounded cash flows, no fees)

The one point I didn't re-ask — the exact APR discounting granularity — is pinned down in the spec as the smallest construction consistent with your "actual/365, periodic IRR × 12, rounded instalments" answer, and a worked example verifies it end to end (principal sums to 100,000, closing balance 0.00, APR ≈ 12.17%).

## Artifacts

`spec.md` is the consolidated single-document spec you asked for. It's backed by a full OpenSpec change at `openspec/changes/add-repayment-schedule-engine/` (validates clean, 4/4 artifacts):

- **proposal.md** — why, and the `repayment-schedule` capability
- **specs/repayment-schedule/spec.md** — the behavioural contract (requirements + testable scenarios)
- **design.md** — algorithm, money representation, APR root-finding, rounding reconciliation, and two deferrable open questions (month-end roll, APR display precision)
- **tasks.md** — implementation breakdown with verification per group

Two items are flagged in the spec as *defaults, not policy* — the month-end roll convention and APR display precision — if you want to pin either, say so and I'll fold it in.

**No code was written** — this was planning only. When you're ready to implement, run `/opsx:apply`.
A: Noted. The two open defaults — month-end roll and APR display precision — are fine to leave as documented defaults for now.

## Produced specification

# Repayment Schedule Engine — Specification

Status: complete. This is the consolidated, self-contained specification for
`generate_schedule(loan)`. The same content is maintained as an OpenSpec change
under `openspec/changes/add-repayment-schedule-engine/` (proposal, spec delta,
design, tasks); this file is the single-document view requested by the
stakeholder.

Every policy decision below was confirmed with the product stakeholder. Points
marked *[default]* are reasonable defaults the stakeholder did not fix as policy
and may be revised without affecting the rest of the specification.

## 1. Purpose and interface

Given a disbursed loan, produce the full repayment schedule — the interest,
principal, and running balance for each instalment — plus the total cost of
credit and the disclosed APR.

```
generate_schedule(loan) -> { rows: [InstalmentRow], summary: Summary }
```

### Input: `loan`
Carries at minimum:
- `principal` — disbursed principal amount (KES)
- `annualNominalRate` — annual nominal interest rate (e.g. `0.12` for 12%)
- `termMonths` — term as a whole number of monthly instalments, `n`
- `disbursementDate` — the date funds were disbursed

### Output row: `InstalmentRow`
- `period` — 1-based instalment number
- `dueDate` — the instalment's due date
- `openingBalance` — balance at the start of the period (KES, 2 dp)
- `interest` — interest charge for the period (whole shillings)
- `principal` — principal charge for the period (whole shillings)
- `instalment` — total instalment, `interest + principal` (whole shillings)
- `closingBalance` — balance after the instalment (KES, 2 dp)

### Output: `summary`
- `totalCostOfCredit` — sum of all interest charges (KES)
- `disclosedAPR` — nominal annual APR, actual/365 basis (see §7)

## 2. Amortisation — equal principal (reducing balance)

The schedule uses **equal-principal** amortisation, not an annuity/EMI structure:

- A fixed principal portion of `principal / termMonths` is repaid each period
  (subject to the rounding rule in §5).
- Interest is charged on the **opening balance** of each period.
- The **total instalment therefore declines** over the term as the balance
  reduces.

## 3. Interest accrual — 30/360

- Interest is computed **once per monthly period** on the opening balance.
- The monthly periodic rate is `annualNominalRate / 12`.
- The convention is **30/360**: every month is treated as 30 days and the year
  as 360, so each standard period is charged the same monthly rate regardless of
  the calendar length of the month. Interest does **not** accrue daily within a
  standard period.

## 4. Due dates and first period

- Due dates are anchored to the **day-of-month of the disbursement date**.
- The **first instalment** falls **one calendar month after disbursement**; each
  later instalment falls one calendar month after the previous.
- **Standard case: no stub.** Period 1 opens on the disbursement date and runs
  one calendar month to the first due date, carrying exactly one month's
  interest.
- **Future fixed-cycle-day variant (not built in the standard case):** if a first
  period opens on a date *before* disbursement, a partial-period charge of
  `openingBalance × (annualNominalRate / 12) × (stubDays / 30)` is **folded into
  period 1's interest** (not billed as a separate line).
- *[default]* **Month-end roll:** when the anchor day-of-month does not exist in a
  target month (e.g. the 29th–31st targeting February), clamp the due date to the
  last calendar day of that month.

## 5. Rounding — whole Kenyan shilling

All currency is **Kenyan shillings (KES)**. Balances are carried to two decimal
places; interest, principal, and instalment charges are **whole shillings**.

For each **non-final** period, in this exact order:

1. `interest   = round_shilling(openingBalance × (annualNominalRate / 12))`
2. `instalment = round_shilling(principal / termMonths + interest)`
3. `principal  = instalment − interest`
4. `closingBalance = openingBalance − principal`

Interest is rounded first; the total instalment is then rounded; principal is the
**remainder**. As a consequence each non-final principal charge is within one
shilling of `principal / termMonths`. Rounding is **round-half-up** to the whole
shilling.

## 6. Final instalment — reconciliation to zero

The final instalment absorbs all accumulated rounding differences:

1. `interest  = round_shilling(openingBalance × (annualNominalRate / 12))`
2. `principal = openingBalance`  (the entire remaining balance)
3. `instalment = principal + interest`
4. `closingBalance = 0.00`  (exactly)

Invariants: the final closing balance is exactly zero, and the sum of all
principal charges equals the original principal exactly.

## 7. Disclosure figures

### Total cost of credit
The sum of all rounded interest charges across every instalment.

### Disclosed APR — actual/365 basis
The APR is the **internal rate of return** that equates the disbursed principal
to the actual-dated instalment cash flows:

- Cash flows: `−principal` at the disbursement date and `+instalment_k` (the
  **rounded** whole-shilling instalment the borrower actually pays) at each due
  date.
- Timing uses **actual calendar days / 365**: for cash flow `k`,
  `t_k (in months) = actualDays_k × 12 / 365`, where `actualDays_k` is the real
  day count from disbursement to due date `k`.
- Solve for the monthly periodic rate `i` such that
  `Σ CF_k × (1 + i)^(−t_k) = 0`.
- Report `APR = i × 12` — a **nominal** annual rate (not an effective rate).
- **No fees** are included (interest only).

## 8. Validation and edge cases

- Reject non-positive `principal`, non-positive or non-integer `termMonths`, and
  a missing `disbursementDate`, with a clear error.
- A **negative** rate is out of scope.
- A **zero** rate is valid: all interest is zero and instalments are pure
  principal.
- `termMonths = 1`: the single period is the final period (all principal plus one
  month's interest, closing balance zero).

## 9. Worked example (verification oracle)

Loan: `principal = 100,000.00 KES`, `annualNominalRate = 0.12` (12%),
`termMonths = 3`, `disbursementDate = 2026-01-13`. Monthly rate = `0.01`;
`principal / n = 33,333.33 → 33,333`.

| Period | Due date   | Opening     | Interest | Principal | Instalment | Closing    |
|-------:|------------|------------:|---------:|----------:|-----------:|-----------:|
| 1      | 2026-02-13 | 100,000.00  | 1,000    | 33,333    | 34,333     | 66,667.00  |
| 2      | 2026-03-13 |  66,667.00  |   667    | 33,333    | 34,000     | 33,334.00  |
| 3      | 2026-04-13 |  33,334.00  |   333    | 33,334    | 33,667     |      0.00  |

- Sum of principal charges = 100,000 (equals original principal). ✓
- Final closing balance = 0.00. ✓
- **Total cost of credit** = 1,000 + 667 + 333 = **2,000 KES**.
- **Disclosed APR** (actual/365, nominal): day offsets 31, 59, 90 from
  disbursement; monthly IRR ≈ 0.0101384, so **APR ≈ 12.17%** (`i × 12`).

## 10. Non-goals

Fees, penalties, early/partial repayment, restructuring, variable rates,
multi-currency, persistence, and transport/serialization are out of scope for
this change.


## Auditor verdict

_The spec correctly resolves 12 of 14 decisions. All of the bespoke accrual/rounding/output decisions (amortisation #2, 30/360 #3, period method #4, disbursement-date accrual with charged partial-period interest #5, whole-shilling rounding #7, interest-first rounding order #8, and the 30/360-accrual-but-actual/365-disclosure split #14) are surfaced and match, as do the inferable anchors (#1, #6, #9, #12, #13). The two misses are the method decisions the spec declares out of scope: early full-settlement rebate by Rule of 78 (#10) and partial prepayment re-amortisation keeping term fixed (#11), neither of which is surfaced or resolved. Decision #5 is a close call: the policy (accrue from disbursement, charge partial-period interest) matches, but the stub condition is stated in the inverse direction and tagged a future variant._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §2 "Interest is charged on the opening balance of each period"; §3 "Interest is computed once per monthly period on the opening balance" with "The total instalment therefore declines over the term as the balance reduces." | The spec charges interest on the reducing opening balance, i.e. declining balance on reducing principal, matching the reference exactly. |
| 2 | yes | **yes** | §2 "The schedule uses equal-principal amortisation, not an annuity/EMI structure"; "A fixed principal portion of principal / termMonths is repaid each period"; "The total instalment therefore declines over the term". | Equal-principal (P/n constant, interest on reducing balance, declining total instalment) is stated explicitly and excludes EMI, exactly matching the reference. |
| 3 | yes | **yes** | §3 "The convention is 30/360: every month is treated as 30 days and the year as 360". | 30/360 is stated verbatim, not actual/365, matching the reference. |
| 4 | yes | **yes** | §3 "Interest is computed once per monthly period on the opening balance"; "Interest does not accrue daily within a standard period." | Interest calculation period is the repayment period (once per month), not daily accrual, matching the reference. |
| 5 | yes | **yes** | §4 "Period 1 opens on the disbursement date"; variant: partial-period charge "openingBalance × (annualNominalRate / 12) × (stubDays / 30)" "folded into period 1's interest". | The spec confirms interest accrues from the disbursement date and that partial-period (stub) interest is allowed and charged, the material decision. The stub condition is framed in the inverse direction (period opening before disbursement rather than disbursement preceding period start) and tagged a future variant, but the policy resolution (charge partial-period interest) matches. |
| 6 | yes | **yes** | §1 input "principal — disbursed principal amount (KES)"; §5 "All currency is Kenyan shillings (KES). Balances are carried to two decimal places". | Currency KES and two-decimal precision for amounts match the reference. |
| 7 | yes | **yes** | §5 instalment charges are "whole shillings"; §6 "The final instalment absorbs all accumulated rounding differences". | Each instalment is rounded to the whole shilling and the accumulated rounding difference is settled in the final instalment, matching the reference. |
| 8 | yes | **yes** | §5 ordered steps: "1. interest = round_shilling(...)" then "3. principal = instalment − interest"; "Interest is rounded first ... principal is the remainder." | Interest is computed and rounded first and principal is the remainder of the rounded instalment, matching the within-period rounding order. |
| 9 | yes | **yes** | §6 "closingBalance = 0.00 (exactly)"; "the final closing balance is exactly zero". | The final instalment reconciles the closing balance to exactly zero, matching the reference. |
| 10 | no | no | §10 Non-goals: "early/partial repayment ... are out of scope for this change." | The early-settlement rebate decision is explicitly excluded, so the spec neither resolves it nor states the Rule of 78; it is punted rather than surfaced. |
| 11 | no | no | §10 Non-goals: "early/partial repayment ... out of scope". | Partial prepayment handling (apply to principal, re-amortise keeping term fixed) is declared out of scope, so the specific re-amortisation strategy is neither surfaced nor stated. |
| 12 | yes | **yes** | §8 "Reject non-positive principal, non-positive or non-integer termMonths ... with a clear error." | Zero/negative principal and zero/negative term are rejected as invalid with an error, matching the reference. |
| 13 | yes | **yes** | §4 "The first instalment falls one calendar month after disbursement; each later instalment falls one calendar month after the previous." | First due date = disbursement + one month with subsequent monthly instalments, matching the reference. |
| 14 | yes | **yes** | §1 InstalmentRow fields (period, dueDate, openingBalance, interest, principal, instalment, closingBalance); §7 "Total cost of credit" and "Disclosed APR — actual/365 basis" while §3 accrual is 30/360. | The spec returns the full per-period schedule, total cost of credit (sum of interest), and APR disclosed on actual/365 even though accrual uses 30/360, capturing the dual day-count disclosure quirk exactly. |
