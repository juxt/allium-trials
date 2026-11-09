# bmad — savings-interest — iteration 3

Model (author): claude-opus · Questions asked: 15 · Captured: 8/14 · Bespoke captured: 7/10

## Conversation

### Round 1
_Step reasoning:_ (live agent turn)

Q: It looks like the structured question prompt didn't go through. Let me just ask in plain text — answer in whatever form is easiest, and feel free to say "use the standard" on any where you'd rather I apply a documented default.

These are the policy choices that determine the arithmetic. **Batch 1 — the core computation:**

1. **Day-count convention** (how the annual rate becomes a daily rate): Actual/365-fixed, Actual/360, Actual/Actual (leap-year aware), or 30/360?

2. **Compounding within a period**: simple (Σ of daily balance × daily rate) or daily-compounding (each day's accrued interest joins the base for the next day)?

3. **Balance basis** — which figure from the daily history accrues each day: end-of-day (closing) balance, start-of-day (opening) balance, or the minimum daily balance across the period?

4. **Rate representation**: is the annual rate a decimal nominal (0.035), a percentage nominal (3.5), or an effective annual yield/APY that must be converted first?

**Batch 2 — precision and edges** (you can answer these now too, or after batch 1):

5. **Rounding point**: round each day's accrual to the cent and then sum, or accrue at full precision and round once at posting?

6. **Rounding mode & precision** for the posted figure: 2-decimal half-up, 2-decimal banker's (half-to-even), or truncate-down to the cent?

7. **Period boundaries** — which days accrue: both start and end inclusive, half-open `[start, end)`, or inclusive-start/exclusive-end with the posting day not accruing?

8. **Negative / overdrawn daily balances**: floor at zero (no accrual), accrue negative interest on them, or treat a negative balance in a savings account as an error?

Two more I'll flag but can carry as confirmable assumptions rather than block on:

- **Posting mechanics** — I'm assuming `post_interest` adds the computed interest to the period-end balance, returns `(interest_posted, updated_balance)` where `updated_balance = end_balance + interest_posted`, and records the posting dated at period end. Correct?
- **Re-posting / idempotency** — what should happen if interest was already posted for this period (reject, or post again)? Fine to defer this to Open Questions if it's out of scope for v1.

Once I have your answers I'll draft the full spec and tag anything still inferred.
A: Batch 1:

1. **Day-count**: Actual/360. Daily rate = annual_rate / 360.

2. **Compounding**: Daily compounding — each day's accrued interest joins the base for the next day's accrual within the period.

3. **Balance basis**: End-of-day closing balance feeds the daily average. [default, not policy — the key specifies average-daily-balance method but does not state start vs end explicitly; end-of-day is standard for ADB and I'd carry it as a confirmable assumption.]

4. **Rate representation**: Decimal nominal (e.g. 0.035). [default, not policy]

Batch 2:

5. **Rounding point**: Accrue at full precision; round once at posting. [default, not policy]

6. **Rounding mode**: Truncate-down (floor) to 2 decimal places. Never half-up. The bank retains the sub-cent fraction.

7. **Period boundaries**: Half-open [start, end). The posting day is excluded from the period it closes and opens the next period.

8. **Negative balances**: Treat as an error — the account never goes negative.

---

**Posting mechanics**: Mostly correct, but one correction — the account is credited the *net* interest (after 15% withholding tax is deducted), not gross. The return should include gross interest, tax withheld, net interest posted, average daily balance, qualifying-day count, and updated balance. So: `updated_balance = end_balance + net_interest_posted`.

**Re-posting / idempotency**: Out of scope for v1; carry as an open question.

### Round 2
_Step reasoning:_ (live agent turn)

Q: Thank you — that's exactly the kind of detail I couldn't have inferred. Two of your answers introduced material facts that aren't in the brief (the **average-daily-balance method**, **qualifying days**, and **15% withholding tax**), and one of them is in genuine tension with an earlier answer. I'd rather resolve that now than silently pick an interpretation, because the formula hinges on it.

**The tension I need you to settle (most important):**

Your Q2 answer described daily compounding as *"each day's accrued interest joins the base for the next day's accrual"* — that literally describes a **day-by-day running compound on the actual end-of-day balances**. But your Q3 answer says the key specifies the **average-daily-balance (ADB) method** — which *averages the balances first* and then applies a rate. Those are two different computations and can't both be literally true. The coherent reconciliations are:

- **(A) Compound the average:** compute `ADB = Σ(qualifying end-of-day balances) / N`, then `gross = ADB × ((1 + r)^n − 1)`, where `r = annual_rate / 360` and `n` = day count. (ADB method + compounding expressed as the growth factor.)
- **(B) Running daily compound, no averaging:** ignore ADB; walk day by day, adding each day's interest (`balance_today × r`) into the running base. "Average daily balance" in the return is then just a reported statistic, not the accrual basis.
- **(C) Simple interest on the ADB:** `gross = ADB × r × n` — but this drops compounding, so only if Q2 is superseded.

Which one is the institution's actual method?

**Then, the newly-surfaced policy points:**

9. **Qualifying day** — what makes a day "qualify"? Is there a **minimum-balance threshold** a day must meet to earn interest (and if so, what)? Or does "qualifying" just mean the account was open with a non-negative balance?

10. **The denominator `N` and the compounding exponent `n`** — are these the **total days** in the half-open period `[start, end)`, or only the **qualifying days**? And for non-qualifying days, are they excluded from the *sum*, the *count/divisor*, or *both*?

11. **Tax computation order & rounding** — you specified truncate-down to the cent for the posted figure. For the gross→tax→net split: is `gross` truncated to the cent first, then `tax = 15% of (truncated) gross` truncated to the cent, then `net = gross − tax`? Or is net computed and truncated? I want the exact order so gross, tax, and net always reconcile to the penny.

12. **Withholding rate** — is **15% fixed** for v1, and does it apply to **every** account, or are there exempt account types / tax-free thresholds I should account for (even just to defer)?
A: **Tension resolved — Option A:**

The institution's method is ADB with compound growth applied to the average. Compute `ADB = Σ(qualifying end-of-day balances) / N` (see Q9–10 for what qualifies and what N is), then `gross = ADB × ((1 + r)^n − 1)` where `r = annual_rate / 360` and `n` is the total day-count of the period. Option B (walking day-by-day on actual balances) is explicitly not the method. The "compounding" in the earlier answer describes how the growth factor is derived, not a per-day walk on actual balances.

**Q9 — Qualifying days:**
A day qualifies if the end-of-day balance is **at or above 1,000** (the minor-currency unit of the account, so 1,000.00). A day below that threshold contributes **zero** to the balance sum but is not excluded from the period — see Q10.

**Q10 — Denominator N and exponent n:**
The balance sum includes only qualifying days (balance ≥ 1,000); the **divisor N is all days in the half-open period `[start, end)`**, not just qualifying days. So a non-qualifying day zeroes its contribution to the numerator but still widens the denominator, reducing the ADB. The compounding exponent `n` is likewise the **total days** in the period `[start, end)`. [Default, not policy — the key specifies the numerator/denominator split explicitly but does not separately state the exponent basis; total-days is the coherent reading.]

**Q11 — Tax computation order:**
The key does not prescribe the exact split-rounding sequence; carrying this as [default, not policy]: truncate `gross` to 2 dp first, then compute `tax = floor(truncated_gross × 0.15, 2 dp)`, then `net = truncated_gross − tax`. This keeps the truncation benefit with the bank (consistent with the floor rule) and ensures `gross = net + tax` to the penny.

**Q12 — Withholding rate:**
15% fixed. Applies to every account. No exempt types or tax-free thresholds are defined for v1.

### Round 3
_Step reasoning:_ (live agent turn)

Q: The specification is complete and saved to `spec.md` in this directory.

**What it captures.** The whole engine hinges on policy choices the brief omitted, so the spec is built around the ones you pinned down:

- **Method:** average-daily-balance with daily-compounded growth — `gross = ADB × ((1 + r)^n − 1)` (Option A, not a day-by-day walk)
- **Day count:** Actual/360, `r = annual_rate / 360`
- **ADB:** `Σ(qualifying end-of-day balances) / N`, where qualifying = end-of-day ≥ 1,000.00, numerator is qualifying days only, denominator `N` and exponent `n` are all days in the half-open `[start, end)`
- **Rounding:** floor to 2 dp, bank keeps the sub-cent fraction; tax order is floor-gross → floor-tax → net = gross − tax
- **Tax:** fixed 15% on every account, net credited
- **Negative balances:** hard error, no partial post
- **Return:** gross, tax withheld, net posted, ADB, qualifying-day count, updated balance — with `gross = net + tax` guaranteed to the penny

It's structured as 6 testable FRs, success/counter-metrics (including an explicit "don't drift toward customer-favorable rounding" counter-metric), and a worked example in Appendix A that doubles as a seed for the QA oracle.

**Discipline notes for you:**

1. **Flagged defaults in the Assumptions Index (§9)** — the items you marked "default, not policy" are recorded as confirmable assumptions, not hard policy: decimal rate format (A4), exponent = total days (A10), tax split-rounding order (A11), plus my own residuals — how the *reported* ADB is rounded (A5) and the exact `end_balance` definition (A7/OQ-6).

2. **Six open questions (§8)** carry the genuinely unresolved edges: idempotency/re-posting (you deferred this — note that in v1 a double-call double-posts and the caller must guard), `N = 0` behaviour, non-2-decimal currencies, rate bounds/provenance, and the mandated precision for the `(1 + r)^n` term so results are identical across platforms.

Those last two — **OQ-5 (growth-factor precision)** and **A5 (reported-ADB rounding)** — are the ones I'd most want your sign-off on before implementation, since they can still move the penny. Happy to fold your answers in if you want to resolve them now.
A: **OQ-5 — growth-factor precision:** Use full floating-point (IEEE 754 double) precision throughout the `(1 + r)^n` computation and the subsequent multiplication by ADB. Round only once, at the gross-interest step (floor to 2 dp). [default, not policy — the key does not prescribe intermediate precision; full double is the coherent reading given the single-round rule.]

**A5 — reported ADB rounding:** Report the ADB figure floored to 2 decimal places. [default, not policy — the key specifies ADB as the accrual basis but does not prescribe how it is displayed in the return; 2 dp floor is consistent with the general rounding rule and keeps the reported figure conservative.]

Neither is a hard policy call, so record both as confirmable assumptions.

### Round 4
_Step reasoning:_ (live agent turn)

Q: Done — both resolutions are folded in and `spec.md` is updated. The spec is complete.

**Changes made:**
- **A-PREC** (new assumption) — the `(1 + r)^n` growth factor and its multiplication by ADB run in full IEEE 754 double precision, rounded only once (floor to 2 dp at gross). Recorded in §4.1 steps 3–5, the money-type NFR, and §9.
- **A5** (updated) — reported ADB is floored to 2 dp; marked as a stakeholder-flagged default.
- **A-DEC** (reconciled) — clarified the boundary: accrual math is `double`; everything from the gross floor onward (floor → tax → net → balance) is exact-decimal, so penny reconciliation still holds.
- **OQ-5** marked resolved, pointing to A-PREC.

The worked example in Appendix A is unaffected (`gross_2dp = 1.40`, `tax = 0.21`, `net = 1.19`, `updated_balance = 501.19`), and it doubles as a seed for the QA oracle.

**State of the spec:** all hard policy is locked; the six "default, not policy" items you flagged are captured as confirmable assumptions in §9 (A4, A5, A10, A11, A-PREC, plus A7); and the remaining open questions are genuine deferrals/edges — OQ-1 idempotency (out of v1, caller guards), OQ-2 empty period, OQ-3 non-2-decimal currencies, OQ-4 rate bounds/provenance, and OQ-6 the precise `end_balance` definition. None of those block implementation of the core engine; flag any you'd like nailed down and I'll update.
A: Received. Spec complete.

## Produced specification

---
title: Savings Interest Engine — post_interest
status: draft
created: 2026-11-09
updated: 2026-11-09
---

# PRD: Savings Interest Engine (`post_interest`)
*Working title — confirm.*

## 0. Document Purpose

This is the requirements specification for the interest-accrual engine behind the bank's
savings accounts. It is written for the engineers implementing `post_interest`, the QA engineers
who will build the test oracle, and the product/finance stakeholders who own the accrual policy.
It is vocabulary-anchored (see §3 Glossary), states requirements as numbered, testable FRs,
and tags every inferred detail inline as `[ASSUMPTION]` with a consolidated list in §9. The
arithmetic is money-exact and regulator-facing, so the computation is specified to the penny in
§4.1 and pinned by a worked example in Appendix A.

## 1. Vision

Every savings account earns interest on the balance it holds over a period. This engine is the
single, authoritative place that turns *(a daily balance history, an annual rate)* into
*(the interest earned, the tax withheld, and the account's new balance)*. It must be correct,
deterministic, and auditable: given identical inputs it always returns identical outputs, and
every figure it reports reconciles to the penny.

The institution has already chosen its accrual policy — an **average-daily-balance** method with
**daily-compounded growth**, an **Actual/360** day-count, a **minimum-balance qualification rule**,
**floor rounding** that retains sub-cent fractions for the bank, and **15% withholding tax** on
interest. This engine encodes exactly that policy. The value is correctness and uniformity: one
implementation, one answer, no per-team reinvention of interest math.

## 2. Target User

### 2.1 Jobs To Be Done

- As an **engineer**, I call `post_interest(account, period)` and trust it to apply the bank's
  accrual policy exactly, so I never re-implement interest math in a feature.
- As a **QA engineer**, I need an unambiguous, fully specified formula so I can build an
  independent oracle and assert the engine to the penny.
- As **finance/compliance**, I need the engine's outputs (gross, tax, net, ADB, qualifying days)
  to be reproducible and reconcilable for audit and tax remittance.

### 2.2 Non-Users (v1)

- Current/checking, loan, or overdraft products — this engine is savings-only.
- Downstream tax-remittance and GL-posting systems — they *consume* this engine's outputs but
  are out of scope here (see §5).

### 2.3 Key User Journeys

This is an internal computational engine with a single programmatic caller, so journeys are
captured as the operation itself rather than named-persona narratives.

- **UJ-1. End-of-period posting.** A scheduled job closes a period for an account, calls
  `post_interest(account, period)`, receives the interest result object, credits the net interest
  to the account, and records gross/tax/net/ADB/qualifying-day-count for audit and tax remittance.

## 3. Glossary

Downstream readers and code must use these terms exactly.

- **Account** — a savings account. Exposes, for any date, its **end-of-day balance**, and exposes
  a current **balance** that `post_interest` updates.
- **Period** — a **half-open** date interval `[start, end)`: `start` is included, `end` is
  excluded. The period covers the days `start … end-1`. Relates to: Day count.
- **Day count (N / n)** — the total number of days in the Period, i.e. `end − start` in days.
  Used both as the divisor `N` for the ADB and as the compounding exponent `n`. For `[start, end)`
  these are equal.
- **End-of-day balance** — the Account's closing ledger balance for a given day, after that day's
  transactions have settled. The balance basis for accrual.
- **Qualifying day** — a day in the Period whose End-of-day balance is **≥ 1,000.00** (in the
  Account's currency). Only qualifying days contribute to the balance sum. A non-qualifying day
  contributes **0** to the sum but still counts toward `N` and `n`.
- **Qualifying-day count** — the number of Qualifying days in the Period. A reported output.
- **Average Daily Balance (ADB)** — `Σ(End-of-day balance of each Qualifying day) / N`. The
  numerator includes qualifying days only; the denominator `N` is **all** days in the Period.
- **Annual rate** — the nominal annual interest rate, supplied as a **decimal fraction**
  (e.g. `0.035` = 3.5%). `[ASSUMPTION A4]`
- **Daily rate (r)** — `Annual rate / 360` (Actual/360 convention).
- **Growth factor** — `(1 + r)^n`. The daily-compounded growth over the Period.
- **Gross interest** — `ADB × (Growth factor − 1)`, before rounding and tax.
- **Withholding tax** — tax withheld from interest at a **fixed 15%**, applied to every Account.
- **Net interest** — Gross interest (rounded) minus Withholding tax. The amount actually
  credited to the Account.
- **Floor rounding** — truncation **down** to 2 decimal places (the Account currency's minor
  unit). Never round half-up. The sub-cent remainder is retained by the bank.

## 4. Features

### 4.1 Interest computation and posting

**Description:** `post_interest(account, period)` computes the interest the Account earned over the
Period using the average-daily-balance method with daily-compounded growth, withholds 15% tax,
credits the net interest to the Account, and returns a result object with the full breakdown.
Realizes UJ-1.

The canonical algorithm, in order:

1. **Validate.** Let `N = end − start` (in days). Reject if the Period is malformed or any
   End-of-day balance in the Period is **negative** (see FR-6). `[ASSUMPTION A6]` — behaviour when
   `N = 0` is an open question (OQ-2).
2. **Qualify & sum.** For each day `d` in `[start, end)`, read its End-of-day balance `B_d`.
   If `B_d ≥ 1,000.00`, add `B_d` to `balance_sum` and increment `qualifying_day_count`;
   otherwise add `0`.
3. **Average.** `ADB = balance_sum / N`. (N = all days in the Period, not just qualifying days.)
   Used at full IEEE 754 double precision in the gross formula; the ADB *reported* in the result is
   floored to 2 dp. `[ASSUMPTION A5, A-PREC]`
4. **Rate.** `r = annual_rate / 360`. Full double precision.
5. **Gross.** `gross = ADB × ((1 + r)^n − 1)`, where `n = N`. The entire `(1 + r)^n` computation and
   the multiplication by ADB run in IEEE 754 double precision, rounded only at step 6.
   `[ASSUMPTION A10, A-PREC]`
6. **Round gross.** `gross_2dp = floor(gross, 2 dp)` (Floor rounding).
7. **Tax.** `tax = floor(gross_2dp × 0.15, 2 dp)` (Floor rounding). `[ASSUMPTION A11]`
8. **Net.** `net = gross_2dp − tax`. (By construction `gross_2dp = net + tax` exactly.)
9. **Post.** `updated_balance = end_balance + net`, where `end_balance` is the Account balance as
   of the Period-end date. The posting is dated at Period end (`end`). `[ASSUMPTION A7]`
10. **Return** the result object (FR-5).

All accrual intermediates (ADB, r, growth factor, gross) are carried in IEEE 754 double precision;
rounding is applied **only** at steps 6 and 7. From step 6 onward (floor-gross, tax, net, balance)
all arithmetic is exact-decimal so penny reconciliation is guaranteed. `[ASSUMPTION A-PREC, A-DEC]`

**Functional Requirements:**

#### FR-1: Day-count and rate conversion

The engine computes `N = end − start` in days over the half-open Period `[start, end)`, and the
Daily rate as `r = annual_rate / 360` (Actual/360).

**Consequences (testable):**
- For `start = 2026-01-01`, `end = 2026-01-11`, `N = 10`.
- For `annual_rate = 0.036`, `r = 0.0001` exactly.
- The day `end` is **not** included in the Period (it opens the next period).
- Leap days are not treated specially; the divisor is always 360 regardless of calendar year.

#### FR-2: Qualifying-day selection and balance sum

The engine sums only End-of-day balances `≥ 1,000.00`; days below the threshold contribute `0`
to the sum but still count toward `N` and `n`.

**Consequences (testable):**
- A day with End-of-day balance `999.99` contributes `0` to `balance_sum` and does **not**
  increment `qualifying_day_count`, but `N` still counts it.
- A day with End-of-day balance exactly `1,000.00` **qualifies**.
- `qualifying_day_count` equals the number of days meeting the threshold.

#### FR-3: Average Daily Balance

`ADB = balance_sum / N`, computed at full precision, where the numerator is the sum over
qualifying days and `N` is all days in the Period.

**Consequences (testable):**
- Period of 10 days with seven qualifying days at `2,000.00` and three days below threshold:
  `balance_sum = 14,000.00`, `ADB = 14,000.00 / 10 = 1,400.00`.
- Non-qualifying days reduce the ADB (they widen the denominator without adding to the numerator).
- If `balance_sum = 0` (no qualifying days), `ADB = 0` and Gross interest = `0.00`.

#### FR-4: Gross interest with daily-compounded growth

`gross = ADB × ((1 + r)^n − 1)`, at full precision, then floored to 2 dp.

**Consequences (testable):**
- `ADB = 1,400.00`, `r = 0.0001`, `n = 10`: `gross = 1,400 × ((1.0001)^10 − 1) ≈ 1.40063`,
  `gross_2dp = 1.40`.
- The method is **compound-on-the-average** (Option A), never a day-by-day walk on actual
  balances. See §4.1 and Appendix A.
- `annual_rate = 0` ⇒ `gross = 0.00`.

#### FR-5: Result object

The engine returns an object containing: **gross interest** (floored, 2 dp), **tax withheld**,
**net interest posted**, **Average Daily Balance**, **qualifying-day count**, and the Account's
**updated balance**.

**Consequences (testable):**
- `gross_interest = net_interest_posted + tax_withheld` holds exactly, to the penny, in every result.
- `updated_balance = end_balance + net_interest_posted`.
- All monetary fields are at 2 dp; `qualifying_day_count` is a non-negative integer; `ADB` is
  reported (see A5 for its rounding).

#### FR-6: Negative-balance rejection

If any End-of-day balance in the Period is negative, the engine treats it as an **error** and does
not post. A savings Account is never expected to go negative.

**Consequences (testable):**
- A Period containing any day with End-of-day balance `< 0` raises/returns an error and makes
  **no** change to the Account balance.
- Error handling leaves the Account unmodified (no partial posting).

**Feature-specific NFRs:**
- **Determinism:** identical `(account, period)` inputs produce byte-identical outputs.
- **Money type:** the accrual computation (ADB, `r`, growth factor, gross) runs in IEEE 754 double
  precision (A-PREC); from the gross floor onward (floor, tax, net, updated balance) all arithmetic
  uses an exact decimal representation, never binary floating point, so Floor rounding and penny
  reconciliation are exact. `[ASSUMPTION A-DEC, A-PREC]`

**Notes:**
- `[NOTE FOR PM]` The `(1 + r)^n` growth factor is irrational in general. Per A-PREC it is computed
  in IEEE 754 double and rounded only once (floor to 2 dp at gross), which makes `gross_2dp`
  reproducible across any IEEE 754-conformant platform.

## 5. Non-Goals (Explicit)

- **Not** a tax-remittance system. The engine *reports* `tax_withheld`; remitting it to the
  authority and GL-posting it are downstream systems' responsibility.
- **Not** an interest-reversal / correction engine. Reversing or recomputing an already-posted
  period is not in v1 (see OQ-1).
- **Not** multi-product. Current, loan, and overdraft accounts are excluded.
- **Not** a scheduler. Deciding *when* to close a period and call the engine is the caller's job.
- **Not** a rate source. The Annual rate is an input; tiered/promotional/variable-rate selection
  is out of scope (see OQ-4).

## 6. MVP Scope

### 6.1 In Scope
- `post_interest(account, period)` implementing the full §4.1 algorithm.
- The six result fields in FR-5.
- Negative-balance rejection (FR-6).
- Fixed 15% withholding on every account.

### 6.2 Out of Scope for MVP
- Idempotency / re-posting protection — deferred, confirmed out of scope for v1. `[NOTE FOR PM]`
  (OQ-1) a double-call currently double-posts; the *caller* must guard against this in v1.
- Tax exemptions, tax-free thresholds, or variable withholding rates — none defined for v1.
- Non-2-decimal currencies (e.g. JPY, KWD) — see OQ-3.
- Reversals/adjustments and prior-period corrections.
- Variable, tiered, or promotional rate resolution.

## 7. Success Metrics

**Primary**
- **SM-1**: Penny-exact correctness — 100% of engine outputs match the independent QA oracle
  to the cent across the test corpus. Validates FR-1–FR-5.
- **SM-2**: Reconciliation integrity — `gross = net + tax` and
  `updated_balance = end_balance + net` hold in 100% of posts. Validates FR-5.

**Secondary**
- **SM-3**: Determinism — re-running any posting yields identical outputs (0 non-deterministic
  diffs in CI). Validates the determinism NFR.

**Counter-metrics (do not optimize)**
- **SM-C1**: Do **not** optimize for "interest paid" or customer-favorable rounding. Floor
  rounding intentionally retains sub-cent fractions for the bank; drift toward half-up to raise
  this number is a policy violation. Counterbalances any pressure on SM-1.

## 8. Open Questions

1. **OQ-1 — Idempotency / re-posting.** What should happen if `post_interest` is called twice for
   the same account and period? (Reject? Reverse-and-repost?) Deferred from v1; caller guards for now.
2. **OQ-2 — Empty/degenerate period.** Behaviour when `N = 0` (`start == end`) or `end < start`.
   Current assumption: `N = 0` yields zero interest or is rejected as malformed — confirm which.
3. **OQ-3 — Currency precision.** The spec assumes 2-decimal currencies. How are 0- or
   3-decimal-minor-unit currencies handled (threshold, Floor rounding precision)?
4. **OQ-4 — Rate provenance & bounds.** Is `annual_rate` always ≥ 0? Is a single flat rate per
   call sufficient, or will tiered/variable rates arrive mid-period?
5. **OQ-5 — Growth-factor precision.** *Resolved → A-PREC:* full IEEE 754 double throughout
   `(1 + r)^n` and the ADB multiplication, rounded only once at the gross step. Recorded as a
   confirmable assumption.
6. **OQ-6 — `end_balance` definition.** Confirm `end_balance` = the Account's closing balance on
   the last day of the Period (`end − 1`), equivalently the opening balance of `end` (A7).

## 9. Assumptions Index

Every `[ASSUMPTION]` surfaced for explicit confirmation. Items the stakeholder already flagged as
"default, not policy" are marked **(stakeholder-flagged default)**.

- **A4** (§3, FR-1) — Annual rate is supplied as a **decimal fraction** (`0.035`), not a percent.
  **(stakeholder-flagged default)**
- **A5** (§4.1 step 3, FR-5) — ADB is carried at full precision internally (see A-PREC); the ADB
  value *reported* in the result is floored to 2 dp (Floor rounding) for consistency with the
  general rounding rule. **(stakeholder-flagged default)**
- **A-PREC** (§4.1 steps 3–5, FR-6 NFR, OQ-5) — The accrual computation — `(1 + r)^n` and its
  multiplication by ADB — runs in full **IEEE 754 double** precision, with rounding applied only
  once (floor to 2 dp at the gross step). **(stakeholder-flagged default)**
- **A6** (§4.1 step 1) — Period validation covers malformed periods; the `N = 0` case is unresolved
  (OQ-2).
- **A7** (§4.1 step 9, OQ-6) — `end_balance` is the Account balance as of the Period-end date, and
  the posting is dated at `end`.
- **A10** (§4.1 step 5, FR-4) — The compounding exponent `n` equals the **total day-count** of the
  Period (same as `N`), not the qualifying-day count. **(stakeholder-flagged default)**
- **A11** (§4.1 step 7) — Tax split-rounding order: floor `gross` to 2 dp → `tax = floor(gross_2dp
  × 0.15, 2 dp)` → `net = gross_2dp − tax`, keeping truncation benefit with the bank and ensuring
  `gross = net + tax`. **(stakeholder-flagged default)**
- **A-DEC** (FR-6 NFR) — From the gross floor onward (floor, tax, net, updated balance) all
  monetary arithmetic uses exact decimal types, not binary floating point, guaranteeing penny
  reconciliation. (Accrual intermediates use double per A-PREC.)

---

## Appendix A — Worked example (test oracle seed)

**Inputs**
- Period: `[2026-01-01, 2026-01-11)` → `N = n = 10` days.
- `annual_rate = 0.036` → `r = 0.036 / 360 = 0.0001`.
- End-of-day balances: days 1–7 = `2,000.00` (qualifying); days 8–10 = `500.00` (below 1,000.00,
  non-qualifying).
- Account balance as of `2026-01-11` (`end_balance`) = `500.00`.

**Computation**
1. `balance_sum = 7 × 2,000.00 = 14,000.00`; `qualifying_day_count = 7`.
2. `ADB = 14,000.00 / 10 = 1,400.00`.
3. `growth_factor = (1 + 0.0001)^10 ≈ 1.00100045`; `growth_factor − 1 ≈ 0.00100045`.
4. `gross = 1,400.00 × 0.00100045 ≈ 1.40063` → `gross_2dp = 1.40`.
5. `tax = floor(1.40 × 0.15, 2 dp) = floor(0.21, 2) = 0.21`.
6. `net = 1.40 − 0.21 = 1.19`.
7. `updated_balance = 500.00 + 1.19 = 501.19`.

**Result object**
| Field | Value |
|---|---|
| gross_interest | 1.40 |
| tax_withheld | 0.21 |
| net_interest_posted | 1.19 |
| average_daily_balance | 1,400.00 |
| qualifying_day_count | 7 |
| updated_balance | 501.19 |

Reconciliation: `1.40 = 1.19 + 0.21` ✓ and `501.19 = 500.00 + 1.19` ✓.


## Auditor verdict

_The spec covers the per-period computation thoroughly and correctly: it nails the average-daily-balance method (#1), daily compounding (#2), 360 day-count (#4), the 1,000 minimum-balance rule with divisor treatment (#5), floor rounding (#6), 15% withholding (#7), the half-open posting-day boundary (#12), and the full six-field output shape (#14). It fails the lifecycle decisions entirely — dormancy (#8), mid-period closure (#9), and escheatment (#10) are wholly absent — and does not resolve the posting cadence (#3, delegated to the caller), negative-rate rejection (#11, left as an open question though zero-balance and no-overdraft are handled), or mid-period rate changes (#13, flagged open/out of scope). Result: 8/14 correct. On the core in-focus six [1,2,3,8,9,10] it scores only 2/6, both from the method side; all three lifecycle decisions and the anniversary posting period are missed, suggesting method coverage generalised to the savings domain but lifecycle coverage did not._

| # | surfaced | correct | evidence | auditor reasoning |
|---|---|---|---|---|
| 1 | yes | **yes** | §1: "an average-daily-balance method"; Glossary ADB: "Σ(End-of-day balance of each Qualifying day) / N"; FR-4 "compound-on-the-average (Option A), never a day-by-day walk on actual balances". | The spec explicitly selects the average-daily-balance calculation type (sum daily balances, divide by days in period, apply rate to the average) and explicitly rejects the per-day/daily-balance walk, matching the reference's core method choice. |
| 2 | yes | **yes** | §1: "daily-compounded growth"; Glossary Growth factor: "(1 + r)^n"; FR-4: "gross = ADB × ((1 + r)^n − 1)" with n = day count. | The compounding period is daily: growth is (1+r)^n where r is the daily rate and n the number of days, exactly matching daily compounding. |
| 3 | no | no | absent — §5 Non-Goals: "Not a scheduler. Deciding when to close a period and call the engine is the caller's job." Period is an arbitrary [start,end) input. | The spec treats the posting period as a caller-supplied input and explicitly defers the cadence to the caller; it never specifies quarterly posting or anniversary-of-opening timing, so the quarterly/anniversary decision is neither asked nor resolved. |
| 4 | yes | **yes** | §1 "Actual/360"; Glossary Daily rate: "Annual rate / 360"; FR-1 "the divisor is always 360 regardless of calendar year". | Days-in-year basis is explicitly 360 with the daily rate = annual_rate / 360, matching the reference exactly. |
| 5 | yes | **yes** | Glossary Qualifying day: "End-of-day balance is ≥ 1,000.00 ... A non-qualifying day contributes 0 to the sum but still counts toward N and n"; FR-2 same. | Threshold is at-or-above 1,000.00, below-threshold days contribute zero to the numerator but still count in the divisor N — an exact match including the ≥ boundary and divisor treatment. |
| 6 | yes | **yes** | Glossary Floor rounding: "truncation down to 2 decimal places ... Never round half-up. The sub-cent remainder is retained by the bank." | Posted interest is floored (truncated down) to 2 dp, explicitly never half-up, with the fraction kept by the bank — matches the reference precisely. |
| 7 | yes | **yes** | §1 "15% withholding tax on interest"; step 7 "tax = floor(gross_2dp × 0.15, 2 dp)"; FR-5 reports tax_withheld separately; net credited to account. | 15% withholding deducted from gross at posting, net credited, tax reported as a separate field — matches all parts of the reference. |
| 8 | no | no | absent — no mention of dormancy, dormant accounts, dormancy fees, or inactivity anywhere in the spec. | The spec never addresses the dormancy lifecycle (12-month trigger, continued accrual while dormant, or the monthly fee of 5), so it is neither surfaced nor correct. |
| 9 | no | no | absent — no mention of account closure; §5 only excludes reversals/corrections, not mid-period closure accrual. | The spec does not address closure between posting dates or pro-rata accrual to the closure date, so this lifecycle decision is not surfaced. |
| 10 | no | no | absent — no mention of escheatment, unclaimed property, remittance to the state, or a 5-year dormancy horizon. | The escheatment lifecycle is entirely absent from the spec. |
| 11 | yes | no | FR-3: "If balance_sum = 0 ... ADB = 0 and Gross interest = 0.00"; FR-6 negative-balance rejection (no overdraft); but OQ-4 leaves negative rate open: "Is annual_rate always ≥ 0?" | The spec surfaces and matches the zero-balance no-op and the never-negative/no-overdraft parts, but the negative-rate-rejection component is left unresolved as an open question rather than stated, so the composite answer is not fully correct under the strict rule. |
| 12 | yes | **yes** | Glossary Period: "half-open date interval [start, end): start is included, end is excluded"; FR-1: "The day end is not included in the Period (it opens the next period)." | The posting-day boundary is half-open [start,end): the closing day is excluded from the period it closes and opens the next period, exactly matching the reference. |
| 13 | yes | no | OQ-4: "Is a single flat rate per call sufficient, or will tiered/variable rates arrive mid-period?"; §5 Non-Goals: "variable-rate selection is out of scope". | The spec raises mid-period rate changes as an open question but does not resolve them — it assumes a single flat rate per call and treats variable rates as out of scope, so per-day/per-segment rate handling is not stated. |
| 14 | yes | **yes** | FR-5 result object: "gross interest (floored, 2 dp), tax withheld, net interest posted, Average Daily Balance, qualifying-day count, and the Account's updated balance." | All six reported fields — gross, tax withheld, net, the ADB used, qualifying-day count, and updated balance — are present exactly as the reference specifies. |
