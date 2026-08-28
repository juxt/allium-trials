# Fineract progressive-loan EMI: exact numerical policy

This reproduces the schedule numbers of `ProgressiveEMICalculator` to the penny for the
configuration the oracle harness uses. It is derived from the source, not from the traces,
and cross-checked against them.

All `file:line` references are to
`fineract-progressive-loan/src/main/java/org/apache/fineract/portfolio/loanproduct/calc/`
unless noted.

## 0. Conventions fixed by the oracle harness

From `ProgressiveEMITraceHarness.java`:

| Setting | Value | Source |
|---|---|---|
| MathContext (intermediate) | `precision 12, HALF_EVEN` | harness:69, 85 |
| Currency | USD, `decimalPlaces = 2`, `inMultiplesOf = 1` | harness:72 |
| Money rounding mode | `HALF_EVEN` | harness:84 (`MoneyHelper.getRoundingMode`) |
| Interest method | `DECLINING_BALANCE` | harness:99 |
| Interest calculation period method | `DAILY` | harness:100 |
| Allow partial-period interest | `true` | harness:101 |
| Days-in-year | `DAYS_360` | harness:104 |
| Days-in-month | `DAYS_30` | harness:105 |
| Repayment frequency | `MONTHS`, repay every `1` | harness:106-107 |
| `installmentAmountInMultiplesOf` | `null` (no EMI rounding to multiples) | harness:135 |
| Grace (principal/interest) | `0` | harness:102-103 |
| Disbursement | single, on the first period's from-date | harness:136 |
| Schedule | `months` periods, each exactly one calendar month | harness:130-131 |

There are no repayments, rate changes, credits or re-aging in the harness: it builds the
model, disburses once, and reads the projected schedule. So the operational branches
(pay, credit, re-age, overdue) do not fire, and the numbers come only from the initial EMI
projection. This spec is scoped to that path.

## 1. The rounding rule that governs everything

`Money` is a fixed-scale type. Its constructor (`Money.java:40-52`) does:

```
this.amount = amount.stripTrailingZeros().setScale(decimalPlaces, mc.getRoundingMode());
```

So **every value typed as `Money` is quantised to 2 dp, HALF_EVEN, at the moment it is
constructed.** Every arithmetic helper (`plus`, `minus`, `add`, `multipliedBy`,
`dividedBy` at `Money.java:253-403`) computes into a fresh `BigDecimal` and wraps the
result back through `Money.of`, which re-quantises to 2 dp. Because both operands of a
`Money` add/subtract are already at 2 dp, those operations are exact; rounding only bites
when a raw `BigDecimal` (a rate-factor product, an interest amount) first crosses into
`Money`.

Rate factors and the EMI annuity terms are held as raw `BigDecimal` at MathContext
`(12, HALF_EVEN)` and are *not* quantised to 2 dp until they land in a `Money`.

Consequence, per period:
- interest is rounded to 2 dp,
- EMI is rounded to 2 dp,
- principal is derived as `EMI - interest` (both already 2 dp, so exact),
- outstanding balance is 2 dp.

## 2. Per-period interest / rate factor

The rate factor is "1 + simple interest for the period". Path for the harness config:

`calculateRateFactorPerPeriod` (`ProgressiveEMICalculator.java:1486`) with
`InterestCalculationPeriodMethod = DAILY` skips the `isSameAsRepaymentPeriod` branch
(`:1510`; `DAILY.isSameAsRepaymentPeriod()` is false). `DaysInYearType = DAYS_360` is not
`ACTUAL`, so `partialPeriodCalculationNeeded` is false (`:1505`). `DaysInMonthType =
DAYS_30`, so `daysInMonth = 30` (`:1508`) and it takes the `DAYS_30` branch (`:1536`)
into `rateFactorByRepaymentEveryMonth` -> `rateFactorByRepaymentPeriod` (`:1950`):

```
interestRate       = annualNominalRatePercent / 100                 (mc 12)   [:1318-1320]
daysInYear         = 360                                            (DAYS_360) [:1348, :1352]
daysInMonth        = 30                                                        [:1508]
repaymentEvery     = 1
actualDaysInPeriod = exact day count (fromDate..dueDate)                       [:1500-1501]
calculatedDaysInPeriod = exact day count of the repayment period               [:1502-1503]

interestFractionPerPeriod = daysInMonth * repaymentEvery / daysInYear    (mc 12)  [:1956-1958]
                          = 30 * 1 / 360 = 0.0833333333333            (12 sig figs)
rateFactor = interestRate
             * interestFractionPerPeriod        (mc 12)
             * actualDaysInPeriod               (mc 12)
             / calculatedDaysInPeriod           (mc 12)
             .setScale(12, HALF_EVEN)                                          [:1959-1962]
```

`actualDaysInPeriod` is the real number of days between the period boundaries, from
`DateUtils.getDifferenceInDays` (ChronoUnit.DAYS between the two `LocalDate`s). It is *not*
30. For a whole repayment period there is one interest period spanning it, so
`actualDaysInPeriod == calculatedDaysInPeriod` and their ratio is exactly 1. The
day-length still appears in the interest *amount* (section 3) via `getLength()`, but here
it cancels.

So for the harness config, for a full month:

```
rateFactor = (rate% / 100) * (30 / 360) = rate% / 1200
```

Example r = 18: rateFactor = 0.18 / 12 = 0.015 exactly. Matches the traces (period-0
interest on 1000.00 is 15.00).

`rateFactorPlus1` for a repayment period = `1 + sum of its interest periods' rateFactor`
(`RepaymentPeriod.java:216-218`). One interest period per repayment period here, so
`rateFactorPlus1 = 1 + rateFactor`.

### Interest amount for a period (declining balance)

`InterestPeriod.getCalculatedDueInterest(DECLINING_BALANCE, lengthTillDueDate)`
(`InterestPeriod.java:145-158`):

```
baseAmount = outstandingLoanBalance at start of the interest period   (2 dp)
interest_raw = baseAmount
               * rateFactorTillPeriodDueDate     (mc 12)
               / lengthTillPeriodDueDate          (mc 12)
               * getLength()                       (mc 12)
```

`rateFactorTillPeriodDueDate` is computed the same way as `rateFactor` but always spanning
to the repayment period due date (`calculateRateFactorPerPeriodForInterest`,
`:1355`). For a single full-period interest period, `lengthTillPeriodDueDate ==
getLength()`, so those cancel and `interest_raw = baseAmount * rateFactor`. It is then
summed and wrapped into a `Money` (`RepaymentPeriod.calculateCalculatedDueInterest`,
`:252-257`), i.e. **rounded to 2 dp HALF_EVEN**.

Example r = 18, second period base 671.62: 671.62 * 0.015 = 10.0743 -> `10.07`. Matches.

The interest actually reported (`getDueInterest`, `:272-286`) equals this calculated
interest for a clean projection with no payments (the `min`/`max` against EMI and paid
amounts do not reduce it while EMI >= interest).

## 3. EMI computation (level instalment)

Declining-balance EMI is the standard annuity, but computed with the iterative `fn`
product rather than a closed-form `(1+r)^n`, so it reproduces to the penny even when rate
factors differ period to period.

`calculateEMIOnActualModelWithDecliningBalanceInterestMethod` (`:1722`):

```
rateFactorN = product over ALL related periods of rateFactorPlus1_i     (mc 12)  [:1816-1820, :1725]
fnResult    = fold over periods 2..n:  fn = 1 + fnPrev * rateFactorPlus1_i (mc 12) [:1822-1828, :1991-1993]
              (seed fnPrev = 1, first period skipped: .skip(1))
outstandingBalance = initial balance for EMI recalculation
                   = previous period's outstanding + disbursed + capitalized  [:1729, RepaymentPeriod.java:413-427]
                   (for a fresh loan at period 0 with a single disbursement: = disbursed principal)

EMI_raw = rateFactorN * outstandingBalance / fnResult      (mc 12)   [:1838-1841]
EMI     = Money.of(EMI_raw)  -> 2 dp HALF_EVEN                        [:1731-1732]
          + calculateEMIValueForFixedInterest(...)  (= 0 here)        [:1733]
```

`MathUtil.stripTrailingZeros` is applied to `rateFactorN` and `fnResult` before use
(`:1725-1726`); it only removes trailing zeros and does not change value.

With every `rateFactorPlus1_i = 1 + r` equal (constant rate), this reduces to the familiar
`EMI = P * r * (1+r)^n / ((1+r)^n - 1)`. The `fn` recurrence yields
`fnResult = ((1+r)^n - 1) / r` and `rateFactorN = (1+r)^n`, so
`EMI = (1+r)^n * P / (((1+r)^n - 1)/r) = P*r*(1+r)^n / ((1+r)^n - 1)`.

Example P = 1000, r = 0.015, n = 3: (1.015)^3 = 1.045678375;
EMI = 1000 * 0.015 * 1.045678375 / 0.045678375 = 343.3830... -> `343.38`. Matches.

`installmentAmountInMultiplesOf` is null in the harness, so
`applyInstallmentAmountInMultiplesOf` (`:1761`) is the identity and no multiples-rounding
occurs. (If it were set, EMI would be rounded to that multiple with a zero-guard,
`:1770-1776`.)

The computed EMI is written to every period as both `emi` and `originalEmi` (`:1736-1741`).

## 4. Principal, balance roll, and the final-instalment adjustment

### Principal per period

`getDuePrincipal` (`RepaymentPeriod.java:345-350`) = `EMI (+credited +futureUnrecog)
- dueInterest`, floored at 0, i.e. for the clean path `principal = EMI - interest`. Both
are 2 dp, so this is exact.

### Balance roll

Outstanding balance at the start of each interest period
(`InterestPeriod.updateOutstandingLoanBalance`, `:168-188`):

```
start_of_period_0 = disbursed amount                          (= disbursed) [first period, no previous]
start_of_period_k = start_{k-1} + disbursement_{k-1} + capitalized_{k-1}
                    + balanceCorrection_{k-1}
                    - duePrincipal_{k-1} + paidPrincipal_{k-1}     (all 2 dp)
```

With one disbursement at period 0 and no payments/corrections, this is simply
`start_k = start_{k-1} - duePrincipal_{k-1}`, floored at 0. Confirms
`outstanding_start(0) = disbursed`.

`RepaymentPeriod.getOutstandingLoanBalance` (`:389-403`) reports the end-of-period balance
= last interest period's balance + its disbursement/capitalized/correction + paidPrincipal
- duePrincipal, floored at 0. In the harness the trace uses this as the next period's
`outstanding_start` (harness:159).

### Final-instalment adjustment (closing to zero)

Two mechanisms act, in order.

**(a) `calculateLastUnpaidRepaymentPeriodEMI`** (`:1160`), called at the end of the
declining-balance path (`:747`). It finds the last not-fully-paid period (for a clean
projection, the last period) and sets its EMI so the whole schedule's money identity
closes exactly (`:1189-1210`):

```
totalDueInterest      = sum of every period's dueInterest                 (2 dp) [:1190-1191]
totalEMI              = sum of every period's (EMI + credited + futureUnrecog)   [:1192-1194]
totalDisbursedAmount  = sum of interest-period disbursements  (= disbursed)      [:1195-1197]
totalCapitalizedIncome = 0
diff = totalDisbursed + totalCapitalized + totalCreditedPrincipal
       + totalDueInterest - totalEMI                                            [:1202-1203]
lastPeriod.EMI = lastPeriod.EMI + diff                                          [:1205, :1210]
```

`diff` is the accumulated rounding residual: `sum(EMI) - (principal repaid + interest)`.
Adding it to the last EMI forces `sum(principal) == disbursed`, so the balance lands on
exactly zero. Because all terms are 2 dp, `diff` is an exact multiple of 0.01 and the last
EMI closes the loan to the penny.

Note the guard at `:1165-1173`: if a period's outstanding principal exceeds
`totalDue - totalPaid`, EMI is trimmed by the excess (never below paid amounts). It does
not fire on a clean projection.

**(b) `checkAndAdjustEmiIfNeededOnRelatedRepaymentPeriods`** (`:1258`, called at `:749`).
Up to 3 iterations, it looks at the gap between the last period's EMI and the penultimate
period's EMI (`getEmiAdjustment`, `:1778`). If spreading that difference back across the
earlier periods reduces the last-vs-penultimate EMI gap, it re-levels: it raises the
common EMI by the rounded share and re-runs the last-period close. It stops when the
adjusted EMI equals the original, when the gap would not shrink, or after 3 rounds
(`:1265-1308`). This is what keeps all non-final instalments equal while absorbing the
residual into the final one, rather than letting the last instalment drift far from the
rest. On the harness cases the residual is at most a couple of cents and this leaves the
level EMI unchanged.

Net effect for the harness path: all periods carry the same EMI, per-period interest is
`balance * rateFactor` rounded to 2 dp, per-period principal is `EMI - interest`, and the
final period's principal is whatever remains, so the balance reaches exactly 0.00.

## 5. Worked check (P=1000, r=18%, n=3) against the oracle

```
rateFactor = 0.18/12 = 0.015 ; EMI = 343.38

period 0: interest = 1000.00*0.015 = 15.0000 -> 15.00 ; principal = 343.38-15.00 = 328.38
          end balance = 1000.00 - 328.38 = 671.62
period 1: interest = 671.62*0.015 = 10.0743 -> 10.07 ; principal = 343.38-10.07 = 333.31
          end balance = 671.62 - 333.31 = 338.31
period 2 (last): interest = 338.31*0.015 = 5.074650 -> 5.07 ; principal closes balance = 338.31
          EMI via close = 5.07 + 338.31 = 343.38 ; end balance = 0.00
```

Exactly the oracle trace `d1000_r18_m3.trace`.

## Confidence and gaps

Pinned with high confidence (source + trace agree):
- Money is quantised to 2 dp HALF_EVEN on every construction; intermediate BigDecimals use
  MathContext (12, HALF_EVEN). (`Money.java:40-52`; harness:69,84-85.)
- Per-period rate factor = `rate%/100 * daysInMonth/daysInYear * actualDays/calcDays` with
  `daysInMonth=30, daysInYear=360`, giving `rate%/1200` for a whole month.
  (`:1922-1963`.)
- Interest amount = `balance * rateFactor` (day-length terms cancel for a full period),
  rounded to 2 dp. (`InterestPeriod.java:145-158`.)
- EMI = `rateFactorN * balance / fnResult`, the iterative annuity, rounded to 2 dp;
  equals the closed-form annuity for a constant rate. (`:1722-1742`, `:1816-1841`,
  `:1991-1993`.)
- Principal = EMI - interest; balance rolls by subtracting due principal; last period is
  closed to zero by adding the schedule-wide residual `diff` to its EMI. (`:1160-1219`,
  `RepaymentPeriod.java:345-403`.)

Gaps / not exercised by the harness, so not fully pinned here:
- `actualDaysInPeriod / calculatedDaysInPeriod` only ever equals 1 in the harness (one
  full interest period per repayment period, no mid-period events). The behaviour when a
  disbursement, payment or rate change splits a period into multiple interest periods with
  differing day-lengths is described in the code but not verified against a trace. The
  day-length terms (`getLength`, `getLengthTillPeriodDueDate`) would then stop cancelling.
- The 3-iteration re-levelling in
  `checkAndAdjustEmiIfNeededOnRelatedRepaymentPeriods` (`:1258-1308`) is only lightly
  exercised: on these small residuals it leaves the level EMI unchanged. Its exact tie-
  breaking (`hasLessEmiDifference`, `getUncountablePeriods`) is not stressed by the corpus
  and would need dedicated cases to pin to the penny for pathological rounding.
- Rate = 0.0 produces rateFactor 0, EMI = P/n exactly, and `diff` closes any division
  residual; consistent with the code but worth a spot check against the r0 traces.
- `installmentAmountInMultiplesOf` is null throughout, so the multiples-rounding path
  (`:1770-1776`) is untested here.
