# Static-analysis soundness gauntlet

The master `reproduce.py` guards the **monitor** (runtime traces). This directory guards the **static
analyser** (`allium analyse`) — the layer where an unsound preservation pass was built and reverted on
2026-09-02, and where four more verdict issues were later found. Each specimen carries a known-correct
verdict; `guard.py` runs `allium analyse` on each and asserts the verdict matches. It is wired into
`reproduce.py`, so `python3 reproduce.py` covers both layers.

Run it directly:

```
python3 guard.py      # exit 0 = every verdict matches
```

## Verdicts

A specimen's verdict is read from the analyser's diagnostics:

| Verdict | Meaning |
|---|---|
| `CLEAN`  | no break/violation finding and no parse error — a sound analyser stays silent |
| `BREAK`  | a real preservation break is caught (`can break` / `does not establish`) |
| `ERROR`  | a malformed spec is rejected, not mis-parsed |
| `SAT`    | a component genuinely satisfies its contract |
| `NOSAT`  | a component that does **not** satisfy its contract is refused (the false-certification direction) |
| `INFEAS` | contradictory invariants are flagged |
| `DEAD`   | an enum value never produced is flagged unreachable |
| `NODECL` | (tripwire) a cross-module contract currently reads as undeclared |

The `CLEAN` cases matter most: they are the interacting shapes that expose **false positives**.
`trap_monotone_overwrite` is the exact pattern that broke the reverted relational pass.

## What the gauntlet found

Built by adversarial mixed specimens the corpus lacked. Two bugs were fixed, two filed:

- **Fixed** — a second `ensures` clause was silently dropped (only the first parsed); the boolean literal
  `= true` was encoded as a free SAT atom, manufacturing false breaks.
- **Filed** — cross-module `given`/contract resolution (#61); `in { }` guards not preservation-checked
  (#63). Both have **tripwire** specimens in `xmod/` and here: they are pinned to today's (wrong) verdict
  with a `TODO(#nn)` note, so when the fix lands the verdict flips and `guard.py` fails — the signal to
  update the manifest.

## Adding a specimen

Add a `.allium` file with a header comment stating what it tests and its expected verdict, then add a row to
`CASES` in `guard.py`. Keep each specimen focused on **one** verdict — an incidental dead-state or arithmetic
break will shadow the verdict you meant to test (several specimens here were trimmed for exactly that).
