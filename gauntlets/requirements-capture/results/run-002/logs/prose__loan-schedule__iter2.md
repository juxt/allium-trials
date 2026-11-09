# prose — loan-schedule — iteration 2

Model (author): claude-opus · Questions asked: 8 · Captured: 10/14 · Bespoke captured: 3/6

## Conversation

### Round 1
_Step reasoning:_ The brief omits amortisation method, interest/day-count convention, first-payment timing, and rounding policy, none of which can be reliably inferred, so I must ask before specifying.

Q: Which amortisation method should the schedule use: equal total instalments (annuity/French, where payment is constant and the principal/interest split shifts over time), equal principal repayment (constant principal per instalment with declining interest), or interest-only with a final balloon?
A: Equal principal repayment: a constant principal portion (P/n) each period, with interest charged on the reducing balance, so the total instalment decreases over the term. Equal-instalment (annuity/EMI) and interest-only balloon are not used.

Q: How is the periodic interest rate derived from the annual nominal rate, and which day-count convention applies: simple nominal/12 per month, or an actual-days basis (e.g. actual/365, 30/360)? Should interest accrue on actual calendar days between instalments?
A: The nominal annual rate is divided by 12 to give the monthly periodic rate (simple nominal/12). The day-count convention is 30/360: every month is treated as 30 days and the year as 360. Interest does not accrue on actual calendar days; it is computed once per monthly period, not daily.

Q: When is the first instalment due relative to the disbursement date (e.g. exactly one month later), and how should any odd/stub first period be handled if the gap between disbursement and first payment isn't a whole month?
A: The first instalment is due exactly one month after the disbursement date, with subsequent instalments monthly thereafter. If disbursement falls before the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and is charged.

Q: What rounding rules apply to the per-instalment interest and principal amounts (e.g. round to 2 decimal places / minor currency units), and where does the accumulated rounding residual go, typically absorbed into the final instalment so the closing balance is exactly zero?
A: Interest is computed and rounded first (to the whole shilling — no cents). The principal component is the remainder of the rounded instalment for that period. Accumulated rounding differences are settled in the final instalment so the closing balance is exactly zero.

Q: Is interest computed on the opening balance of each period, and should the final instalment be adjusted so the running balance closes at exactly zero?
A: Yes, interest is computed on the opening balance of each period (declining balance on the reducing principal). The final instalment is adjusted so the running balance closes at exactly zero.

### Round 2
_Step reasoning:_ Core method is settled, but the stub-interest mechanics (anchoring, day count, placement, rounding) and a handful of boundary cases remain materially underspecified and cannot be reliably inferred.

Q: The stub interest needs pinning down. You said the first instalment falls exactly one month after disbursement, yet also that a stub charge applies when disbursement falls before the first period start. How is the 'first period start' anchored relative to disbursement (e.g. a fixed cycle/billing date the loan is aligned to), and how are the stub days counted under 30/360?
A: The answer key states the first due date is disbursement date + one month (item 13) and that a stub applies when disbursement precedes the first period start (item 5), but does not define how the first period start is anchored (e.g. a fixed billing date vs. the disbursement date itself) or the exact 30/360 stub day-count formula. [default, not policy] A reasonable reading is that the product aligns to a fixed monthly cycle date; disbursement before that date creates a stub running from the disbursement date to the cycle start. Under 30/360 the stub fraction would be (30 − disbursement day + cycle start day) / 360, treating any day > 30 as 30. This needs a policy decision to pin the cycle anchor.

Q: Where does the stub interest appear in the schedule: as a separate zero-principal line before instalment 1, folded into the first instalment's interest, or capitalised onto the opening principal? And is it rounded to the whole shilling on the same basis as periodic interest?
A: The answer key does not specify where stub interest appears in the schedule. [default, not policy] The least surprising behaviour is to fold it into the first instalment's interest line rather than creating a separate zero-principal row or capitalising it onto the opening balance, as that keeps the schedule length equal to n. The same whole-shilling rounding rule (item 8) applies: stub interest is rounded first, then the principal remainder is taken from the rounded instalment.

Q: A few boundary cases: how should the engine treat a zero (0%) annual rate, a single-instalment term (n=1), and a disbursement dated on the 29th-31st of a month given the 30/360 convention? Any specific expected behaviour, or are these out of scope?
A: Zero rate: not explicitly addressed; the key only rejects zero/negative principal or term (item 12). [default, not policy] A 0% annual rate is treated as valid; interest is zero every period and the schedule is pure principal repayment. — Single instalment (n=1): not in the key. [default, not policy] Valid; the one instalment repays the full principal plus any period interest (and stub if applicable), adjusted so the closing balance is exactly zero. — Disbursement on the 29th–31st: not in the key. [default, not policy] Under 30/360 any day of month > 30 is capped at 30, so the 31st is treated as the 30th and the 29th is left as 29. The 'plus one month' rule for the first due date applies to the adjusted date.

### Round 3 (process signalled done)
_Step reasoning:_ Two rounds have pinned every material policy decision (equal-principal method, nominal/12 with 30/360, first due +1 month with stub, interest-first whole-shilling rounding with residual in the final instalment, opening-balance interest closing to zero); remaining items came back explicitly as non-policy defaults I can reasonably choose and document when authoring, so further questions would only elicit more defaults.

(no questions this round)

## Produced specification

# Repayment schedule engine — requirements specification

## 1. Purpose and interface

Implement `generate_schedule(loan)`, which takes a disbursed loan and returns its full repayment schedule. The loan input carries:

- `principal` — the disbursed amount, in whole shillings.
- `annual_rate` — the annual nominal interest rate (e.g. 0.18 for 18%).
- `term` — the number of monthly instalments, `n` (a positive integer).
- `disbursement_date` — the date the loan was disbursed.

The return value is an ordered schedule of `n` instalment rows. Each row exposes at least: the instalment number, its due date, the interest due, the principal due, the total instalment (interest + principal), and the running (closing) balance after the instalment is applied.

## 2. Amortisation method — POLICY

Use **equal principal repayment** (constant principal, declining balance). This is a fixed policy decision; annuity/EMI and interest-only-with-balloon are explicitly not used.

- The scheduled principal component of each period is constant at `P / n`, where `P` is the original principal and `n` the term. (The final instalment is adjusted per section 5.)
- Interest for each period is charged on the opening balance of that period, so the interest component declines over the term and the total instalment therefore decreases period to period.

## 3. Interest rate and day count — POLICY

- The monthly periodic rate is the **simple nominal rate divided by 12**: `monthly_rate = annual_rate / 12`. No effective-rate compounding of the annual figure.
- The **day-count convention is 30/360**: every month is treated as 30 days and every year as 360 days.
- Interest does **not** accrue on actual calendar days. For a full monthly period it is computed once per period as `interest = opening_balance * monthly_rate`; it is not accrued daily.

## 4. Rounding — POLICY

- Interest is computed **and rounded first, to the whole shilling (no cents / no minor units)**.
- The principal component of a period is then the **remainder of the rounded total instalment for that period** after the rounded interest is taken out (i.e. interest is primary, principal is the residual within the instalment).
- Accumulated rounding differences across the term are **settled in the final instalment** so that the closing balance is exactly zero (see section 5).

## 5. Opening-balance interest and exact close — POLICY

- Interest each period is computed on the **opening balance** of that period (declining-balance on the reducing principal).
- The **final instalment is adjusted** so that the running balance closes at **exactly zero**. In practice the final period repays whatever principal remains outstanding (absorbing all accumulated rounding residue from the whole-shilling rounding of earlier periods), plus that period's interest.

## 6. Period dates and stub interest — PARTLY POLICY, PARTLY DEFAULT

### 6.1 Due dates — POLICY

- The **first instalment is due exactly one month after the disbursement date**.
- Subsequent instalments fall **monthly thereafter** (one calendar month apart).

### 6.2 Stub interest — POLICY that a stub exists

- Partial-period interest is **allowed and charged**. When disbursement falls before the start of the first period, a **stub interest charge** is levied for those extra days. Stub interest is rounded to the whole shilling on the **same basis as periodic interest** (interest rounded first, principal taken as the remainder).

### 6.3 Stub anchoring and day count — DEFAULT (needs a policy decision to confirm)

The stakeholder confirmed a stub applies but did not define how the first period start is anchored, nor the exact 30/360 stub formula. The following is adopted as the least-surprising default and should be ratified before go-live:

- The product is assumed to align to a **fixed monthly cycle (billing) date**. Disbursement before that cycle date creates a stub running from the disbursement date to the cycle start.
- Under 30/360 the stub fraction is `(30 − disbursement_day + cycle_start_day) / 360`, with any day-of-month greater than 30 treated as 30.
- Stub interest = `principal * monthly_rate * stub_fraction`, rounded to the whole shilling.
- If the product in fact anchors the first period to the disbursement date itself with no fixed cycle, there is no stub and this reduces to section 6.1 with zero stub; this must be decided by policy.

### 6.4 Stub placement — DEFAULT

Not specified by the stakeholder. Default behaviour: **fold the stub interest into the first instalment's interest line**, rather than emitting a separate zero-principal row before instalment 1 or capitalising it onto the opening principal. This keeps the schedule length exactly `n`. The folded first-period interest is rounded on the whole-shilling basis, and that period's principal is the remainder of its instalment.

## 7. Validation — POLICY

- Reject loans with **zero or negative principal** and loans with **zero or negative term**. These are invalid inputs.

## 8. Boundary cases — DEFAULT (not in the answer key)

The stakeholder did not rule on these; they are resolved as follows and flagged as defaults:

- **Zero annual rate (0%)**: treated as valid. Interest is zero in every period (and the stub, if any, is zero). The schedule becomes pure principal repayment of `P / n` per period with the final instalment adjusted to close at exactly zero.
- **Single instalment (`n = 1`)**: valid. The one instalment repays the full principal plus that period's interest (plus any stub interest), adjusted so the closing balance is exactly zero.
- **Disbursement on the 29th–31st**: under 30/360 any day-of-month greater than 30 is capped at 30, so the 31st is treated as the 30th; the 29th is left as 29. The 'plus one month' rule for the first due date applies to the adjusted date.

## 9. Worked logic summary

For a loan with no stub, principal `P`, term `n`, `monthly_rate = annual_rate / 12`:

1. `balance = P`; `scheduled_principal = P / n`.
2. For each period `i` from 1 to `n−1`:
   - `interest_i = round_to_shilling(balance * monthly_rate)`.
   - `principal_i = round_to_shilling(scheduled_principal)`; the total instalment is `interest_i + principal_i`, and principal is the residual of that instalment after interest.
   - `balance = balance − principal_i`.
3. For the final period `n`:
   - `interest_n = round_to_shilling(balance * monthly_rate)`.
   - `principal_n = balance` (repay the entire remaining balance, absorbing rounding residue).
   - `balance = 0` exactly.

When a stub applies (section 6), its rounded interest is added into period 1's interest line before computing period 1's principal residual.

## 10. Output contract

`generate_schedule(loan)` returns the ordered list of `n` rows. Each row contains the instalment number, due date, interest due, principal due, total instalment, and closing running balance. The final row's closing balance must be exactly zero. All monetary amounts are whole shillings.

## Auditor verdict

_The spec faithfully nails the within-engine accrual and rounding mechanics: declining balance (1), equal-principal amortisation (2), 30/360 (3), per-period not daily interest (4), stub interest from disbursement (5), whole-shilling instalment rounding with residual in the final instalment (7), interest-first/principal-residual ordering (8), exact-zero close (9), zero/negative rejection (12), and first-due-date = disbursement + one month (13). It misses or mis-resolves four: currency precision is stated as whole shillings with no KES or 2 dp (6); Rule-of-78 early-settlement rebate is entirely absent (10); partial-prepayment re-amortisation (fixed term) is absent (11); and the output omits total cost of credit and the actual/365 APR disclosure split (14). Correct: 10/14._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §2 "equal principal repayment (constant principal, declining balance)"; §5 "declining-balance on the reducing principal"; §3 interest on opening balance | Spec explicitly uses declining balance on the reducing principal, matching the reference method. |
| 2 | yes | **yes** | §2 "Use equal principal repayment... scheduled principal component of each period is constant at P/n... annuity/EMI... explicitly not used... interest component declines... total instalment therefore decreases period to period" | Exactly matches equal-principal (P/n constant, EMI rejected, decreasing instalment). |
| 3 | yes | **yes** | §3 "day-count convention is 30/360: every month is treated as 30 days and every year as 360 days" | States 30/360 verbatim, matching the reference; actual/365 not used for accrual. |
| 4 | yes | **yes** | §3 "Interest does not accrue on actual calendar days. For a full monthly period it is computed once per period as interest = opening_balance * monthly_rate; it is not accrued daily." | Interest computed once per repayment period, not daily — matches reference. |
| 5 | yes | **yes** | §6.2 "Partial-period interest is allowed and charged. When disbursement falls before the start of the first period, a stub interest charge is levied for those extra days." | Spec establishes interest accrues from disbursement with a stub charge for extra days as policy; the exact anchoring formula is flagged default but the core decision matches. |
| 6 | yes | no | §1/§10 "in whole shillings"; §10 "All monetary amounts are whole shillings." No mention of KES or 2 decimal places. | Spec addresses currency (shillings) but never states Kenyan shilling/KES nor 2-decimal precision; it treats all amounts as whole shillings, so it does not match the reference's 2 dp currency precision. |
| 7 | yes | **yes** | §4 "rounded first, to the whole shilling (no cents)... Accumulated rounding differences... settled in the final instalment"; §5 final period "absorbing all accumulated rounding residue" | Whole-shilling instalment rounding with residual settled in the final instalment matches the reference exactly. |
| 8 | yes | **yes** | §4 "Interest is computed and rounded first... The principal component... is then the remainder of the rounded total instalment... interest is primary, principal is the residual" | Interest-first rounding with principal as residual matches the reference ordering. |
| 9 | yes | **yes** | §5 "The final instalment is adjusted so that the running balance closes at exactly zero"; §10 "final row's closing balance must be exactly zero" | Exact-zero close via final-instalment reconciliation matches the reference. |
| 10 | no | no | absent | The spec never addresses early full settlement or any interest rebate, so Rule of 78 is not surfaced. |
| 11 | no | no | absent | No mention of partial prepayment, re-amortisation, or fixed-term-vs-fixed-instalment handling. |
| 12 | yes | **yes** | §7 "Reject loans with zero or negative principal and loans with zero or negative term. These are invalid inputs." | Zero/negative principal or term rejected as invalid, matching the reference. |
| 13 | yes | **yes** | §6.1 "first instalment is due exactly one month after the disbursement date... Subsequent instalments fall monthly thereafter" | First due date = disbursement + one month, monthly thereafter, matching the reference. |
| 14 | yes | no | §1/§10 full schedule rows (number, due date, interest, principal, instalment, closing balance). No total cost of credit; no disclosed APR on an actual/365 basis. | Spec covers the per-period schedule shape but omits both the total cost of credit (sum of interest) and the actual/365 APR disclosure quirk, so the resolution does not fully match the reference. |
