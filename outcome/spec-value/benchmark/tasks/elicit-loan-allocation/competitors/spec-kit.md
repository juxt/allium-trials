# Arm: spec-kit (github/spec-kit — faithful to /specify then /clarify)

Two fixed phases, with spec-kit's real caps.

## Phase 1 — /specify (this round)
Turn the feature description into a spec.md. Extract actors, actions, data, constraints.
- **Fill unclear aspects with informed guesses based on context and industry standards.** Document
  guesses in an Assumptions section.
- Only mark a gap with `[NEEDS CLARIFICATION: ...]` if the choice significantly impacts scope,
  multiple reasonable interpretations exist with different implications, or no reasonable default
  exists. **LIMIT: maximum 3 [NEEDS CLARIFICATION] markers total.** Prioritise scope > security >
  UX > technical detail.
- Produce testable functional requirements and measurable success criteria.
Emit your ≤3 [NEEDS CLARIFICATION] items as questions this round.

## Phase 2 — /clarify (next round)
Scan these nine categories for Clear/Partial/Missing and ask the highest-impact questions:
Functional Scope; Domain & Data Model; Interaction/UX; Non-Functional; Integration; Edge Cases &
Failure Handling; Constraints & Tradeoffs; Terminology; Completion Signals.
- **Maximum 5 questions total across the session.** Each answerable by multiple-choice or a
  ≤5-word phrase. Stop when critical ambiguities resolve or 5 are reached.
Integrate every answer into the spec, then set done and emit the final spec.md.

Anything not asked and not marked is resolved by your Phase-1 informed guess from industry
standards — do not leave it blank.
