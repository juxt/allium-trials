# Core vs extensibility — a data-driven boundary (Programme 5)

Question (human): build a GENERAL-PURPOSE language EXTENSIBLE in types and functions. Expand the core,
or give users ways to contribute (like rational)? Extensible > complete-in-the-box.

## The boundary, tested executably
The extensibility mechanism ALREADY EXISTS: `given f(args) means <expr>` defines a pure function; with
`if/then/else` + comparison + arithmetic it is expressive enough to define, IN USER SPACE, the functions
I had been adding to the core:

USER-DEFINABLE (belong in a STDLIB, NOT the core) — proven end-to-end (check clean, monitored, compose):
- `given umin(a,b) means if a < b then a else b`   (min)
- `given umax(a,b) means if a > b then a else b`   (max)
- `given uclamp(x,lo,hi) means umax(lo, umin(x,hi))` (clamp — composes user functions, inlines correctly)
- `given uabs(x) means if x < 0 then 0 - x else x`  (abs)  — verified: abs(-40)=40 holds.
- `usign`, and by the same means: ceil-from-floor, and domain functions (fees, day-count, pro-rata).

NOT USER-DEFINABLE (genuine CORE primitives — no recursion, no fractional-part extraction otherwise):
- arithmetic `+ - * /`, comparisons, `if/then/else`, quantifiers/`sum`, temporal `old`/`before`,
- the extensibility mechanism itself (`given f means e`),
- and ONE fractional/rounding primitive: `floor` (or `round`). `round` cannot be defined from the above
  (tested: `floor(...)` silently fails, monitored 0). From `floor`, users derive round/ceil/trunc.

## Recommendation (for ratification)
1. Keep the CORE minimal: the primitives above. This is the general, extensible substrate.
2. DEMOTE min/max (I shipped them as built-ins this session) to a STDLIB of `given` definitions — they
   are user-definable and add nothing as core. Keep `round` OR replace with a `floor` primitive + stdlib
   round/ceil. (A data-driven argument to SHRINK, not grow, the built-in surface.)
3. ENABLER (the one missing piece for real extensibility): cross-module `use` currently PARSES but does
   not LOAD definitions ("cross-module resolution parked"). Implement stdlib loading so a shared file of
   `given` definitions can be imported and used — that is what turns "user-definable in one file" into "a
   contributable standard library". Prototyping next.
4. CHECKER GAP found: `given`-definition BODIES are not name-resolved (a `floor` typo in a given-body
   slips through unflagged). Resolve given-bodies too.

## Types (extensibility, second axis)
- DIMENSIONS are already open/extensible: `Money(gbp)`, `Money(usd)`, `Mass(kg)` — arbitrary nominal
  tags, users pick currencies/units freely (SD-1 phantom tags).
- TYPE FAMILIES are fixed (money/rate/mass/...): a genuinely new numeric family (e.g. a rational/decimal
  NUMBER type for penny-exact arithmetic) is NOT user-addable. This is where "rational" actually lives:
  not a function but a TYPE. So the rational question = TYPE extensibility, the harder axis.
