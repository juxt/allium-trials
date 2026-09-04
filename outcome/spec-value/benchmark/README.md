# The Allium spec-value benchmark

A persistent, named suite of evals comparing three ways to carry a real coding task through to correct
code: **ProSpec** (a prose specification), **V3** (Allium v3), and **V4** (Allium v4). Tasks are built on
**real Apache Fineract code**, and scored by **differential testing against the real behaviour** (Fineract's
own golden values), so the score is code-level and cannot be gamed by adding language features.

## How to run a task

Each task lives in `tasks/<slug>/` and is self-contained. To run one:

```
Workflow({ scriptPath: "tasks/<slug>/eval.wf.js" })
```

It fans out fresh agents for each arm, scores every run against `tasks/<slug>/golden.json`, and returns a
per-arm result. Re-runnable, deterministic oracle. `golden.json` for each task is generated from the real
Fineract source by that task's `golden_generator.java` (compile the real class standalone, run it).

## Task types

- **reconstruct** — distil a spec from a real module, hide it, rebuild from the spec, diff vs real.
- **feature** — add a feature to a real module; oracle scores the feature + preserved existing behaviour.
- **change** — change an existing behaviour deliberately; oracle scores the change + no collateral regression.
- **port** — reimplement a real module in another language; diff vs real.
- **gate** — plant a realistic regression; measure whether each arm's spec/check CATCHES it.

## Task index

See `TASKS.md` for the live registry with slugs, types, and the authentic Fineract quirk each scores.

## What the results say so far (read `CONCLUSION.md` in full)

Six runs in, the honest picture: **first-draft code quality is flat across ProSpec / V3 / V4 for a strong
model** — a capable model given the obligation in any form writes correct code. Reconstruction-fidelity is
*retired* as an instrument because it rewards transcription and structurally favours prose. The real,
measured spec value is (1) writing the obligation down at all (no-spec → spec), and (2) the **checkable
gate** — the one clean V4-only win is p7, where a V4 objective generates an anti-vacuity test V3 has no
construct to express. Assurance ("proved over all cases") and durability ("the gate catches drift when
intent is lost across edits") are that same axis, and the **gate** task type is the honest home for it.

This suite is built to give *falsifiable* answers. It has already inverted one hypothesis of ours
(`fineract-amortization`: prose beat V4 on a numerical algorithm). That is the point: publishable because it
can be wrong.
