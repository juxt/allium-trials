# v3 vs v4 — what the differential harness found

## The instrument

A model-free differential. For each property class we hold a correct and a faulted spec in
each version that can express it, and a per-class signature: the diagnostic that indicates
catching that fault. A version catches when its signature appears on the faulted spec and
not the correct one, so an incidental finding never inflates a catch. Run it:
`node outcome/v3-vs-v4/matrix.mjs`. It is deterministic; that is where the confidence comes
from. No model decides anything.

## The matrix

    property        v3       v4       reading
    structural      CATCH    CATCH    parity
    consistency     —        CATCH    v4-only (v3 has no such check)
    feasibility     CATCH    CATCH    parity
    casesplit       —        CATCH    v4-only (v3 has no such check)
    conflict        CATCH    CATCH    parity (becomes-triggered)
    conflict-call   miss     CATCH    v4 better (v3's heuristic misses call/call pairs)
    lifecycle       CATCH    —        v4 GAP (v3 does it, v4 cannot express)

Plus, from the monitor work: runtime temporal and relational invariants are v4-only (v3 has
no runtime monitor).

## Reading it

**Where v4 is better, model-free and reproducibly.**
- *v4-only checks*: global invariant consistency and case-split coverage. v3 has no
  mechanism for either. Evidence: a blatant `active=true` vs `active=false` invariant pair
  yields "(no findings)" from v3; v4 reports CONTRADICTORY with the minimal core.
- *Sound where v3 is heuristic*: v3's conflict check is a pattern that excludes two
  call-triggered rules. Two call-triggered rules that set a status to different values are a
  real conflict; v3 emits no conflict finding, v4's SAT-based coverage catches it as an
  overlap. Same shape for feasibility: v4 decides it by SAT, v3 only where the status graph
  makes it a reachability failure.

**Where they are at parity.** Structural (undeclared names, types) — both catch. Note two v4
warts surfaced here and recorded below.

**Where v4 loses — the gap your directive targets.** v3 has a real, well-built lifecycle
analysis: rule-backed reachability, deadlock (a reachable state with no rule-backed path to
a terminal state), dead transitions, unreachable triggers. v4 has *no lifecycle constructs
at all* — its `DeclKind` is only Contract, Component, Import; there is no status, transition,
rule, or trigger. It cannot express a state machine, so it cannot analyse one. This is one
root gap, not several: the whole lifecycle/rule/trigger family.

## The answer to "nothing v3 does well that v4 cannot"

The harness gives the precise list. The *only* thing v3 does that v4 cannot is the
lifecycle/rule/trigger family. Everywhere else v4 matches v3 or beats it. Closing the gap
means adding those constructs to v4 — a decision reserved for the human — and then the
analyses over them. Two things make that attractive rather than a mere catch-up:

1. v4 would do them *soundly*. v3's lifecycle checks are graph/heuristic; v4 has a SAT
   engine. Deadlock and reachability are bounded model checking, which the SAT engine can do
   without the blind spots the conflict-call case exposed.
2. It keeps v4's existing edge (consistency, coverage, feasibility, monitor), so the result
   is v4 doing everything v3 does, soundly, plus what v3 cannot.

## v4 defects surfaced along the way (cheaper to fix than the gap)

- **False alarm on invariant subject variables.** v4 name-resolution flags the bound
  subject of an invariant (`invariant p means f(a)` warns "`a` is not declared"). This is a
  false alarm on correct specs — the exact thing TOOL-6 weights worst. It polluted the
  harness until worked around.
- **Undeclared names are warnings, not errors.** v3 errors on an undeclared name; v4 only
  warns. v4 is the stricter-purposed language yet is more lenient here, which risks silently
  accepting a typo.

## The build list, in order

1. Fix the two v4 defects above (soundness of the checker's own output).
2. Decide the v4 lifecycle/rule/trigger constructs (human) — the harness is the evidence.
3. Implement their analyses on the SAT engine (deadlock, reachability, dead-transition,
   conflict) so v4 reaches parity soundly, then re-run the matrix to confirm the gap closes.
