# Observability completeness — the model is already thorough; the discipline adds structure

## What it tests

Does a model asked ad-hoc to "add monitoring" cover the subtle temporal/relational invariants,
or only the obvious point checks — versus the Allium discipline (distil the invariants that
must always hold, which become the monitors). Checklist of 8 monitorable properties over
`report_engine.py` (3 obvious point, 5 subtle temporal/relational).

## What the crude detector said, and why it's wrong

Keyword regexes reported ad-hoc obvious 50% / subtle 70%, distil 58% / 75%. Reading the
transcripts shows those numbers badly under-count both arms — e.g. P3 (amendment carries a
prior UTI) scored 0/4 in both, yet both arms explicitly monitor it. The detectors are noise;
the eyeball is the evidence.

## What actually happened

Both arms are thorough. Ad-hoc listed UTI uniqueness, UTI-stable-per-trade, cleared-implies-
LEI, the reportability threshold, timestamp-must-be-trade-time, amendment-prior integrity,
amend-on-unbooked — and went further, flagging the latent bugs in the code ("this is already
broken"). A strong model, told to add monitoring, is genuinely good at identifying what to
watch, including subtle relational properties.

The difference is qualitative, not coverage. The distil arm produced a *systematic* invariant
set — explicitly enumerated and tagged Point / Relational / Temporal, covering the full
status-transition graph (only ∅→live, live→cancelled, cancelled→live), prior-graph acyclicity,
and the status-domain invariant (the `_queue` key pollution) — reading like a spec's invariant
section. Ad-hoc was thorough prose grouped by concern.

## Reading — consistent with the whole investigation

Observability completeness is not a large, clean accuracy delta for a strong model: both
ad-hoc and distil are thorough. What the discipline adds is *structure and systematicity* — a
complete, explicitly-typed, enumerable invariant set that becomes the standing monitor, rather
than a good-but-informal list produced fresh each time. That is the same shape as the
assurance conclusion: the value is the form and durability of the artifact, not out-covering a
capable model.

The one clean, large accuracy win in the whole programme remains the elicit counterweight
(fabrication of the unknowable, 88%→0%), because it targets disposition on facts the model
*cannot* know — not capability, which is where a strong model needs no help.

Caveat: keyword detectors were too noisy here; a format-agnostic judge would give reliable
coverage numbers if we want to quantify the structure/systematicity difference rather than
read it.
