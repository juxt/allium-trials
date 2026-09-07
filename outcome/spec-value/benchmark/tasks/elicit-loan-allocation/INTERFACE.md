# Fixed interface contract (given to every code-generation step)

Behaviour comes from the arm's spec; this only fixes the shape so the code is runnable. The
result shape (decision #14) is fixed here, so #14 is not scored by the code oracle (coverage only).

```python
def allocate_payment(payment: dict, loan: dict) -> dict
```

`payment` = `{'amount': str, 'value_date': 'YYYY-MM-DD', 'timestamp': int}`  — amount is a decimal string.

`loan` = `{`
  `'currency': str,`            # e.g. 'BHD'
  `'as_of': 'YYYY-MM-DD',`      # processing date ("today")
  `'credit_balance': str,`      # existing unallocated credit
  `'instalments': [ {`
     `'due_date': 'YYYY-MM-DD',`
     `'fees': str, 'penalties': str, 'interest': str, 'principal': str,`  # outstanding per bucket
     `'interest_per_day': str, 'penalty_per_day': str,`                    # daily accrual rates
     `'accrued_to': 'YYYY-MM-DD'`                                          # date accrual is current to
  `} ] }`

Return `{`
  `'applied':  [ {'due_date','fees','penalties','interest','principal'} ],`  # amount applied per bucket per instalment
  `'balances': [ {'due_date','fees','penalties','interest','principal'} ],`  # outstanding per bucket after allocation
  `'credit_balance': str,`
  `'tolerance_written_off': str`
`}`

Raise `ValueError` for a rejected payment. All money is decimal strings.
