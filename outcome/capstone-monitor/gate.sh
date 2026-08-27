#!/usr/bin/env bash
# Reproducible assurance gate: one spec, checked at both stages on every build. Run in CI.
# Deterministic, no judgement calls. Exits non-zero if either stage finds a problem.
set -u
ALLIUM="${ALLIUM:-/Users/hgarner/code/allium-tools/target/debug/allium}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SPEC="$HERE/ReportLifecycle.allium"
TRACE="$HERE/live.trace"
fail=0

echo "== Stage 1: design-time (allium analyse) =="
design="$($ALLIUM analyse "$SPEC" 2>/dev/null)"
if echo "$design" | grep -q -e INFEASIBLE -e CONTRADICTORY; then
  echo "  FAIL — design defect:"
  echo "$design" | python3 -c 'import json,sys
for x in json.load(sys.stdin).get("diagnostics",[]):
    m=x.get("message","")
    if "INFEASIBLE" in m or "CONTRADICTORY" in m: print("    - "+m[:140])'
  fail=1
else
  echo "  pass — design is consistent and every declared report scenario is feasible"
fi

echo "== Stage 2: runtime (allium monitor over the build's trace) =="
if [ ! -f "$TRACE" ]; then python3 "$HERE/gateway.py" "$TRACE"; fi
report="$($ALLIUM monitor "$SPEC" "$TRACE")"
nviol="$(echo "$report" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["violations"]))')"
if [ "$nviol" -gt 0 ]; then
  echo "  FAIL — $nviol runtime violation(s):"
  echo "$report" | python3 -c 'import json,sys
for v in json.load(sys.stdin)["violations"]:
    print("    - t=%s %s %s (%s): %s" % (v["t"], v["entity"], v["invariant"], v["kind"], v["witness"]))'
  fail=1
else
  echo "  pass — no invariant violated over the trace"
fi

echo
[ "$fail" -eq 0 ] && echo "GATE: PASS" || echo "GATE: FAIL"
exit "$fail"
