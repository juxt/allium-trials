# aiup — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 12 · Captured: 11/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question dialog didn't go through. Let me just put the questions to you directly, they're the ones that matter most and can't be guessed.

To specify this engine correctly I need decisions on the following. Where a common industry convention exists I've noted it, but I'd rather you confirm than have me assume.

**1. Amortisation method.** How is each instalment structured?
- Equal instalment (annuity / "French") — every total payment identical, interest-heavy early.
- Equal principal — constant principal each period, declining total.
- Interest-only with a principal balloon in the final instalment.

**2. Interest accrual / day-count convention.** How is a period's interest derived from the annual nominal rate?
- Nominal / 12 flat — periodic rate = annual / 12 on the outstanding balance, every month treated alike.
- Actual/365 (or /366) — by actual days in the period.
- Actual/360.
- 30/360.

**3. First instalment date.** When is instalment 1 due relative to disbursement?
- Exactly one month after disbursement (no stub period).
- A fixed day of the month (e.g. the 1st), which creates a short or long first period.
- Anchored to the disbursement day-of-month, with a defined month-end rule (e.g. 31st → last day of shorter months).

If the answer implies a stub period, I'll also need to know how the odd-days interest in that first period is handled (charged in instalment 1, capitalised into principal, or waived).

**4. Rounding and residual reconciliation.** Two parts:
- Precision and mode — 2 decimal places? Half-up, or banker's (half-to-even), or truncate?
- Reconciliation — the periodic rounding leaves a few cents of drift; do you absorb it into the final instalment so the closing balance is exactly zero, spread it across instalments, or leave amounts at full precision?

**5. Business-day adjustment.** If a scheduled due date lands on a weekend or public holiday, does it stay put, or move (following / modified following / preceding)? If it moves, does the accrual period move with it or is interest unaffected?

**6. Currency and minimum unit.** Which currency, and therefore the minor unit for rounding (2dp for most, 0dp for e.g. JPY)? Is there a defined rounding unit beyond the minor unit (e.g. round instalments to the nearest cent, or something coarser)?

Answer whichever you're ready to, and I'll fold them in. Questions 1–4 are the ones that most change the numbers.
A: Answers in order:

**1. Amortisation method.** Equal principal. Each period carries a constant principal portion (P/n); interest is charged on the reducing balance, so the total instalment decreases over the term.

**2. Day-count convention.** 30/360. Every month is treated as 30 days, the year as 360. The periodic rate is therefore nominal/12 applied once per monthly period — not daily accrual.

**3. First instalment date.** One month after disbursement, anchored to the disbursement date. On the stub-period sub-question: if disbursement falls before the formal first period start, odd-days interest is charged as a stub in that partial period — it is neither waived nor capitalised.

**4. Rounding and reconciliation.** Currency is Kenyan shilling (KES). Instalments are rounded to the whole shilling (zero cents). Within a period, interest is computed and rounded first; principal is the remainder of the rounded instalment. The accumulated rounding drift is settled in the final instalment so the closing balance is exactly zero.

**5. Business-day adjustment.** No policy specified — [default, not policy]: scheduled dates are not adjusted; they fall as computed regardless of weekends or holidays.

**6. Currency and minimum unit.** KES, standard 2 decimal-place minor unit, but as noted in (4), instalments are rounded to the whole shilling — the effective rounding unit is 1 KES, not 0.01 KES.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Two of your answers contain a tension I don't want to paper over, because each reading produces a different schedule. Let me resolve them before I write anything down.

**On (3), the stub period.** You said instalment 1 falls exactly one month after disbursement, *anchored to the disbursement date* — that description has no stub, because the disbursement date is itself the first period's start. But the sub-answer says odd-days interest is charged as a stub "if disbursement falls before the formal first period start." Those only coexist if there's a "formal first period start" that is distinct from the disbursement date. So:

- What defines that formal first period start, and how can it differ from the disbursement date? (e.g. a fixed monthly billing anchor the loan is aligned to, a month-end normalisation, something else?)
- When a stub does arise, how are its days counted under 30/360 (actual days ÷ 360? days-to-anchor on the 30/360 grid?), and on what balance?
- Does the stub show as its own schedule line (an instalment 0), or fold into instalment 1's interest? Does it carry any principal, or is it interest-only? And does it leave the count at *n* instalments or add one?

If the intended answer is simply "in the normal anchored case the stub is zero days and the policy just never fires," tell me that and I'll record it as a documented edge case rather than a live computation.

**On (4) vs (1), what's fixed and what's derived.** Equal-principal (your answer 1) means the *principal* portion is the constant input, P/n, and the total instalment is the output (principal + interest, falling each period). But your rounding note says "interest is computed and rounded first; principal is the remainder of the rounded instalment" — that describes fixing the *instalment* and backing out principal, which is annuity logic. For equal-principal I'd expect this per period:

- `principal_i = round(P / n)` to the whole shilling (constant for i = 1…n−1),
- `interest_i = round(balance_i × nominal_rate / 12)` to the whole shilling,
- `instalment_i = principal_i + interest_i` (the derived, decreasing total),
- the **final** instalment repays the entire remaining balance plus its interest, absorbing all accumulated rounding drift so the closing balance is exactly zero.

Is that the intended mechanism? If instead you really do fix a rounded instalment and take principal as the remainder, that's a different method and I need to know the instalment formula.
A: Both tensions are real. Here are the resolutions.

**Stub period.** The normal case is as you suspected: disbursement date is the first period start, first instalment falls exactly one month later, stub days are zero and the policy never fires. Record it as a documented edge case — it exists for situations where the value date (the date from which interest accrues) differs from the disbursement date (e.g. backdated drawdowns). If that gap does arise, the stub interest accrues on the full disbursed principal for the odd days, counted on the 30/360 grid. Schedule-line treatment and whether it carries principal are not defined policy — [default, not policy]: treat it as an interest-only line 0, leaving the instalment count at n.

**Rounding mechanism.** Your proposed re-statement is not the intended mechanism. The answer key is explicit on order: interest is computed and rounded first; principal is the remainder of the rounded instalment. That means the instalment is the primary rounded quantity, not a derived sum. The correct per-period calculation is:

1. Compute the unrounded instalment (principal share P/n plus interest on the reducing balance).
2. Round the instalment to the whole shilling.
3. Compute and round interest independently.
4. Principal for that period = rounded instalment − rounded interest.
5. The final instalment repays the full remaining balance plus its interest, absorbing all accumulated drift so the closing balance is exactly zero.

The principal portion will be close to P/n each period but will vary by a shilling due to rounding — it is not held constant at round(P/n).

### Round 3
_Step reasoning:_ (live agent turn)

Q: Both resolutions are clear. One genuine gap remains that changes the numbers, plus a couple I can default unless you correct me.

**Rounding mode.** You've fixed the unit (whole KES) and the order (interest first, principal as the remainder), but not the *mode* for the rounding step. At an exact half-shilling this matters: is it round-half-up, round-half-to-even (banker's), or truncate toward zero? It also applies to the interest rounding.

The rest I'll record as defaults unless you say otherwise:
- **Zero interest.** A 0% nominal rate is permitted and produces a pure-principal schedule (interest zero every period). In scope?
- **Degenerate term.** `n = 1` is valid: a single instalment repaying principal plus one period's interest.
- **Invalid inputs.** The function raises/errors on principal ≤ 0, a negative rate, or a non-positive / non-integer term, rather than returning a partial schedule.

Confirm the rounding mode and I'll write the spec; correct any default you don't like.
A: **Rounding mode.** Not defined policy — [default, not policy]: round-half-up for both the instalment rounding and the independent interest rounding step.

**Zero interest.** [default, not policy]: confirmed as in scope; 0% nominal produces a pure-principal schedule with interest zero every period.

**Degenerate term n = 1.** [default, not policy]: confirmed as valid.

**Invalid inputs.** Partially confirmed by policy: principal ≤ 0 or a non-positive term is rejected with an error. Negative nominal rate and non-integer term are not defined policy — [default, not policy]: also rejected as invalid.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done. The specification is saved at `spec.md` in this directory.

It captures the engine as an equal-principal amortiser under a 30/360 convention, with the per-period calculation written out exactly as you specified: instalment rounded first as the primary quantity, interest rounded independently, principal taken as the remainder, and the final instalment absorbing all drift so the closing balance is zero. Currency, rounding unit and order, instalment dating, the value-date stub, validation and the edge cases are all in.

Two things worth flagging in how it's written:

- Every decision is tagged **Policy** or **Default**, and there's a decisions log at the end that lists the split at a glance. The four items you called out as institutional policy (equal principal, 30/360, one-month anchoring, whole-shilling rounding with interest-first order and final-instalment reconciliation) are marked Policy; the rest (rounding mode, stub line treatment, no business-day adjustment, zero-interest, `n = 1`, negative rate and non-integer term rejection) are marked Default, so a reviewer can see what's settled versus what's a working assumption open to change.
- The requirements themselves point back to a single "Computation policy" section that holds the algorithm, so the numeric behaviour lives in one place rather than being scattered across the FR table.

If you later define a business-day policy or a rounding mode by rule rather than default, those are the two rows most likely to move the numbers.
A: Received. The specification looks well-structured — the Policy/Default tagging and the single Computation policy section are sensible choices. No questions require answers from me here.

## Produced specification

# Requirements: repayment schedule engine

## Overview

Given a disbursed loan, the engine produces the full repayment schedule: for each
instalment, the interest due, the principal due, and the running balance. The single
entry point is `generate_schedule(loan)`, which returns the ordered schedule.

The brief named only the domain and the interface. Every material policy below was
elicited from the product stakeholder. Where the institution has a firm policy it is
marked **Policy**; where no policy exists and a sensible default was agreed it is marked
**Default** so a reviewer can see exactly what is settled and what is a working
assumption open to change.

## Domain model

### Loan (input)

| Field                  | Type            | Rule                                                                                      |
|------------------------|-----------------|-------------------------------------------------------------------------------------------|
| `principal`            | decimal (KES)   | The disbursed amount, `P`. Must be greater than zero.                                      |
| `annual_nominal_rate`  | decimal         | The annual nominal rate, `r`, as a fraction (0.14 = 14%). Must be greater than or equal to zero. |
| `term_months`          | integer         | The number of monthly instalments, `n`. Must be a positive integer.                       |
| `disbursement_date`    | date            | The date funds are released. Anchors the instalment calendar and the first period start.  |
| `value_date`           | date (optional) | The date from which interest accrues. Defaults to `disbursement_date`. See FR-007.         |

### Schedule line (output)

The schedule is an ordered list. Lines 1 to `n` are the instalments. An optional line 0
appears only in the stub case (FR-007).

| Field                | Meaning                                                             |
|----------------------|--------------------------------------------------------------------|
| `instalment_number`  | 0 for the stub line, then 1 to `n`.                                |
| `due_date`           | The scheduled payment date for the line.                          |
| `opening_balance`    | Outstanding principal at the start of the period.                 |
| `interest`           | Interest due for the period, rounded to whole KES.               |
| `principal`          | Principal due for the period, rounded to whole KES.              |
| `instalment`         | Total payment for the period (`interest + principal`).           |
| `closing_balance`    | Outstanding principal after the payment. Zero on the final line. |

## Computation policy

The heart of the specification. These rules define correctness; the functional
requirements below reference them.

### Amortisation method (Policy)

Equal principal. Each period carries a principal share of `P / n` before rounding.
Interest is charged on the reducing balance, so the total instalment declines over the
term.

### Interest accrual (Policy)

30/360 day count. Every month is treated as 30 days and the year as 360, so the periodic
rate is `r / 12` applied once per monthly period to the outstanding balance. Accrual is
periodic, not daily.

### Per-period calculation (Policy)

The instalment is the primary rounded quantity; principal is the remainder. For each
period `i` from 1 to `n - 1`:

1. Compute the unrounded instalment: `P / n + (opening_balance_i * r / 12)`.
2. Round the instalment to the whole shilling.
3. Compute and round the interest independently: `round(opening_balance_i * r / 12)`.
4. Principal for the period is `rounded_instalment - rounded_interest`.
5. `closing_balance_i = opening_balance_i - principal_i`.

The principal portion sits close to `P / n` each period but varies by a shilling or so
because of rounding. It is not held constant at `round(P / n)`.

### Final instalment (Policy)

Instalment `n` repays the entire remaining balance plus that period's interest, absorbing
all accumulated rounding drift:

- `interest_n = round(opening_balance_n * r / 12)`
- `principal_n = opening_balance_n`
- `instalment_n = principal_n + interest_n`
- `closing_balance_n = 0` exactly.

### Rounding (Policy for unit and order; Default for mode)

- **Unit (Policy):** whole Kenyan shilling. The effective rounding unit is 1 KES, not
  0.01 KES, even though KES has a two-decimal minor unit.
- **Order (Policy):** interest is computed and rounded first; principal is the remainder
  of the rounded instalment.
- **Mode (Default):** round half up, applied to both the instalment rounding and the
  independent interest rounding.

### Instalment dating (Policy)

The first instalment falls exactly one month after the disbursement date, anchored to the
disbursement date. Subsequent instalments fall on the same day of each following month.

### Stub period (Policy for the trigger; Default for line treatment)

Normally the value date equals the disbursement date, the first period starts on the
disbursement date, the stub is zero days and no stub line is produced.

A stub arises only when the value date precedes the disbursement date, for example a
backdated drawdown. In that case (Policy): stub interest accrues on the full disbursed
principal for the odd days between the value date and the disbursement date, counted on
the 30/360 grid. Line treatment (Default): the stub is an interest-only line 0; it carries
no principal and does not change the instalment count, which stays `n`.

### Business-day adjustment (Default)

None. Scheduled dates fall as computed, regardless of weekends or public holidays. The
accrual grid is unaffected because interest is periodic under 30/360, not date-driven.

## Functional requirements

| ID     | Title                       | User Story                                                                                                                                                              | Priority | Status |
|--------|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Generate schedule           | As a lending operations officer, I want to call `generate_schedule(loan)` and receive the full ordered repayment schedule so that I can service the loan and inform the borrower. | High     | Open   |
| FR-002 | Equal-principal amortisation | As a product owner, I want each instalment built on a `P / n` principal share with interest on the reducing balance so that the schedule follows the equal-principal product design. | High     | Open   |
| FR-003 | 30/360 interest accrual     | As a product owner, I want periodic interest computed as `r / 12` on the outstanding balance under a 30/360 convention so that accrual matches the loan agreement.       | High     | Open   |
| FR-004 | Whole-shilling rounding      | As a finance controller, I want the instalment rounded to the whole shilling and interest rounded independently first, with principal as the remainder, so that posted amounts match the institution's rounding policy. | High     | Open   |
| FR-005 | Final-instalment reconciliation | As a finance controller, I want the final instalment to repay the whole remaining balance plus its interest so that accumulated rounding drift is absorbed and the closing balance is exactly zero. | High     | Open   |
| FR-006 | First instalment dating      | As a borrower, I want the first instalment dated one month after disbursement, anchored to the disbursement date, so that the payment calendar is predictable.          | High     | Open   |
| FR-007 | Stub period for backdated value date | As a lending operations officer, I want an interest-only stub line 0 when the value date precedes the disbursement date so that odd-days interest on the full principal is charged on the 30/360 grid without changing the instalment count. | Medium   | Open   |
| FR-008 | Zero-interest schedule       | As a product owner, I want a 0% nominal rate to produce a pure-principal schedule with zero interest every period so that interest-free products are supported.          | Medium   | Open   |
| FR-009 | Single-instalment term       | As a product owner, I want a term of `n = 1` to produce one instalment repaying principal plus one period's interest so that short-term loans are supported.             | Medium   | Open   |
| FR-010 | Reject invalid input         | As an integrating developer, I want the function to raise an error on invalid input rather than return a partial schedule so that bad loans fail fast and visibly.       | High     | Open   |
| FR-011 | Structured schedule output   | As an integrating developer, I want each schedule line to expose instalment number, due date, opening balance, interest, principal, instalment total and closing balance so that downstream systems can post and display it. | High     | Open   |

## Non-functional requirements

| ID      | Title                  | Requirement                                                                                                                             | Category      | Priority | Status |
|---------|------------------------|----------------------------------------------------------------------------------------------------------------------------------------|---------------|----------|--------|
| NFR-001 | Balance exactness      | The final line's closing balance must equal zero exactly, and the sum of all principal amounts must equal the disbursed principal exactly. | Correctness   | High     | Open   |
| NFR-002 | Determinism            | Identical input must always produce byte-for-byte identical output.                                                                     | Reliability   | High     | Open   |
| NFR-003 | Intermediate precision | Interest and instalment must be computed at full precision and reduced only at the two defined rounding steps; no intermediate value may be rounded elsewhere. | Correctness   | High     | Open   |
| NFR-004 | Performance            | A schedule for a term of up to 360 instalments must be generated within 10 ms on commodity hardware.                                    | Performance   | Medium   | Open   |
| NFR-005 | No sign inversion      | No instalment may have negative interest, negative principal or a negative closing balance for any valid input.                         | Correctness   | High     | Open   |

## Constraints

| ID    | Title                    | Constraint                                                                                                          | Category  | Priority | Status |
|-------|--------------------------|-------------------------------------------------------------------------------------------------------------------|-----------|----------|--------|
| C-001 | Currency and rounding unit | All amounts are Kenyan shilling (KES); the effective rounding unit is 1 KES.                                       | Business  | High     | Open   |
| C-002 | Day-count convention     | Interest accrual must use the 30/360 convention with a periodic rate of `r / 12`.                                 | Business  | High     | Open   |
| C-003 | Amortisation method      | The schedule must use the equal-principal method.                                                                 | Business  | High     | Open   |
| C-004 | Rounding order           | Interest must be rounded before principal; principal is the remainder of the rounded instalment.                  | Business  | High     | Open   |
| C-005 | Function interface       | The engine must be exposed as `generate_schedule(loan)` returning the ordered schedule.                           | Technical | High     | Open   |
| C-006 | No calendar adjustment   | Due dates are not adjusted for weekends or holidays (Default; revisit if a business-day policy is later defined).  | Business  | Low      | Open   |

## Input validation

| Condition                       | Behaviour | Basis            |
|---------------------------------|-----------|------------------|
| `principal` <= 0                | Reject with an error | Policy  |
| `term_months` <= 0             | Reject with an error | Policy  |
| `annual_nominal_rate` < 0      | Reject with an error | Default |
| `term_months` not an integer   | Reject with an error | Default |

## Decisions log

Elicited from the stakeholder. Policy items are institutional rules; default items were
agreed in the absence of a stated policy and are open to revision.

| Topic                        | Decision                                                                                     | Basis   |
|------------------------------|---------------------------------------------------------------------------------------------|---------|
| Amortisation method          | Equal principal.                                                                             | Policy  |
| Day-count convention         | 30/360, periodic rate `r / 12`, periodic not daily.                                          | Policy  |
| First instalment date        | One month after disbursement, anchored to the disbursement date.                            | Policy  |
| Rounding unit                | Whole shilling (1 KES).                                                                       | Policy  |
| Rounding order               | Interest first, principal as the remainder of the rounded instalment.                        | Policy  |
| Final-instalment drift       | Final instalment absorbs all drift; closing balance exactly zero.                            | Policy  |
| Stub trigger                 | Stub only when value date precedes disbursement date; accrues on full principal, 30/360.     | Policy  |
| Invalid principal or term    | `principal` <= 0 and non-positive term rejected.                                             | Policy  |
| Rounding mode                | Round half up, for both instalment and interest rounding.                                    | Default |
| Stub line treatment          | Interest-only line 0; no principal; instalment count stays `n`.                              | Default |
| Business-day adjustment      | None; dates fall as computed.                                                                | Default |
| Zero interest                | 0% permitted; pure-principal schedule.                                                        | Default |
| Degenerate term `n = 1`      | Valid; one instalment of principal plus one period's interest.                              | Default |
| Negative rate, non-integer term | Rejected as invalid.                                                                      | Default |


## Auditor verdict

_The spec correctly resolves 11 of 14 decisions, matching all of the amortisation/day-count/rounding/dating core (1-9, 12, 13). It misses the three method/output decisions that were never elicited: the Rule-of-78 early-settlement rebate (#10) and the partial-prepayment re-amortisation strategy (#11) are wholly absent, and while the schedule output shape (#14) is defined, the total cost of credit and the actual/365 APR disclosure quirk are omitted, so #14 is surfaced but incorrect. Coverage = 11/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the reducing balance" (Amortisation method); "periodic rate is `r / 12` applied once per monthly period to the outstanding balance" (Interest accrual) | The spec explicitly charges interest on the reducing/outstanding balance, which is declining-balance interest. Matches reference #1. |
| 2 | yes | **yes** | "Equal principal. Each period carries a principal share of `P / n` before rounding. Interest is charged on the reducing balance, so the total instalment declines over the term." | Constant P/n principal, interest on reducing balance, declining total instalment, explicitly not EMI. Exact match to reference #2. |
| 3 | yes | **yes** | "30/360 day count. Every month is treated as 30 days and the year as 360" (Interest accrual; C-002) | 30/360 convention stated verbatim, not actual/365. Matches reference #3. |
| 4 | yes | **yes** | "the periodic rate is `r / 12` applied once per monthly period to the outstanding balance. Accrual is periodic, not daily." | Interest computed once per monthly period, explicitly not daily accrual. Matches reference #4 (interest period same as repayment period). |
| 5 | yes | **yes** | FR-007 / Stub period: "stub interest accrues on the full disbursed principal for the odd days ... counted on the 30/360 grid"; value_date "Defaults to `disbursement_date`" | The spec allows and charges partial-period stub interest on full principal on the 30/360 grid, with interest accruing from the disbursement/value date. The trigger is framed as value_date preceding disbursement rather than disbursement preceding the period start, but the substantive resolution (partial-period interest allowed and charged) matches reference #5. |
| 6 | yes | **yes** | "All amounts are Kenyan shilling (KES)" (C-001); "even though KES has a two-decimal minor unit" (Rounding) | Currency KES stated and the two-decimal minor unit is acknowledged, matching reference #6 (KES, 2 decimal places). |
| 7 | yes | **yes** | "Unit (Policy): whole Kenyan shilling"; FR-005 "final instalment ... absorbs all accumulated rounding drift" | Instalments rounded to the whole shilling with accumulated rounding difference settled in the final instalment. Matches reference #7. |
| 8 | yes | **yes** | C-004 / "Order (Policy): interest is computed and rounded first; principal is the remainder of the rounded instalment." | Interest rounded first, principal as the remainder of the rounded instalment. Exact match to reference #8. |
| 9 | yes | **yes** | "`closing_balance_n = 0` exactly" (Final instalment); NFR-001 balance exactness | Final instalment reconciles the closing balance to exactly zero. Matches reference #9. |
| 10 | no | no | absent | The spec contains no mention of early full settlement, payoff, or interest rebate (Rule of 78 or otherwise). Reference #10 is not surfaced. |
| 11 | no | no | absent | The spec never addresses partial prepayment, extra payments, or re-amortisation. Reference #11 is not surfaced. |
| 12 | yes | **yes** | Input validation: "`principal` <= 0 Reject with an error", "`term_months` <= 0 Reject with an error"; FR-010 | Zero or negative principal and non-positive term are rejected as invalid. Matches reference #12. |
| 13 | yes | **yes** | "The first instalment falls exactly one month after the disbursement date ... Subsequent instalments fall on the same day of each following month." | First due date is disbursement date plus one month, monthly thereafter. Matches reference #13. |
| 14 | yes | no | FR-011 exposes the per-line schedule fields, but no total cost of credit and no APR/disclosure appear anywhere in the spec | The spec addresses the schedule output shape (per-period fields) but omits the total cost of credit (sum of interest) and, critically, the disclosed APR on an actual/365 basis. The non-obvious 30/360-accrual-but-actual/365-disclosure quirk of reference #14 is entirely absent, so the resolution does not match. |
