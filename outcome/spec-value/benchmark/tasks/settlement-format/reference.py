"""Reference encoder for a bespoke SETTLEMENT INSTRUCTION wire record. Every field has a fixed, arbitrary
encoding convention drawn from mainframe/ISO-style financial formats — none guessable from the field name.
encode(rec) -> dict[field_name, encoded_string]. rec keys: amount (Decimal-ish float), currency (alpha ISO),
value_date (ISO 'YYYY-MM-DD'), direction ('credit'/'debit'), account (str), priority (int or None),
method ('wire'/'book'/'net'), resident (bool), purpose (str)."""
import datetime

# arbitrary but real conventions:
_CCY_NUM = {"USD": "840", "EUR": "978", "GBP": "826", "JPY": "392", "CHF": "756"}   # ISO 4217 numeric, not alpha
_METHOD = {"wire": "01", "book": "07", "net": "13"}                                  # arbitrary 2-digit codes
_OVERPUNCH = {"0":"{","1":"A","2":"B","3":"C","4":"D","5":"E","6":"F","7":"G","8":"H","9":"I"}  # signed-overpunch last digit for credits

def _julian(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.year:04d}{d.timetuple().tm_yday:03d}"          # YYYYDDD Julian, not YYYY-MM-DD

def encode(rec):
    out = {}
    out["record_type"] = "SI2"                                  # fixed sentinel incl. version
    minor = int(round(rec["amount"] * 100))                     # minor units
    s = f"{minor:012d}"                                         # 12-wide zero-padded
    if rec["direction"] == "credit":                            # credits carry a signed overpunch on the last digit
        s = s[:-1] + _OVERPUNCH[s[-1]]
    out["amount"] = s
    out["currency"] = _CCY_NUM[rec["currency"]]                 # numeric currency code
    out["value_date"] = _julian(rec["value_date"])             # Julian date
    out["direction"] = "C" if rec["direction"] == "credit" else "D"
    out["account"] = rec["account"].rjust(10, "0")[-10:]       # right-justified, ZERO-padded to 10, keep last 10
    out["priority"] = str(rec["priority"]) if rec["priority"] is not None else "5"   # default 5 when absent
    out["method"] = _METHOD[rec["method"]]                     # 2-digit method code
    out["resident"] = "Y" if rec["resident"] else "N"          # Y/N not true/false
    out["purpose"] = rec["purpose"].upper().ljust(4)[:4]       # uppercased, left-justified, exactly 4 chars
    out["filler"] = " " * 6                                    # 6 spaces
    # trailing modulo-10 check char over the digit-fields
    digits = "".join(c for c in (out["amount"]+out["currency"]+out["value_date"]) if c.isdigit())
    out["check"] = str(sum(int(c) for c in digits) % 10)       # digit-sum mod 10
    return out
