#!/bin/bash
# Grade every blind-edit worktree sequentially (one Gradle build at a time) against the hidden
# double-entry oracle. Prints per-edit verdict + diffstat, then a tally. The headline is the
# SILENT_BREAK count: edits that compile and pass the shipped tests but unbalance the ledger.
SCRATCH=/private/tmp/claude-501/-Users-hgarner-code-allium-rnd/a580367d-af98-454d-a1fc-e215651f034c/scratchpad/scale
ORACLE=/Users/hgarner/code/allium-trials/outcome/fineract/scale-test/DoubleEntryBalanceOracleTest.java
GRADE=/Users/hgarner/code/allium-trials/outcome/fineract/scale-test/grade-edit.sh
declare -A COUNT
for id in t1 t3 t4 t5 t7 t8 t9 t10; do
  WT="$SCRATCH/wt-$id"
  [ -d "$WT" ] || { echo "$id: (no worktree)"; continue; }
  STAT=$(git -C "$WT" diff --stat 2>/dev/null | tail -1 | sed 's/^ *//')
  V=$(bash "$GRADE" "$WT" "$ORACLE" 2>/dev/null)
  VERDICT=$(echo "$V" | python3 -c "import sys,json; print(json.load(sys.stdin).get('verdict','?'))" 2>/dev/null || echo "?")
  COUNT[$VERDICT]=$(( ${COUNT[$VERDICT]:-0} + 1 ))
  echo "$id: $VERDICT   [$STAT]"
done
echo "---- tally ----"
for k in "${!COUNT[@]}"; do echo "$k: ${COUNT[$k]}"; done
