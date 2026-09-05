# bech32-bugfix result — SATURATED (all arms 100%); an important activity finding

| arm | opus | sonnet |
|---|---|---|
| none | 100 | 100 |
| prose | 100 | 100 |
| v3 | 100 | 100 |
| v4 | 100 | 100 |

Even no-spec fixed the corrupted-polymod bug perfectly (6/6 both models). Contrast bech32-RECONSTRUCT
(hidden source) where no-spec was only 82% and bimodal on the same constants.

**The finding: a BUGFIX does not separate arms, because the buggy code is PRESENT.** The model has the
polymod function + the wrong constant in front of it, the symptom localises the bug, and it recognises the
correct (famous) constant to restore. The spec adds nothing it didn't already have from the code.

**Generalises the core law:** the spec's value as INPUT appears only when the intent is ABSENT — writing
code from scratch / reconstructing a hidden module. When editing VISIBLE code (bugfix, refactor, and mostly
feature-add), the code itself supplies the detail, so the spec-as-input gap collapses. This is why every
task that separated arms was a hidden-source reconstruct/port. For editing activities, the spec's value is
not as input but as a GATE (catching a regression the edit introduces) — the maintenance-time axis, which a
first-draft code-quality benchmark does not measure.
