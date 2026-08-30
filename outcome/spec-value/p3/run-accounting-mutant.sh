#!/bin/bash
# E4 — structure-assembling side: a REAL accounting-code mutant that OMITS credit legs. Expect the
# double-entry spec (sum debit = sum credit) to CATCH it (unbalanced), unlike the solver value mutants.
set -uo pipefail
ROOT=/Users/hgarner/code/allium-trials/outcome/fineract
CP=$ROOT/checkout/fineract-provider/src/main/java/org/apache/fineract/accounting/journalentry/service/CashBasedAccountingProcessorForLoan.java
DUMPER_SRC=$ROOT/scale-test/DoubleEntryLegDumperTest.java
DUMPER_DST=$ROOT/checkout/fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry/DoubleEntryLegDumperTest.java
ALLIUM=/Users/hgarner/code/allium-tools/target/debug/allium
DE=/Users/hgarner/code/allium-trials/outcome/spec-value/b5/spec-doubleentry.allium
OUT=/Users/hgarner/code/allium-trials/outcome/spec-value/p3/accounting-result.txt
: > "$OUT"
cp "$CP" /tmp/cp_backup.java
cp "$DUMPER_SRC" "$DUMPER_DST"
# mutant: omit the charge-off credit legs (guard the credit-emission call with if(false))
perl -0pi -e 's/(this\.helper\.createCreditJournalEntryForLoan\(office, currencyCode, loanId, transactionId, transactionDate,)/if (false) $1/' "$CP"
guarded=$(grep -c "if (false) this.helper.createCreditJournalEntryForLoan" "$CP")
echo "guarded credit sites: $guarded" | tee -a "$OUT"
[ "$guarded" -ge 1 ] || { echo "MUTATION FAILED" | tee -a "$OUT"; cp /tmp/cp_backup.java "$CP"; rm -f "$DUMPER_DST"; exit 1; }
cd "$ROOT/checkout" || exit 1
rm -rf /tmp/je_mut && mkdir -p /tmp/je_mut
./gradlew :fineract-provider:test --tests "org.apache.fineract.accounting.journalentry.DoubleEntryLegDumperTest" \
   -Dje.trace.dir=/tmp/je_mut --rerun-tasks -q >/tmp/ga.log 2>&1
gexit=$?
echo "gradle exit=$gexit; mutant traces: $(find /tmp/je_mut -name '*.trace' | wc -l | tr -d ' ')" | tee -a "$OUT"
# monitor the double-entry spec over the mutant traces
catch=0; checked=0
for f in /tmp/je_mut/*.trace; do
  [ -f "$f" ] || continue
  h=$($ALLIUM monitor-schedule "$DE" "$f" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);r=[x for x in d['results'] if x['invariant']=='double_entry_balances'];print(0 if (r and r[0]['holds']) else 1)" 2>/dev/null || echo 0)
  checked=$((checked+1)); catch=$((catch+${h:-0}))
done
echo "double-entry spec: FLAGGED $catch/$checked mutant traces as unbalanced (catch>0 => spec CATCHES the real omit-leg bug)" | tee -a "$OUT"
# revert
cp /tmp/cp_backup.java "$CP"; rm -f "$DUMPER_DST"
echo "reverted" | tee -a "$OUT"
