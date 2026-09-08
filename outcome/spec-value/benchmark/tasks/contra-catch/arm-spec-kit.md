# Arm: spec-kit (github/spec-kit — /specify then /clarify)

Follow spec-kit's process.

## /specify
Turn the policy into a spec.md: extract actors, actions, data, constraints. Fill unclear aspects
with informed guesses based on industry standards; document guesses in an Assumptions section.
Mark a gap with `[NEEDS CLARIFICATION]` only if it significantly impacts scope or has multiple
reasonable interpretations — maximum 3 markers. Produce testable functional requirements and
measurable success criteria.

## /clarify
Scan for ambiguity across: Functional Scope; Domain & Data Model; Edge Cases & Failure Handling;
Constraints & Tradeoffs; Completion Signals. Ask the highest-impact questions (max 5 total). A
requirement whose acceptance criteria cannot all be met at once is a Constraints/Completion
problem to raise. Integrate and finalise the spec.

Produce the final spec.md, and note any conflicts or unsatisfiable requirements you found.
