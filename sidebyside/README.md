# v3-vs-v4 side-by-side

Runs the Allium binary's two language pipelines against matched specs and prints
the diagnostics side by side. The binary carries both v3 and v4, dispatched on the
`-- allium: N` header, so one binary is both contestants — the allium-trials
"one referee, many contestants" principle applied to the language itself.

```
node sidebyside/run.mjs          # ALLIUM_BIN overrides the binary path
```

Each `pairs/<name>/` holds the same system in both surfaces: `v3.allium` and
`v4.allium`. Add a pair by dropping a matched directory in.

## Scope

Today the comparison is at the **check level**: parse-error ergonomics,
well-formedness, and name resolution — the dimensions where v3 and v4 are
genuinely comparable now. It deliberately does **not** compare verdicts yet: the
v4 analyse layer (discharge / the diagnostic contract, phase 4c) is not built, so
a verdict comparison would misrepresent v4. Once 4c lands, the runner grows a
verdict lane, which is where v4's diagnostic contract (localisation, residual,
the three-axis status, honest silence) is expected to beat v3.

## Reading the first results

- **syntax-error** — both pipelines localise the parse error, in their own words.
- **lifecycle** — both well-formed; v3 adds an unused-entity note.
- **undeclared-name** — both well-formed at the top level, but v4's name
  resolution flags the undeclared `undeclared_helper` that v3 does not. An early,
  concrete v4 diagnostic that v3 misses.

This is a starting point, not a verdict on the languages. The point is that the
comparison now *runs*, reproducibly, and gets richer as v4 grows.
