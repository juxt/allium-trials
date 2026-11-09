# superpowers — loan-schedule — iteration 3

Model (author): claude-opus · Questions asked: 6 · Captured: 8/14 · Bespoke captured: 2/6

## Conversation

### Round 1
_Step reasoning:_ Classified as architectural; following brainstorming's one-question-at-a-time discipline, I start with the amortisation method because it determines the shape of every other decision.

Q: This is architectural work (a new repayment-schedule engine), so before I sketch any design I need to pin down the core policy decisions one at a time. First and most fundamental: which amortisation method should `generate_schedule` use — equal total instalments (annuity/EMI style, where interest and principal shares shift over the term), equal principal per instalment (so the total payment declines each month), or interest-only with a principal balloon at the end?
A: Equal principal: a constant principal portion each period (P/n), with interest on the reducing balance, so the total instalment decreases over the term. Not equal instalments (EMI/annuity style), and not interest-only with a balloon.

### Round 2
_Step reasoning:_ Amortisation method is fixed; the next load-bearing policy is how periodic interest accrues (rate basis, day-count, and first-period handling), which cannot be reliably inferred.

Q: Now the interest basis: how should each period's interest be computed from the annual nominal rate on the reducing balance? Specifically (a) is the monthly rate simply the annual nominal rate divided by 12 applied to the outstanding balance, or should interest accrue on actual days elapsed between instalment dates using a day-count convention (e.g. Actual/365, Actual/360, 30/360)? and (b) does the first instalment cover a standard full month, or is there a stub/odd first period measured from the disbursement date to the first instalment date?
A: (a) 30/360 day-count: every month counts as 30 days, the year as 360. The monthly rate is therefore the annual nominal rate divided by 12, applied once per period to the opening balance. Interest does not accrue daily.

### Round 3
_Step reasoning:_ Amortisation method and interest basis are settled; rounding precision and residue reconciliation is the next material policy decision a model cannot safely infer, as it determines whether the balance closes to zero.

Q: On rounding: to what precision are the per-instalment interest and principal amounts rounded (e.g. to the minor currency unit / 2 decimal places), and how is the cumulative rounding residue handled so the schedule fully amortises — specifically, is the constant principal portion P/n rounded each period with the final instalment's principal adjusted to clear any remaining balance exactly, or is some other reconciliation used?
A: Each instalment is rounded to the whole shilling (zero decimal places; no cents). Within each period, interest is computed and rounded first; principal is then the remainder of that rounded instalment, not independently rounded. The accumulated rounding difference is not spread across periods — it is settled entirely in the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 4
_Step reasoning:_ Round 2(b) on first-period/dating was never actually answered and the even-division handling of P/n is still implicit; both are non-inferable policy choices needed before the schedule can be specified.

Q: Round 2 part (b) was left unanswered, so I need to pin down the instalment timing and dates. With 30/360 and one interest charge per period on the opening balance, the stub/odd-first-period question effectively falls away, but I still need the dating convention: (a) does the schedule carry an explicit date for each instalment, and if so does the first instalment fall exactly one calendar month after the disbursement date, or on a fixed day-of-month (e.g. always the 1st) with the gap from disbursement to the first instalment treated as a standard full period regardless of actual days? and (b) if principal P does not divide evenly into n, is the constant principal portion taken as P/n rounded to the whole shilling each period (with the final instalment absorbing the residue, as already established), or truncated/floored before the final-period reconciliation?
A: (a) The schedule carries an explicit due date for each instalment. The first instalment falls exactly one calendar month after the disbursement date; subsequent instalments are monthly thereafter. If the disbursement date precedes the first period start, a stub interest charge is levied for those extra days — partial-period interest is allowed and charged. (b) The constant principal portion P/n is rounded to the whole shilling each period; the accumulated rounding residue is absorbed entirely by the final instalment, which is adjusted so the closing balance is exactly zero.

### Round 5
_Step reasoning:_ Round 4's stub-interest answer conflicts with the 30/360 basis and references an undefined 'first period start' date, and month-end date rolls remain unresolved; both are material policy choices that cannot be inferred.

Q: Your Round 4 answer introduced a stub interest charge 'if the disbursement date precedes the first period start... for those extra days,' which I need to reconcile with the 30/360 basis and the 'first instalment exactly one calendar month after disbursement' rule. (a) Is there a fixed 'first period start' date distinct from the disbursement date (e.g. loans always begin accruing on a set day of the month, or the 1st), such that a disbursement before that date creates the stub? If so, what defines that date? (b) How is the stub interest computed under 30/360 — is it counted in actual calendar days from disbursement to the first period start, or in 30/360 days, and at what rate (annual/360 per day, annual/12 pro-rated, or otherwise)? (c) Does the stub appear as its own schedule row/charge, or is it folded into the interest component of the first regular instalment?
A: (a) The answer key does not define a fixed 'first period start' date distinct from the disbursement date. Under the stated rule — first instalment exactly one calendar month after disbursement — the period start and disbursement date coincide in the standard case, so no stub arises. The stub language in the prior answer appears to cover an edge case not further specified in policy; treat the standard case as stub-free. [default, not policy for the edge case: if a fixed cycle-start date were ever introduced, the stub days would be actual calendar days from disbursement to that date, interest charged at annual rate / 360 per day under 30/360, and folded into the first instalment's interest component rather than shown as a separate row.]

Q: For the instalment due dates: when 'exactly one calendar month after' a given day does not exist in the target month (e.g. disbursement on the 31st, or 30th/31st rolling into February), what roll convention applies — last day of the month, or some fixed day-of-month?
A: Not in the answer key. [default, not policy]: apply a last-day-of-month roll — if the target month is shorter than the source day, the due date becomes the last calendar day of that month, and subsequent dates are derived from that rolled date.

### Round 6 (process signalled done)
_Step reasoning:_ All material policy decisions are pinned down (equal-principal amortisation, 30/360 interest on opening balance, whole-shilling rounding with interest-first and final-instalment reconciliation, explicit monthly due dates one month after disbursement, stub-free standard case, last-day-of-month roll default); the last two items returned defaults with no further policy, so continuing to ask would yield nothing new.

(no questions this round)

## Produced specification

# Repayment schedule engine — design specification

## Purpose and scope

This specifies the repayment schedule engine for a monthly-instalment loan product. Given a disbursed loan, the engine produces the complete repayment schedule: for every instalment it states the interest due, the principal due, the total instalment, the due date, and the running balance, with the loan fully amortised to a closing balance of exactly zero.

The single public entry point is `generate_schedule(loan)`, which accepts a disbursed loan and returns the ordered schedule. A loan is described by four inputs: the principal, the annual nominal interest rate, the term expressed as a whole number of monthly instalments, and the disbursement date.

Every material policy below was settled with the stakeholder. Where a detail was neither asked nor answered, it is resolved by the authoring process and labelled explicitly as a process default rather than confirmed policy, so a reader can tell the two apart.

## Amortisation method (confirmed policy)

The engine uses the equal-principal method. A constant principal portion of P/n is repaid each period, where P is the principal and n is the term in instalments. Interest is charged on the reducing (opening) balance each period. Because the balance falls while the principal portion stays constant, the total instalment declines over the term.

This is explicitly not the equal-instalment (annuity/EMI) method, where the total payment is level and the principal and interest shares shift over the term, and it is explicitly not interest-only with a principal balloon at maturity.

## Interest basis (confirmed policy)

Interest uses the 30/360 day-count convention. Every month counts as 30 days and every year as 360 days. The periodic (monthly) rate is therefore the annual nominal rate divided by 12, applied once per period to the opening balance of that period. Interest does not accrue on actual days elapsed and is not computed daily. There is exactly one interest charge per period.

Because 30/360 fixes each period at a notional 30 days and the first instalment falls exactly one calendar month after disbursement (see Dating), the question of a stub or odd first period does not arise in the standard case.

## Rounding and reconciliation (confirmed policy)

The currency is the shilling. Every amount is rounded to the whole shilling: zero decimal places, no cents or sub-unit.

Within each period the order of operations is fixed. Interest is computed on the opening balance and rounded to the whole shilling first. The principal portion is the constant P/n, itself rounded to the whole shilling each period. The total instalment is the sum of the rounded interest and the principal portion, and is therefore a whole-shilling amount; the principal is not independently re-rounded against the instalment after the interest is set.

The accumulated rounding residue is not spread across periods. It is settled entirely in the final instalment. The final instalment's principal is set to whatever remains so that the closing balance is exactly zero, and the final total instalment is that adjusted principal plus the final period's rounded interest. This guarantees that the sum of all principal portions equals P exactly and the loan fully amortises.

Concretely, for the regular periods 1 through n-1 the principal portion is round(P/n) to the whole shilling; for the final period n the principal portion is the entire remaining opening balance. Interest in every period, including the last, is round(monthly_rate x opening_balance) to the whole shilling.

Process default (not stakeholder policy): where a value falls exactly halfway between two whole shillings, round half away from zero. The stakeholder did not specify a tie-break; with whole-shilling rounding and the final-instalment reconciliation, the choice affects only intermediate rows and never the final closing balance.

## Dating (confirmed policy, with one process default for an unspecified roll case)

The schedule carries an explicit due date for each instalment. The first instalment falls exactly one calendar month after the disbursement date. Each subsequent instalment falls one calendar month after the previous one, giving n monthly due dates.

Process default (not stakeholder policy): when "exactly one calendar month after" a given day does not exist in the target month (for example a disbursement on the 31st, or the 30th or 31st rolling into February), apply a last-day-of-month roll. The due date becomes the last calendar day of the target month, and subsequent due dates are derived from that rolled date. The stakeholder confirmed this is not in the answer key and is adopted as the process default.

## Stub / odd first period (confirmed policy: none in the standard case)

There is no fixed cycle-start date distinct from the disbursement date. Under the rule that the first instalment falls exactly one calendar month after disbursement, the first period's start coincides with the disbursement date, so no stub period arises. The standard case is stub-free, and the engine does not compute any stub interest.

Process default (not stakeholder policy), recorded for future reference only and not implemented: if a fixed cycle-start date were ever introduced such that disbursement could precede the first period start, the stub would be counted in actual calendar days from the disbursement date to the cycle-start date, interest would be charged at the annual rate divided by 360 per day, and the stub interest would be folded into the first instalment's interest component rather than shown as a separate schedule row. This behaviour is out of scope for the current engine because no such cycle-start date exists in policy.

## Algorithm

Let P be the principal, r the annual nominal rate, n the term in instalments, and d the disbursement date. Let i = r / 12 be the periodic rate, and Q = round(P / n) the constant principal portion.

Initialise the opening balance of period 1 to P. For each period k from 1 to n:

1. Opening balance B_k is the closing balance of the previous period (B_1 = P).
2. Interest_k = round(i x B_k) to the whole shilling.
3. Principal_k = Q for k < n; Principal_n = B_n (the full remaining balance) for the final period.
4. Instalment_k = Interest_k + Principal_k.
5. Closing balance B_{k+1} = B_k - Principal_k.
6. Due date_k = the disbursement date advanced by k calendar months, applying the last-day-of-month roll default where the target day does not exist.

After period n the closing balance is exactly zero by construction, and the sum of the principal portions equals P.

## Output structure

`generate_schedule(loan)` returns the schedule as an ordered collection of instalment rows, one per period, in due-date order. Each row carries: the instalment number (1..n), the due date, the opening balance, the interest due, the principal due, the total instalment, and the closing (running) balance. The caller can read the running balance directly from each row's closing balance.

## Error handling and input validation (process defaults)

The following are not covered by stakeholder policy and are resolved by process. The engine validates its inputs before computing and rejects invalid loans rather than returning a partial schedule:

- Principal P must be a positive whole-shilling amount.
- Term n must be an integer of at least 1.
- Annual nominal rate r must be greater than or equal to zero; a zero rate yields zero interest in every period and a schedule that repays principal only.
- The disbursement date must be a valid calendar date.

Invalid inputs raise a clear validation error naming the offending field. A zero interest rate is valid and handled by the same algorithm.

## Testing

The test suite should cover, at minimum:

- A loan where P divides evenly by n and the rate is non-trivial, checking that the principal portion is constant, interest declines each period, the total instalment declines, and the closing balance reaches exactly zero.
- A loan where P does not divide evenly by n, checking that regular periods carry round(P/n) principal, the rounding residue lands entirely in the final instalment, the principal portions sum to P, and the closing balance is exactly zero.
- Interest rounding: periods where i x opening balance is non-integer, confirming interest is rounded to the whole shilling before the instalment is formed.
- A zero-rate loan, confirming every interest charge is zero and principal repays evenly with the final-period reconciliation.
- Dating: the first due date is exactly one calendar month after disbursement and subsequent dates are monthly; a disbursement on the 31st and a disbursement near month end rolling into February exercise the last-day-of-month roll default.
- Single-instalment loans (n = 1), confirming the one instalment clears the whole balance to zero.
- Input validation rejects non-positive principal, n below 1, negative rate, and an invalid disbursement date.

The two decisive correctness invariants for every valid loan are that the sum of principal portions equals P and that the final closing balance is exactly zero.

## Auditor verdict

_The spec faithfully captures the core accrual mechanics and schedule-closing conventions: interest method (1), equal-principal amortisation (2), 30/360 (3), per-period interest (4), whole-shilling instalment rounding with final-instalment residue (7), exact-zero closing (9), input rejection (12), and first due date (13) — 8 of 14 correct. It misses or contradicts the bespoke edges: it denies stub/partial-period interest (5), sets zero decimals against the 2dp currency precision (6), rounds principal independently rather than as the instalment remainder (8), and omits total cost of credit plus the actual/365 APR disclosure (14). Early-settlement Rule-of-78 rebate (10) and partial-prepayment re-amortisation (11) are entirely absent. Coverage = 8/14; the gap concentrates on the off-default, non-inferable method and disclosure decisions._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | "Interest is charged on the reducing (opening) balance each period." (Amortisation method / Interest basis) | The spec applies the periodic rate to the reducing opening balance, i.e. declining balance on the reducing principal, matching the reference. |
| 2 | yes | **yes** | "The engine uses the equal-principal method. A constant principal portion of P/n is repaid each period... the total instalment declines over the term"; "explicitly not the equal-instalment (annuity/EMI) method". | Constant P/n principal, interest on reducing balance, declining total instalment, explicitly excluding EMI — exact match to the reference. |
| 3 | yes | **yes** | "Interest uses the 30/360 day-count convention. Every month counts as 30 days and every year as 360 days." | 30/360 stated verbatim, matching the off-default reference answer. |
| 4 | yes | **yes** | "applied once per period to the opening balance of that period... Interest does not accrue on actual days elapsed and is not computed daily. There is exactly one interest charge per period." | Interest computed once per repayment period rather than daily accrual, matching the reference. |
| 5 | yes | no | "The standard case is stub-free, and the engine does not compute any stub interest." Hypothetical stub handling is "out of scope for the current engine". | The reference requires interest to accrue from the disbursement date with a stub interest charge levied for pre-period days (partial-period interest allowed and charged). The spec denies any stub exists and explicitly does not charge stub interest, contradicting the reference. |
| 6 | yes | no | "The currency is the shilling. Every amount is rounded to the whole shilling: zero decimal places, no cents or sub-unit." | Reference sets currency precision at 2 decimal places (KES). The spec states zero decimal places for every amount, directly contradicting the 2dp currency precision; it also does not name KES explicitly. |
| 7 | yes | **yes** | "Every amount is rounded to the whole shilling... The accumulated rounding residue is not spread across periods. It is settled entirely in the final instalment." | Whole-shilling instalment rounding with the accumulated residue settled in the final instalment matches the reference exactly. |
| 8 | yes | no | "Interest is computed on the opening balance and rounded to the whole shilling first. The principal portion is the constant P/n, itself rounded to the whole shilling each period... the principal is not independently re-rounded against the instalment after the interest is set." | The reference requires principal to be the remainder of the rounded instalment (interest first, principal absorbs the residual within the period). The spec rounds interest first but then rounds principal independently as round(P/n) rather than deriving it as the instalment remainder, so the within-period rounding treatment differs. |
| 9 | yes | **yes** | "the final instalment reconciles so the closing balance is exactly zero"; "the loan fully amortised to a closing balance of exactly zero". | Final instalment reconciles to an exactly-zero closing balance, matching the reference. |
| 10 | no | no | absent | The spec covers only schedule generation and never mentions early full settlement or an unearned-interest rebate, so the Rule of 78 policy is not addressed. |
| 11 | no | no | absent | No mention of partial prepayment, principal application, or re-amortisation strategy anywhere in the spec. |
| 12 | yes | **yes** | "Principal P must be a positive whole-shilling amount. Term n must be an integer of at least 1... Invalid inputs raise a clear validation error naming the offending field." | Zero/negative principal and zero/sub-1 term are rejected as invalid with an error, matching the reference. |
| 13 | yes | **yes** | "The first instalment falls exactly one calendar month after the disbursement date. Each subsequent instalment falls one calendar month after the previous one." | First due date = disbursement + one month, monthly thereafter, matching the reference. |
| 14 | yes | no | "Each row carries: the instalment number (1..n), the due date, the opening balance, the interest due, the principal due, the total instalment, and the closing (running) balance." No total cost of credit or APR disclosure. | The per-period schedule shape matches, but the spec omits the total cost of credit (sum of interest) and the disclosed APR on an actual/365 basis — the non-obvious disclosure quirk — so the full decision is not matched. |
