A settlement instruction record `encode(rec) -> dict` produces these fields, each with a FIXED encoding
convention (none is the "natural" default):
- record_type: the literal string "SI2".
- amount: the amount in MINOR units (multiply by 100, round), as a 12-character zero-padded number. For a
  CREDIT direction, the LAST digit is replaced by a signed-overpunch letter: 0->"{", 1->"A", 2->"B", 3->"C",
  4->"D", 5->"E", 6->"F", 7->"G", 8->"H", 9->"I". (Debits keep plain digits.)
- currency: the ISO 4217 NUMERIC code, not the alpha code: USD=840, EUR=978, GBP=826, JPY=392, CHF=756.
- value_date: Julian format "YYYYDDD" — the 4-digit year followed by the 3-digit zero-padded day-of-year.
- direction: "C" for credit, "D" for debit.
- account: right-justified and ZERO-padded to 10 characters, keeping only the rightmost 10.
- priority: the priority digit as a string, or "5" when priority is absent (None).
- method: a 2-digit code: wire="01", book="07", net="13".
- resident: "Y" when resident is true, else "N".
- purpose: uppercased, left-justified, exactly 4 characters (space-padded or truncated).
- filler: exactly 6 spaces.
- check: a single digit = (sum of all digit characters in amount + currency + value_date) modulo 10.
