# requirements-capture — run-001

arms: allium-elicit, spec-kit, superpowers, aiup, prose, tessl, kiro, bmad · tasks: loan-allocation, loan-schedule, savings-interest · iterations: 3 · mode: parallel · concurrency: 2
models: author=claude-opus · stakeholder=claude-sonnet · auditor=claude-opus · endpoint: http://localhost:4000/v1

## Per-arm summary

| arm | runs | coverage % (all) | coverage % (bespoke) | avg questions |
|---|---|---|---|---|
| allium-elicit | 9 | 91.3 | 85.9 | 22 |
| spec-kit | 9 | 65.9 | 54.2 | 13.4 |
| superpowers | 9 | 62.7 | 52.5 | 9.6 |
| aiup | 9 | 70.6 | 60.5 | 13.7 |
| prose | 9 | 65.1 | 54.2 | 8.9 |
| tessl | 9 | 61.9 | 54.5 | 6.9 |
| kiro | 9 | 63.5 | 50.4 | 9.8 |
| bmad | 9 | 68.3 | 55.6 | 14 |

## Per-cell results

| arm | task | iter | questions | captured | of | bespoke | of |
|---|---|---|---|---|---|---|---|
| allium-elicit | loan-allocation | 1 | 28 | 14 | 14 | 8 | 8 |
| allium-elicit | loan-allocation | 2 | 20 | 11 | 14 | 5 | 8 |
| allium-elicit | loan-allocation | 3 | 18 | 13 | 14 | 7 | 8 |
| spec-kit | loan-allocation | 1 | 11 | 11 | 14 | 5 | 8 |
| spec-kit | loan-allocation | 2 | 11 | 10 | 14 | 4 | 8 |
| spec-kit | loan-allocation | 3 | 18 | 12 | 14 | 6 | 8 |
| superpowers | loan-allocation | 1 | 5 | 8 | 14 | 3 | 8 |
| superpowers | loan-allocation | 2 | 11 | 13 | 14 | 7 | 8 |
| superpowers | loan-allocation | 3 | 6 | 8 | 14 | 3 | 8 |
| aiup | loan-allocation | 1 | 15 | 11 | 14 | 5 | 8 |
| aiup | loan-allocation | 2 | 11 | 11 | 14 | 5 | 8 |
| aiup | loan-allocation | 3 | 11 | 10 | 14 | 5 | 8 |
| prose | loan-allocation | 1 | 8 | 10 | 14 | 5 | 8 |
| prose | loan-allocation | 2 | 10 | 13 | 14 | 7 | 8 |
| prose | loan-allocation | 3 | 8 | 9 | 14 | 3 | 8 |
| tessl | loan-allocation | 1 | 8 | 11 | 14 | 5 | 8 |
| tessl | loan-allocation | 2 | 3 | 8 | 14 | 3 | 8 |
| tessl | loan-allocation | 3 | 5 | 8 | 14 | 3 | 8 |
| kiro | loan-allocation | 1 | 8 | 9 | 14 | 3 | 8 |
| kiro | loan-allocation | 2 | 11 | 10 | 14 | 4 | 8 |
| kiro | loan-allocation | 3 | 8 | 11 | 14 | 5 | 8 |
| bmad | loan-allocation | 1 | 12 | 12 | 14 | 6 | 8 |
| bmad | loan-allocation | 2 | 14 | 11 | 14 | 5 | 8 |
| bmad | loan-allocation | 3 | 15 | 11 | 14 | 5 | 8 |
| allium-elicit | loan-schedule | 1 | 21 | 13 | 14 | 5 | 6 |
| allium-elicit | loan-schedule | 2 | 14 | 14 | 14 | 6 | 6 |
| allium-elicit | loan-schedule | 3 | 22 | 14 | 14 | 6 | 6 |
| spec-kit | loan-schedule | 1 | 14 | 8 | 14 | 3 | 6 |
| spec-kit | loan-schedule | 2 | 11 | 9 | 14 | 2 | 6 |
| spec-kit | loan-schedule | 3 | 13 | 10 | 14 | 4 | 6 |
| superpowers | loan-schedule | 1 | 9 | 9 | 14 | 3 | 6 |
| superpowers | loan-schedule | 2 | 10 | 7 | 14 | 3 | 6 |
| superpowers | loan-schedule | 3 | 5 | 10 | 14 | 3 | 6 |
| aiup | loan-schedule | 1 | 11 | 11 | 14 | 3 | 6 |
| aiup | loan-schedule | 2 | 12 | 11 | 14 | 3 | 6 |
| aiup | loan-schedule | 3 | 15 | 10 | 14 | 4 | 6 |
| prose | loan-schedule | 1 | 9 | 12 | 14 | 4 | 6 |
| prose | loan-schedule | 2 | 9 | 9 | 14 | 2 | 6 |
| prose | loan-schedule | 3 | 6 | 10 | 14 | 3 | 6 |
| tessl | loan-schedule | 1 | 7 | 14 | 14 | 6 | 6 |
| tessl | loan-schedule | 2 | 6 | 8 | 14 | 2 | 6 |
| tessl | loan-schedule | 3 | 6 | 9 | 14 | 3 | 6 |
| kiro | loan-schedule | 1 | 8 | 9 | 14 | 3 | 6 |
| kiro | loan-schedule | 2 | 7 | 8 | 14 | 2 | 6 |
| kiro | loan-schedule | 3 | 11 | 9 | 14 | 3 | 6 |
| bmad | loan-schedule | 1 | 15 | 11 | 14 | 3 | 6 |
| bmad | loan-schedule | 2 | 13 | 11 | 14 | 4 | 6 |
| bmad | loan-schedule | 3 | 9 | 8 | 14 | 2 | 6 |
| allium-elicit | savings-interest | 1 | 28 | 12 | 14 | 8 | 10 |
| allium-elicit | savings-interest | 2 | 24 | 11 | 14 | 7 | 10 |
| allium-elicit | savings-interest | 3 | 23 | 13 | 14 | 9 | 10 |
| spec-kit | savings-interest | 1 | 13 | 8 | 14 | 5 | 10 |
| spec-kit | savings-interest | 2 | 16 | 9 | 14 | 7 | 10 |
| spec-kit | savings-interest | 3 | 14 | 6 | 14 | 3 | 10 |
| superpowers | savings-interest | 1 | 7 | 5 | 14 | 3 | 10 |
| superpowers | savings-interest | 2 | 17 | 10 | 14 | 7 | 10 |
| superpowers | savings-interest | 3 | 16 | 9 | 14 | 6 | 10 |
| aiup | savings-interest | 1 | 15 | 8 | 14 | 6 | 10 |
| aiup | savings-interest | 2 | 18 | 9 | 14 | 7 | 10 |
| aiup | savings-interest | 3 | 15 | 8 | 14 | 6 | 10 |
| prose | savings-interest | 1 | 12 | 6 | 14 | 5 | 10 |
| prose | savings-interest | 2 | 11 | 7 | 14 | 5 | 10 |
| prose | savings-interest | 3 | 7 | 6 | 14 | 5 | 10 |
| tessl | savings-interest | 1 | 8 | 7 | 14 | 6 | 10 |
| tessl | savings-interest | 2 | 8 | 5 | 14 | 5 | 10 |
| tessl | savings-interest | 3 | 11 | 8 | 14 | 6 | 10 |
| kiro | savings-interest | 1 | 12 | 8 | 14 | 6 | 10 |
| kiro | savings-interest | 2 | 10 | 8 | 14 | 5 | 10 |
| kiro | savings-interest | 3 | 13 | 8 | 14 | 6 | 10 |
| bmad | savings-interest | 1 | 16 | 6 | 14 | 5 | 10 |
| bmad | savings-interest | 2 | 19 | 9 | 14 | 6 | 10 |
| bmad | savings-interest | 3 | 13 | 7 | 14 | 4 | 10 |

## Arm provenance

| arm | version / source | fidelity | sha256 |
|---|---|---|---|
| allium-elicit | elicit skill, Allium 3.16.0 (official release), verbatim. | verbatim | cdafcd7f0360… |
| spec-kit | github.com/github/spec-kit — the authentic output of `specify init --integration claude` (its speckit-* Claude skills and .specify/ scripts + templates), vendored verbatim (nothing added). | verbatim |  |
| superpowers | github.com/obra/superpowers — skills/brainstorming/SKILL.md, verbatim (nothing added). | verbatim | a32d22553547… |
| aiup | github.com/AI-Unified-Process/marketplace — aiup-core/skills/requirements, entity-model, use-case-diagram, use-case-spec (+ docs/templates/vision.md), vendored verbatim (nothing added). | verbatim |  |
| prose | none — this is the control arm, a capable engineer with no tool or discipline | baseline |  |
| tessl | github.com/tesslio/spec-driven-development-tile — skills/requirement-gathering/SKILL.md, verbatim (nothing added). | verbatim | 8d6aaf57eb12… |
| kiro | Kiro Spec agent system prompt, the '### 1. Requirement Gathering' block, extracted from the shipped Kiro agent bundle (AWS does not publish it). Corroborated character-for-character by two independent extractions. | verbatim | cd304719957d… |
| bmad | github.com/bmad-code-org/BMAD-METHOD — skills/bmad-agent-analyst, skills/bmad-prd, skills/bmad-advanced-elicitation, vendored verbatim (nothing added). | verbatim |  |

Full transcripts and per-decision auditor reasoning: `logs/`. Machine-readable per-decision capture: `metadata.json`.
