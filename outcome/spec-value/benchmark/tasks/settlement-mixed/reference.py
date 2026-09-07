"""Reference encoder for a settlement record — a MIX of NATURAL (inferable) and BESPOKE (non-inferable)
field encodings. A no-spec arm should get the natural half and miss the bespoke half (~50%); a spec that
states every convention reaches high. encode(rec) -> dict[field, str]."""
import datetime
_CCY_NUM = {"USD":"840","EUR":"978","GBP":"826","JPY":"392","CHF":"756"}
_METHOD = {"wire":"01","book":"07","net":"13"}
_OP = {"0":"{","1":"A","2":"B","3":"C","4":"D","5":"E","6":"F","7":"G","8":"H","9":"I"}
def encode(rec):
    o = {}
    # --- NATURAL / inferable fields (a sensible default gets these right) ---
    o["reference"] = str(rec["reference"])                       # plain string
    o["amount_decimal"] = f"{rec['amount']:.2f}"                 # decimal string, 2dp
    o["currency_alpha"] = rec["currency"]                        # alpha code as-is
    o["booking_date"] = rec["value_date"]                        # ISO date as-is
    o["direction"] = "C" if rec["direction"] == "credit" else "D"# C/D
    o["resident"] = "Y" if rec["resident"] else "N"              # Y/N
    o["account"] = rec["account"]                                # as-is
    o["description"] = rec["purpose"]                            # as-is
    o["urgent"] = "true" if rec["priority"] == 1 else "false"    # boolean-ish
    o["counterparty"] = str(rec["counterparty"])                 # plain string
    # --- BESPOKE / non-inferable fields (only the spec states these) ---
    o["record_type"] = "SI2"                                     # fixed sentinel
    minor = int(round(rec["amount"] * 100)); s = f"{minor:012d}"
    if rec["direction"] == "credit": s = s[:-1] + _OP[s[-1]]     # minor units + 12-wide + overpunch
    o["amount_wire"] = s
    o["currency_num"] = _CCY_NUM[rec["currency"]]                # ISO numeric
    d = datetime.date.fromisoformat(rec["value_date"])
    o["value_date_julian"] = f"{d.year:04d}{d.timetuple().tm_yday:03d}"  # Julian
    o["account_padded"] = rec["account"].rjust(10, "0")[-10:]    # zero-pad right-justified
    o["priority_code"] = str(rec["priority"]) if rec["priority"] is not None else "5"  # default 5
    o["method_code"] = _METHOD[rec["method"]]                    # 2-digit code
    o["purpose_code"] = rec["purpose"].upper().ljust(4)[:4]      # upper, 4-wide
    digits = "".join(c for c in (s+o["currency_num"]+o["value_date_julian"]) if c.isdigit())
    o["check"] = str(sum(int(c) for c in digits) % 10)           # mod-10 check
    return o
