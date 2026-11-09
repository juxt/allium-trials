# requirements-capture — run-002

arms: allium-elicit, spec-kit, superpowers, aiup, prose, tessl, kiro, bmad, openspec · tasks: loan-allocation, loan-schedule, savings-interest · iterations: 3 · mode: sequential · concurrency: 1
models: author=claude-opus · stakeholder=claude-sonnet · auditor=claude-opus · endpoint: http://localhost:4000/v1

## Per-arm summary

| arm | runs | coverage % (all) | coverage % (bespoke) | avg questions |
|---|---|---|---|---|
| allium-elicit | 9 | 89.7 | 87.2 | 22.4 |
| spec-kit | 9 | 48.4 | 29.9 | 5 |
| superpowers | 9 | 66.7 | 56.9 | 10.7 |
| aiup | 9 | 67.5 | 53.4 | 14.9 |
| prose | 9 | 60.3 | 48.9 | 8.8 |
| tessl | 9 | 66.7 | 57.8 | 9.3 |
| kiro | 9 | 69 | 58.8 | 12.3 |
| bmad | 9 | 70.6 | 63.5 | 14.8 |
| openspec | 9 | 72.2 | 62.2 | 11.2 |

## Per-cell results

| arm | task | iter | questions | captured | of | bespoke | of |
|---|---|---|---|---|---|---|---|
| allium-elicit | loan-allocation | 1 | 28 | 14 | 14 | 8 | 8 |
| allium-elicit | loan-allocation | 2 | 18 | 13 | 14 | 7 | 8 |
| allium-elicit | loan-allocation | 3 | 19 | 13 | 14 | 7 | 8 |
| spec-kit | loan-allocation | 1 | 5 | 6 | 14 | 1 | 8 |
| spec-kit | loan-allocation | 2 | 5 | 8 | 14 | 3 | 8 |
| spec-kit | loan-allocation | 3 | 5 | 7 | 14 | 1 | 8 |
| superpowers | loan-allocation | 1 | 10 | 11 | 14 | 6 | 9 |
| superpowers | loan-allocation | 2 | 7 | 9 | 14 | 3 | 8 |
| superpowers | loan-allocation | 3 | 7 | 11 | 14 | 6 | 8 |
| aiup | loan-allocation | 1 | 18 | 11 | 14 | 5 | 8 |
| aiup | loan-allocation | 2 | 9 | 9 | 14 | 3 | 8 |
| aiup | loan-allocation | 3 | 12 | 13 | 14 | 7 | 8 |
| prose | loan-allocation | 1 | 8 | 9 | 14 | 4 | 8 |
| prose | loan-allocation | 2 | 8 | 9 | 14 | 3 | 8 |
| prose | loan-allocation | 3 | 9 | 10 | 14 | 5 | 8 |
| tessl | loan-allocation | 1 | 8 | 9 | 14 | 3 | 8 |
| tessl | loan-allocation | 2 | 13 | 13 | 14 | 8 | 8 |
| tessl | loan-allocation | 3 | 7 | 11 | 14 | 5 | 8 |
| kiro | loan-allocation | 1 | 9 | 9 | 14 | 4 | 8 |
| kiro | loan-allocation | 2 | 16 | 12 | 14 | 6 | 8 |
| kiro | loan-allocation | 3 | 10 | 9 | 14 | 3 | 8 |
| bmad | loan-allocation | 1 | 15 | 12 | 14 | 6 | 8 |
| bmad | loan-allocation | 2 | 13 | 11 | 14 | 5 | 8 |
| bmad | loan-allocation | 3 | 16 | 13 | 14 | 7 | 8 |
| openspec | loan-allocation | 1 | 11 | 11 | 14 | 5 | 8 |
| openspec | loan-allocation | 2 | 13 | 13 | 14 | 7 | 8 |
| openspec | loan-allocation | 3 | 7 | 10 | 14 | 4 | 8 |
| allium-elicit | loan-schedule | 1 | 23 | 13 | 14 | 6 | 6 |
| allium-elicit | loan-schedule | 2 | 20 | 13 | 14 | 6 | 6 |
| allium-elicit | loan-schedule | 3 | 28 | 14 | 14 | 6 | 6 |
| spec-kit | loan-schedule | 1 | 5 | 9 | 14 | 2 | 6 |
| spec-kit | loan-schedule | 2 | 5 | 9 | 14 | 3 | 6 |
| spec-kit | loan-schedule | 3 | 5 | 8 | 14 | 2 | 6 |
| superpowers | loan-schedule | 1 | 13 | 10 | 14 | 3 | 6 |
| superpowers | loan-schedule | 2 | 7 | 9 | 14 | 3 | 6 |
| superpowers | loan-schedule | 3 | 6 | 8 | 14 | 2 | 6 |
| aiup | loan-schedule | 1 | 10 | 11 | 14 | 3 | 6 |
| aiup | loan-schedule | 2 | 15 | 9 | 14 | 2 | 6 |
| aiup | loan-schedule | 3 | 9 | 9 | 14 | 3 | 6 |
| prose | loan-schedule | 1 | 7 | 11 | 14 | 3 | 6 |
| prose | loan-schedule | 2 | 8 | 10 | 14 | 3 | 6 |
| prose | loan-schedule | 3 | 11 | 10 | 14 | 3 | 6 |
| tessl | loan-schedule | 1 | 7 | 10 | 14 | 3 | 6 |
| tessl | loan-schedule | 2 | 7 | 9 | 14 | 2 | 6 |
| tessl | loan-schedule | 3 | 8 | 10 | 14 | 4 | 6 |
| kiro | loan-schedule | 1 | 6 | 10 | 14 | 3 | 6 |
| kiro | loan-schedule | 2 | 9 | 10 | 14 | 3 | 6 |
| kiro | loan-schedule | 3 | 13 | 12 | 14 | 4 | 6 |
| bmad | loan-schedule | 1 | 12 | 10 | 14 | 3 | 6 |
| bmad | loan-schedule | 2 | 13 | 11 | 14 | 4 | 6 |
| bmad | loan-schedule | 3 | 12 | 8 | 14 | 3 | 6 |
| openspec | loan-schedule | 1 | 7 | 12 | 14 | 4 | 6 |
| openspec | loan-schedule | 2 | 11 | 11 | 14 | 4 | 6 |
| openspec | loan-schedule | 3 | 9 | 12 | 14 | 4 | 6 |
| allium-elicit | savings-interest | 1 | 21 | 10 | 14 | 6 | 10 |
| allium-elicit | savings-interest | 2 | 25 | 11 | 14 | 7 | 10 |
| allium-elicit | savings-interest | 3 | 20 | 12 | 14 | 8 | 10 |
| spec-kit | savings-interest | 1 | 5 | 4 | 14 | 3 | 10 |
| spec-kit | savings-interest | 2 | 5 | 5 | 14 | 3 | 10 |
| spec-kit | savings-interest | 3 | 5 | 5 | 14 | 3 | 10 |
| superpowers | savings-interest | 1 | 13 | 9 | 14 | 7 | 10 |
| superpowers | savings-interest | 2 | 17 | 9 | 14 | 7 | 10 |
| superpowers | savings-interest | 3 | 16 | 8 | 14 | 6 | 10 |
| aiup | savings-interest | 1 | 25 | 8 | 14 | 5 | 10 |
| aiup | savings-interest | 2 | 16 | 8 | 14 | 6 | 10 |
| aiup | savings-interest | 3 | 20 | 7 | 14 | 5 | 10 |
| prose | savings-interest | 1 | 11 | 6 | 14 | 5 | 10 |
| prose | savings-interest | 2 | 8 | 6 | 14 | 5 | 10 |
| prose | savings-interest | 3 | 9 | 5 | 14 | 4 | 10 |
| tessl | savings-interest | 1 | 13 | 9 | 14 | 6 | 10 |
| tessl | savings-interest | 2 | 13 | 7 | 14 | 6 | 10 |
| tessl | savings-interest | 3 | 8 | 6 | 14 | 5 | 10 |
| kiro | savings-interest | 1 | 14 | 8 | 14 | 7 | 10 |
| kiro | savings-interest | 2 | 10 | 8 | 14 | 6 | 10 |
| kiro | savings-interest | 3 | 24 | 9 | 14 | 7 | 10 |
| bmad | savings-interest | 1 | 13 | 8 | 14 | 5 | 10 |
| bmad | savings-interest | 2 | 24 | 8 | 14 | 6 | 10 |
| bmad | savings-interest | 3 | 15 | 8 | 14 | 7 | 10 |
| openspec | savings-interest | 1 | 17 | 7 | 14 | 6 | 10 |
| openspec | savings-interest | 2 | 15 | 10 | 14 | 7 | 10 |
| openspec | savings-interest | 3 | 11 | 5 | 14 | 3 | 10 |

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
| openspec | github.com/Fission-AI/OpenSpec (npm @fission-ai/openspec) — the authentic output of `openspec init --tools claude`, vendored verbatim (nothing added): the six opsx skills and commands under .claude/, plus the initialized openspec/ root (config.yaml, spec-driven schema). | verbatim |  |

Full transcripts and per-decision auditor reasoning: `logs/`. Machine-readable per-decision capture: `metadata.json`.
