# Compact answer key (stakeholder use) — one line per decision

Answer only what is asked; give the exact value; volunteer nothing.

1. Interest calculation method: average daily balance — sum the daily balances over the period, divide by days in the period, apply the rate once to that average. Not per-day daily-balance.
2. Compounding period: interest compounds daily (each day's interest joins the base for the next day's accrual within the period).
3. Posting period: interest is posted quarterly, on the anniversary of account opening, not on calendar quarter-ends.
4. Days-in-year basis: 360 (not 365); the daily rate is annual_rate / 360.
5. Minimum balance to earn interest: interest accrues only on days the balance is at or above 1,000; on days below that, that day contributes zero interest but still counts as a day in the average-balance divisor.
6. Rounding of posted interest: rounded down (floor) to the minor unit (2 dp), never half-up; the bank keeps the fraction.
7. Withholding tax at posting: 15% withholding tax is deducted from the gross interest at each posting; the account is credited the net, and the tax withheld is reported separately.
8. Dormancy: after 12 months with no customer-initiated transaction the account becomes dormant; while dormant interest continues to accrue but a monthly dormancy fee of 5 is charged.
9. Closure mid-period: on closure between posting dates, interest is accrued pro-rata to the closure date and posted (net of withholding) as part of closing; the customer does not forfeit the partial period.
10. Escheatment: after 5 years dormant with no contact, the balance is escheated to the state — the account is closed to a zero balance and the funds remitted, no further interest.
11. Zero / negative rate or balance: a negative rate is rejected as invalid; a zero balance for the whole period posts zero interest (a no-op that still records a zero posting); the account never goes negative.
12. Interest on the posting day itself: the posting day is excluded from the period it closes and included in the next period (periods are [start, end), half-open).
13. Rate changes mid-period: each day uses the rate in force on that day; the average-balance interest is computed per rate-segment and summed.
14. Output and reporting shape: return, per posting: gross interest, tax withheld, net interest posted, the average daily balance used, the number of qualifying days, and the updated balance.
