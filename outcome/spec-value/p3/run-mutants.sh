#!/bin/bash
# E2 — real-code mutation cross-tab: does the gold-spec GATE add regression coverage over the shipped
# JUnit suite, on real calculator mutants? MECHANICAL only (monitor holds/fails; JUnit pass/fail).
# Per mutant: apply a source mutation, ONE gradle run (regenerate traces via the harness + run the
# shipped test), monitor the gold spec over the regenerated traces, compare traces to baseline. Revert.
set -uo pipefail
ROOT=/Users/hgarner/code/allium-trials/outcome/fineract
CALC=$ROOT/checkout/fineract-progressive-loan/src/main/java/org/apache/fineract/portfolio/loanproduct/calc/ProgressiveEMICalculator.java
ALLIUM=/Users/hgarner/code/allium-tools/target/debug/allium
SPEC=$ROOT/LoanScheduleInvariants.allium
BASE=$ROOT/traces_baseline
XML=$ROOT/checkout/fineract-progressive-loan/build/test-results/test
OUT=/Users/hgarner/code/allium-trials/outcome/spec-value/p3/mutants-result.jsonl
cp "$CALC" /tmp/calc_p3_backup.java
: > "$OUT"

# build mutant list: 9 multiply->subtract, 9 multiply->add, 2 setScale digit swaps
declare -a MUTS
for i in $(seq 1 9); do MUTS+=("mul2sub:$i"); done
for i in $(seq 1 9); do MUTS+=("mul2add:$i"); done
MUTS+=("scale2to4:1" "scale2to0:1")

apply() { # $1=op $2=n
  local op="$1" n="$2"
  cp /tmp/calc_p3_backup.java "$CALC"
  case "$op" in
    mul2sub) N=$n perl -0pi -e 'my $c=0; s/\.multiply\(/++$c==$ENV{N}?".subtract(":".multiply("/ge' "$CALC";;
    mul2add) N=$n perl -0pi -e 'my $c=0; s/\.multiply\(/++$c==$ENV{N}?".add(":".multiply("/ge' "$CALC";;
    scale2to4) perl -0pi -e 's/setScale\(2/setScale(4/' "$CALC";;
    scale2to0) perl -0pi -e 's/setScale\(2/setScale(0/' "$CALC";;
  esac
}

cd "$ROOT/checkout" || exit 1
i=0
for m in "${MUTS[@]}"; do
  i=$((i+1)); op="${m%%:*}"; n="${m##*:}"; id="${op}_${n}"
  apply "$op" "$n"
  rm -f "$XML"/TEST-*.xml 2>/dev/null
  # one gradle run: regenerate traces (harness) + shipped test
  ./gradlew :fineract-progressive-loan:test \
     --tests "org.apache.fineract.portfolio.loanproduct.calc.ProgressiveEMITraceHarness" \
     --tests "org.apache.fineract.portfolio.loanproduct.calc.ProgressiveEMICalculatorTest" \
     --rerun-tasks -q >/tmp/g.log 2>&1
  gexit=$?
  # compile fail?
  if grep -qiE "compileJava FAILED|compileTestJava FAILED|error: " /tmp/g.log && ! ls "$XML"/TEST-*.xml >/dev/null 2>&1; then
    echo "{\"id\":\"$id\",\"compile\":false}" >> "$OUT"; echo "[$i/${#MUTS[@]}] $id compile_fail"; continue
  fi
  # shipped test pass? parse its XML
  SX=$(ls "$XML"/TEST-*ProgressiveEMICalculatorTest.xml 2>/dev/null | head -1)
  if [ -n "$SX" ]; then
    if grep -qE 'failures="0" errors="0"|errors="0" failures="0"' "$SX"; then shipped=pass; else shipped=fail; fi
  else shipped=unknown; fi
  # spec gate: any invariant fails on any regenerated trace?
  nt=$(ls "$ROOT/traces"/*.trace 2>/dev/null | wc -l | tr -d ' ')
  spec=hold; changed=no
  for f in "$ROOT/traces"/*.trace; do
    r=$($ALLIUM monitor-schedule "$SPEC" "$f" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(0 if all(x['holds'] for x in d['results']) else 1)" 2>/dev/null || echo 0)
    [ "${r:-0}" = "1" ] && { spec=catch; break; }
  done
  # behaviour changed vs baseline?
  if ! diff -rq "$ROOT/traces" "$BASE" >/dev/null 2>&1; then changed=yes; fi
  echo "{\"id\":\"$id\",\"compile\":true,\"traces\":$nt,\"changed\":\"$changed\",\"shipped\":\"$shipped\",\"spec\":\"$spec\"}" >> "$OUT"
  echo "[$i/${#MUTS[@]}] $id changed=$changed shipped=$shipped spec=$spec"
done
# restore clean
cp /tmp/calc_p3_backup.java "$CALC"
rm -rf "$ROOT/traces" && cp -r "$BASE" "$ROOT/traces"
echo "DONE; reverted."
