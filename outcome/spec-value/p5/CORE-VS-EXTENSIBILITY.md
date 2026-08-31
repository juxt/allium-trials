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

## The rational question, resolved: three distinct layers (data-driven)
Extensibility is not one thing. The evidence separates three layers with DIFFERENT answers:

1. FUNCTIONS (min/max/clamp/abs/round-logic/domain helpers) — USER-EXTENSIBLE. Proven: definable via
   `given f means <if/then/else + arithmetic + comparison>`, importable via `use "std.allium"`, composes,
   monitors. The core must NOT grow here; ship a stdlib. (Done: std.allium prelude + use-loading.)

2. EVALUATION SUBSTRATE (exact decimal / rational number representation) — CORE, NOT extensible. You
   cannot make arithmetic penny-exact from user-space definitions: it is about how numbers are
   REPRESENTED during evaluation, which sits BELOW the language. The monitor currently evaluates in f64,
   so decimal ties (8.325) can round the "wrong" way vs BigDecimal. The fix is a core change: evaluate
   money arithmetic in exact rationals (the LRA already has a `Rat` type). This is the ONE place
   "expand the core" is the right answer — because it is the substrate, not a library.

3. TYPE FAMILIES / DIMENSIONS — PARTLY EXTENSIBLE ALREADY. Currencies/units are open nominal tags
   (`Money(gbp)`, `Mass(kg)`), users pick freely. A genuinely NEW type KIND with its own algebra
   (typeclass/trait-style user-defined types + operations) is the frontier — a future big feature, not
   needed for banking now.

So the answer to "expand core vs let users contribute rational": rational-the-EXACT-ARITHMETIC is a CORE
substrate improvement (do it in the core); rational-as-a-user-TYPE is the frontier (defer). Functions are
already extensible and should NOT bloat the core. Net: a SMALL core (primitives + exact-decimal
substrate) + a contributable function stdlib + open dimensions = the general, extensible design.
