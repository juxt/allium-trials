# Reference / absolute oracle — status + OCaml-natural design

## Status: the BASIC mechanism already exists (do not over-scope this)
An input-anchored ABSOLUTE invariant is already a first-class, working capability: an invariant that
ties an output to a reference INPUT is checked by the runtime monitor on concrete values. E7/E7-real
proved it — `interest(p) = rate * outstanding_start(p)` (with `rate` a `given`/trace field) CATCHES the
wrong-rate value mutant (114/120 real traces) that a relations-only spec misses. Nonlinear is fine at
runtime (only static `analyse` is limited). So "value bugs are uncatchable" is FALSE: write the
absolute invariant and emit the reference input (deficiency D3: don't silently skip; emit inputs).

## The genuine ADDITION: reusable pure functions (the reference model), OCaml-natural
When the reference law is complex or reused across invariants, inlining it into each invariant is
clumsy. OCaml's answer — and the natural v4 form — is a PURE FUNCTION definition. Proposed construct,
sitting beside `given`/`observable state` and reading like the rest of v4:

    component LoanSchedule
      given rate : Rate
      -- a pure reference function (no state, total, deterministic): the oracle
      let expected_interest(bal) = rate * bal
      let expected_principal(emi, bal) = emi - expected_interest(bal)
      observable state interest(Period) : Money
      observable state outstanding_start(Period) : Money
      invariant interest_correct means every p ::
        interest(p) = expected_interest(outstanding_start(p))
    end

Semantics (natural in v4): `let f(x, y) = e` is a total pure function over the value domain; it may
reference `given`s and other `let`s (no recursion in v0, matching the bounded/decidable spirit); a call
`f(a, b)` denotes `e[x:=a, y:=b]`. It is NOT observable state (no trace field); it is a definition.

## Implementation sketch (5 localized touch-points; ~half a focused session, do it TESTED)
1. lexer: `let` keyword (currently an Ident).
2. parser/AST: a `Definition { name, params, body: Expr }` item; parse `let name(params) = <predicate-expr>`.
3. name-resolution (check.rs): add def names to scope; check each body's free names against its params +
   givens (reuse resolve_names).
4. eval (monitor.rs + arith.rs): resolve a call `f(args)` by substituting params->args into the body
   Expr and evaluating (a pre-eval inlining pass keeps the eval core unchanged — lowest risk). Guard
   against recursion (finite inlining).
5. tests: RED first — `let expected_interest(bal)=rate*bal` + `interest=expected_interest(bal)` catches
   a wrong-interest trace and holds on a correct one; a benign refactor still holds.

Why inlining: it reuses the existing expression evaluator (which already handles arithmetic over trace
values and the nonlinear-at-runtime case), so no new eval semantics — just an AST rewrite. Keeps the
addition small, natural, and verifiable.

## Recommendation
Ship the `let` construct next session with tests (RED->GREEN), then re-run the E7 wrong-rate mutant
using a `let expected_interest` oracle end-to-end. The capability's VALUE is already demonstrated (E7);
`let` makes it ergonomic and composable without changing v4's feel.

## SHIPPED (P3c) — implemented via the existing `means` definitional form, not a new construct
The reference oracle is DONE and TESTED, and it needed NO new syntax: v4 already parses
`given f(params) means body` (a defined given). The only gap was EVAL — the monitors didn't inline the
call. Added `inline_defs`/`substitute` (a pre-eval pass) in monitor.rs, applied in BOTH `monitor` and
`monitor_schedule`. So `given expected_interest(bal) means rate * bal` + `invariant interest_ok means
every p :: interest(p) = expected_interest(outstanding_start(p))` now inlines to `rate *
outstanding_start(p)` and CATCHES the wrong-rate value bug (residual 10; witness shows the inlined
expression). Test: reference_oracle_defined_given (51 allium-v4 tests pass). This is the OCaml `let f x
= e` idea expressed maximally naturally in v4 (reusing `means`), closing the E2 value-blindness
constructively. Not yet done: full trace/implementation refinement; recursion in definitions (v0 is
inline-only, non-recursive).
