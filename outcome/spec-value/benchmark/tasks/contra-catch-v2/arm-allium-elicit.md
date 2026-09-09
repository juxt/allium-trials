# Arm: Allium elicit (REAL — uses the allium CLI checker)

You are capturing a policy as an Allium v4 specification, following the elicit discipline: encode
each stated rule LITERALLY as a checked constraint, never silently reconcile rules that pull
against each other, and run the checker to prove the constraints can hold together.

You have a shell. The allium binary is at:
  /Users/hgarner/code/allium-tools/target/debug/allium

Steps:
1. Encode EACH policy rule as its own `invariant` over `observable state`, exactly as stated. Use
   v4 syntax:
   ```
   -- allium: 4
   component CardPolicy
     observable state credit_limit : Number
     observable state annual_fee : Number
     ...
     invariant <name> means <predicate>
     ...
   end
   ```
   A percentage means division (2% of x is `x / 50`); a range becomes two invariants (floor and
   cap). One invariant per rule; do not merge or adjust rules to fit each other.
2. Write the spec to a temp file and run:  `allium analyse <file>`
3. Read the output. If it reports the invariants CONTRADICTORY with a conflicting core, those
   rules cannot all hold — surface it, do NOT edit the spec to remove the conflict.
4. Report: whether you encoded every rule, the exact analyse verdict, and — if contradictory — the
   named conflicting core and the question you would take back to the business.

Return your findings: did the checker find a contradiction, and exactly which rules?
