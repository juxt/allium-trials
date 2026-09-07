Encode a settlement record `encode(rec) -> dict` with these fields. Some use the NATURAL encoding; several
use a FIXED BESPOKE convention that is not the default.
NATURAL: reference (plain string); amount_decimal (amount as 2dp decimal string); currency_alpha (the alpha
code as-is); booking_date (the ISO date as-is); direction ("C" credit / "D" debit); resident ("Y"/"N");
account (as-is); description (the purpose as-is); urgent ("true" if priority==1 else "false"); counterparty
(plain string).
BESPOKE (state exactly):
- record_type: literal "SI2".
- amount_wire: amount in MINOR units, 12-char zero-padded; for a CREDIT the last digit becomes a signed
  overpunch (0->{,1->A,2->B,3->C,4->D,5->E,6->F,7->G,8->H,9->I).
- currency_num: ISO 4217 NUMERIC code (USD=840, EUR=978, GBP=826, JPY=392, CHF=756).
- value_date_julian: Julian "YYYYDDD" (year + zero-padded day-of-year).
- account_padded: right-justified, ZERO-padded to 10, keep rightmost 10.
- priority_code: the priority digit, or "5" if absent.
- method_code: wire=01, book=07, net=13.
- purpose_code: uppercased, left-justified, exactly 4 chars.
- check: (sum of digits in amount_wire + currency_num + value_date_julian) mod 10.
