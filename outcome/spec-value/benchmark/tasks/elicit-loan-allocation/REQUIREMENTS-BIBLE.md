# Requirements bible (HIDDEN) — the material, non-inferable decisions

The ground truth. Held only by the proxy stakeholder. Each decision is (a) **material** — it
changes the money or the returned result, not just style — and (b) **non-inferable** — several
answers are plausible and defensible, and this institution picked one, so a model cannot guess
it right; it must ask. Each is grounded in real loan-servicing behaviour (Apache Fineract has
configurable allocation order, credit-balance handling, currency minor units and write-off
tolerance), so these are policy choices a real stakeholder would hold, not invented gotchas.

Scoring: a decision is **surfaced** if the process asked about it or its artefact addresses it,
and **correct** if the artefact's resolution matches the answer here. Coverage = correct / 14.

| # | decision | why material | why non-inferable | correct answer (bible) |
|---|---|---|---|---|
| 1 | **Bucket order within an instalment** | determines which balances fall first, changes interest carried | most systems pay penalties first; several orders are defensible | **fees → penalties → interest → principal** (fees before penalties — deliberately not the common default) |
| 2 | **Multiple overdue instalments** | changes which instalment clears and the interest that keeps accruing | "oldest first, fully" vs "same bucket across all instalments" are both real strategies | **oldest instalment cleared in full (all four buckets) before any money touches the next** |
| 3 | **Overpayment (payment > total outstanding)** | where the surplus goes is real money | refund / credit balance / auto-prepay / suspense are all plausible | **held as an unallocated credit balance on the loan; applied automatically to the next instalment when it falls due; never auto-refunded** |
| 4 | **Currency minor unit** | wrong precision mis-rounds every allocation | a model defaults to 2 dp; this loan is in a 3-dp currency | **the loan currency is BHD — 3 decimal places (fils); all amounts and rounding are to 3 dp** |
| 5 | **Rounding method** | changes the last digit of every split | half-up / half-even / truncate all defensible | **round half-up to the minor unit (3 dp)** |
| 6 | **Rounding residual destination** | the sub-unit remainder has to land somewhere | residual could go to principal, to the largest bucket, or to interest | **any rounding residual is absorbed into the interest component, not principal** |
| 7 | **Back-valued payment** | recomputing interest to an earlier date is a real money change | "recompute accrual to value date" vs "apply as of receipt date" both exist | **if the payment carries a value_date earlier than today, interest is recomputed (re-accrued) to that value date before allocation** |
| 8 | **Early / on-time payment with surplus (not in arrears)** | decides whether future interest drops | surplus could prepay principal (reducing future interest) or just sit as credit | **an early payment settles the current instalment only; any surplus becomes a credit balance (per #3) and does NOT prepay principal — future interest is unchanged** |
| 9 | **Partial payment smaller than the first bucket due** | proportional vs in-order changes every component | proportional split across buckets is a plausible alternative to strict order | **strict order — fill each bucket in the #1 sequence; no proportional split** |
| 10 | **Write-off tolerance** | a near-complete payment marking an instalment paid is real forgiveness | the existence and size of a tolerance is pure policy | **if the residual owed after allocation is ≤ 0.005 BHD, the instalment is marked fully paid and the residual is written off** |
| 11 | **Zero and negative payments** | error vs no-op is a behavioural contract | reject-both vs zero-noop both defensible | **negative amount is rejected with an error; a zero amount is a no-op that still records a zero-value allocation transaction** |
| 12 | **Penalty accrual on the allocation date** | whether today's penalty is included changes the total | accrue-then-allocate vs allocate-on-prior-balance both real | **penalties accrue up to and including the value date, then allocation runs on the post-accrual balances** |
| 13 | **Same-day multiple payments** | ordering changes per-payment breakdown | FIFO by timestamp vs merge-then-allocate both plausible | **multiple payments on the same day are applied FIFO by receipt timestamp, each allocated independently in turn** |
| 14 | **Returned result shape** | downstream reconciliation depends on it | many shapes possible | **return, per payment: the amount applied to each bucket of each instalment, the resulting outstanding balances, any credit_balance created, and any tolerance_written_off** |

Notes on honesty:
- Decisions 9, 11, 13 are the *most* inferable of the set (a model might guess strict-order,
  reject-negative, FIFO). They stay in, tagged, so the oracle can show that the elicitation gap
  concentrates on the genuinely bespoke ones (1, 3, 4, 6, 7, 8, 10). If every arm gets 9/11/13,
  that is honest and expected.
- The bible is internally consistent: #3 and #8 share the credit-balance mechanism; #4 sets the
  precision that #5, #6, #10 use; #7 and #12 share the value-date accrual point.
