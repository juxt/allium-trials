#!/bin/bash
# E8 — real-code, SINGLE-SITE accounting mutation suite (strengthens E4's n=1). Guard each individual
# credit-emission site in the cash processor one at a time; run the leg dumper; monitor the double-entry
# spec over the cash traces. Record per site: exercised (traces changed vs baseline) and caught.
set -uo pipefail
ROOT=/Users/hgarner/code/allium-trials/outcome/fineract
CP=$ROOT/checkout/fineract-provider/src/main/java/org/apache/fineract/accounting/journalentry/service/CashBasedAccountingProcessorForLoan.java
DUMPER_SRC=$ROOT/scale-test/DoubleEntryLegDumperTest.java
DUMPER_DST=$ROOT/checkout/fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/DoubleEntryLegDumperTest.java
ALLIUM=/Users/hgarner/code/allium-tools/target/debug/allium
DE=/Users/hgarner/code/allium-trials/outcome/spec-value/b5/spec-doubleentry.allium
BASE=$ROOT/scale-test/je-traces/baseline
OUT=/Users/hgarner/code/allium-trials/outcome/spec-value/p3/e8-result.jsonl
JEDIR=$ROOT/checkout/fineract-provider/je-traces
: > "$OUT"
cp "$CP" /tmp/e8_cp_backup.java
cp "$DUMPER_SRC" "$DUMPER_DST"
NSITES=$(grep -c 'this\.helper\.createCreditJournalEntryForLoan(' "$CP")
echo "credit sites in cash processor: $NSITES" | tee -a "$OUT"
cd "$ROOT/checkout" || exit 1
NRUN=${1:-6}   # cap number of sites to try
for i in $(seq 1 $((NRUN<NSITES?NRUN:NSITES))); do
  cp /tmp/e8_cp_backup.java "$CP"
  # guard the i-th credit call
  N=$i perl -0pi -e 'my $c=0; s/(this\.helper\.createCreditJournalEntryForLoan\()/++$c==$ENV{N}?"if (false) $1":"$1"/ge' "$CP"
  rm -rf "$JEDIR" 2>/dev/null
  ./gradlew :fineract-provider:test --tests "org.apache.fineract.accounting.journalentry.DoubleEntryLegDumperTest" --rerun-tasks -q >/tmp/e8g.log 2>&1
  if grep -qiE "compileJava FAILED|error: " /tmp/e8g.log; then echo "{\"site\":$i,\"compile\":false}" | tee -a "$OUT"; continue; fi
  changed=no; caught=0; checked=0
  for f in "$JEDIR"/cash-*.trace; do
    [ -f "$f" ] || continue
    bn=$(basename "$f"); checked=$((checked+1))
    diff -q "$f" "$BASE/$bn" >/dev/null 2>&1 || changed=yes
    v=$($ALLIUM monitor-schedule "$DE" "$f" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);r=[x for x in d['results'] if x['invariant']=='double_entry_balances'];print(1 if (r and not r[0]['holds']) else 0)" 2>/dev/null || echo 0)
    caught=$((caught+${v:-0}))
  done
  echo "{\"site\":$i,\"compile\":true,\"changed\":\"$changed\",\"caught_traces\":$caught,\"cash_traces\":$checked}" | tee -a "$OUT"
done
cp /tmp/e8_cp_backup.java "$CP"; rm -f "$DUMPER_DST"
echo "reverted (guards remain: $(grep -c 'if (false) this.helper.createCredit' "$CP"))" | tee -a "$OUT"
