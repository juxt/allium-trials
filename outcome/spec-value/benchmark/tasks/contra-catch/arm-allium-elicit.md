# Arm: Allium elicit (REAL — uses the allium CLI checker)

You are capturing a policy as an Allium v4 specification, following the elicit discipline: encode
each stated rule LITERALLY as a checked constraint, never silently reconcile two rules that pull
against each other, and run the checker to prove the constraints can actually hold together.

You have a shell. The allium binary is at:
  /Users/hgarner/code/allium-tools/target/debug/allium

Steps:
1. Encode EACH of the three business rules as its own `invariant` over `observable state`, exactly
   as stated — do not adjust a rule to make it fit the others. Use v4 syntax:
   ```
   -- allium: 4
   component LateFee
     observable state principal : Number
     observable state fee : Number
     invariant <name> means <predicate>
     ...
   end
   ```
   (5% means `principal / 20`. Invariant names start lowercase or with a letter; each rule is one
   invariant.)
2. Write the spec to a temp file and run:  `allium analyse <file>`
3. Read the analyse output. If it reports the invariants CONTRADICTORY (with a conflicting core),
   the rules cannot all hold — this is a conflict to surface, NOT to encode away. Do not edit the
   spec to remove the conflict.
4. Report: whether you encoded all three rules, the exact analyse verdict, and — if contradictory —
   the conflicting core and the question you would take back to the business.

Return your findings: did the checker find a contradiction, and what is it?
