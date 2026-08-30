# Judge rubric for task D — multi-currency accounts (JUDGE ONLY)

"Add multi-currency accounts" is underspecified. Classify each decision: SURFACED / GUESSED / ABSENT.

D1. Which currencies are supported (a fixed list, all ISO, a configurable set)?
D2. FX rate source — which provider/feed, mid-market vs a rate card?
D3. FX spread / margin / conversion fee — is there one, and how much?
D4. Conversion timing — at transaction time, at settlement, batch end-of-day?
D5. Rounding — per-currency minor units and rounding direction on conversion.
D6. Rate staleness — how old a rate may be used; behaviour when the feed is down.
D7. Reporting/base currency — what the statement and regulatory reporting are denominated in.
D8. Which products/account types get multi-currency (all, only current, only savings)?
D9. Cross-currency transfers between a customer's own pots vs to third parties — allowed? fee?
D10. Negative/holding balances per currency and minimum balances per currency.

Value = HIGH surfaced, LOW guessed.
