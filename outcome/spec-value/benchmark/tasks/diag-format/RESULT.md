# diag-format — result: fix-SUCCESS is a NULL across formats (at normal scale)

Three seeded defects (undeclared name, wrong reference, contradiction) in a real 91-line v4 spec.
Each real diagnostic rendered three ways — raw (byte span, current), located (line + construct
name), actionable (problem/fix split + target excerpt). Tool-using fixer, own copy, checker re-run
= oracle. Opus + Sonnet, N=2 → 36 cells.

| format | fix-success | Opus | Sonnet |
|---|---|---|---|
| raw (byte span) | 100% | 6/6 | 6/6 |
| located (line + name) | 100% | 6/6 | 6/6 |
| actionable (excerpt + problem/fix) | 100% | 6/6 | 6/6 |

**Every cell cleared.** At this spec size, diagnostic format does not affect whether an LLM can fix
the spec. A capable fixer reads the file and resolves the defect no matter how the diagnostic is
shaped. This is a genuine null on the *success* axis, and it should temper any urge to redesign the
format for "actionability" in the fix-it-works sense.

## Two honesty caveats that bound the null

1. **The harness forced file access.** The fixer was told to `cp` the spec and edit it, so it always
   opened the file. That neutralises the *actionable* arm's main potential advantage — fixing from a
   self-contained diagnostic (excerpt in hand) WITHOUT a read. The excerpt/problem/fix format is
   designed to save a round-trip; this test never let it. So the null is "success is equal when the
   fixer opens the file anyway", not "the richer format is worthless".
2. **91 lines is small.** Locating one construct among ~15 is trivial for either model. Format should
   matter more where locating is real work (hundreds of lines, many components) and where a byte span
   can cause MISlocation. Not tested here.

So the untested places where format could still pay are **efficiency** (tokens/turns to fix — a
self-contained diagnostic may avoid reads) and **scale** (large specs where precise location
prevents mislocation). Neither is fix-success, which is saturated.

## What the investigation DID establish (independent of the null)

Concrete defects in the current output, verified on real diagnostics — these are correctness /
consistency issues, and they matter for PROGRAMMATIC consumption (a skill branching on diagnostics),
not for one-shot fix success:

- v4 diagnostics uniformly serialize raw: `{message, severity:"Warning", span:{start,end}}` — **no
  `code`, no `location`**, from both `check` and `analyse`. The nicer `diagnostic_to_json`
  (code + file/line/col) exists but is not wired for v4.
- The contradiction finding carries **span `{0,0}`** — no location at all.
- Name-resolution warnings are emitted **duplicated** (D2: the same warning twice).
- A malformed predicate (`emi(p) = = emi(q)`) produced **zero diagnostics** — broken syntax slips
  through unflagged. A checker gap, separate from formatting.

## Recommendation

1. **Do not redesign the format to raise fix-success** — the data says it does not move at normal
   scale. Drop that as a justification.
2. **Do fix the correctness/consistency defects** (cheap, real): unify the serializer so every
   diagnostic and finding shares one schema; add a stable `code`; give findings a `location` (kill
   `span:{0,0}`); dedupe name-resolution warnings. These help programmatic consumers regardless of
   the fix-success null.
3. **The message voice fix is still worth it** (em-dashes, run-on problem+fix) for readability and
   clean parsing — cheap, low-risk.
4. **If we want to justify the richer target/excerpt format, measure the axes this test saturated:**
   efficiency (tokens/turns, and fixing WITHOUT opening the file) and scale (a 300+ line multi-
   component spec). Only run that if efficiency at scale is a real concern.
