# Programme 5 — session summary (extensibility, ratification, generality)

Frame (human): general-purpose language EXTENSIBLE in types + functions; assess core-expansion vs
extensibility; amass evidence, ratify constructs at the end. Everything below is executable/tested.

## Headline: the extensible design is largely IN PLACE — reserve core growth for primitives/substrate
1. FUNCTIONS are user-extensible, PROVEN. `given f(args) means <if/then/else + arithmetic + comparison>`
   defines functions; `use "std.allium"` imports a shared library; both check AND monitor resolve them.
   Demonstrated: min/max/clamp/abs/sign are USER-DEFINABLE and compose — they need NOT be core built-ins.
   Shipped: use-loading (monitor + check), std.allium prelude. => SHRINK the core (demote min/max).
2. TYPES: open currency/unit tags already extensible + sufficient for the corpus (Money(gbp)!=Money(usd)
   caught). New numeric FAMILIES have a known mechanism (`dimension` decl) but NO corpus specimen demands
   one -> deferred per corpus-before-grammar.
3. EVALUATION SUBSTRATE (exact decimal): the ONE genuine core-growth need (a tolerance-free, penny-exact
   audit gate). Specced; deferred on ROI (invasive f64->Rat, ~4% rounding-tie edge).

## Constructs this session (P4+P5), with evidence — for ratification (see RATIFICATION-DOSSIER.md)
RATIFY as CORE: `/` division (value-drift catch 0->144/144 real traces), if/then/else (tiers + enables
the stdlib), round (money precision), temporal before/precedes (12/12 ordering mutants), given-means +
use-import (the extensibility mechanism). DEMOTE to stdlib: min/max (+abs/clamp/sign). 57 v4 tests pass.

## Generality: the enriched language handles a real product (showcase)
A tiered-loan spec using division + if/then/else tiers + stdlib-imported min (capped fee) + reference
defs, monitored: wrong-tier -> interest_tiered CAUGHT; uncapped fee -> fee_capped CAUGHT; benign passes.
Extensibility + constructs compose into a real-product gate.

## Backlog status: A (extensibility) done; enabler (use-loading) done; B (ratification) done; C (showcase)
done; D (exact-decimal) assessed+specced+deferred; E1 (check-imports gap) fixed. Open: exact-decimal
substrate (specced), `dimension` type-extensibility (deferred per corpus), given-body name-resolution
(minor gap noted).

## For the human
The strategic answer: v4 is ALREADY substantially extensible (functions via given-means+use; types via
open tags). The data says STOP growing the core with library functions and RESERVE core growth for
genuine primitives (division, if/then/else, round, temporal — all ratifiable) and the substrate (exact
decimal). Ratify the constructs; demote min/max; decide whether to build exact-decimal (tol-free gate)
and `dimension` types (only if the general-purpose goal outranks corpus discipline).
