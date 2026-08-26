# Trial C result — comprehension (ledger)

**code-only 100%, spec-aided 100%** (8/8 each, judged vs the hidden ground truth).
Model `claude-sonnet-4-6`, 2026-08-26. Reproduce: `node outcome/trial-c.mjs`.

On a system this small and readable, an agent answers every behavioural question
(invariants, atomicity, failure modes) correctly from the code alone, so the distilled
spec adds nothing measurable. A ceiling effect, not a null result about Allium.

Where comprehension differentiation must come from:
- **A harder / larger system**, where code-only comprehension degrades and a spec that
  states the invariants plainly starts to pay off.
- **The v4-analyse-aided arm** (stubbed here): v4's deeper analyse should surface
  non-obvious invariants and failure modes that neither the code nor a plain distilled
  spec makes explicit. That arm needs the v4 analyse layer (4c) and is where v4 must beat
  v3. This run establishes the measure and the v3 baseline.
