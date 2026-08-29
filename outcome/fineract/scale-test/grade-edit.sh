#!/bin/bash
# Grade one edited Fineract worktree against the double-entry oracle, in isolation.
# The oracle test file lives OUTSIDE the repo (trusted) and is injected only here, at grade
# time, so the blind editing agent never saw it. Classifies the edit's outcome:
#   compile_fail   - the edit does not compile (caught by the compiler)
#   existing_fail  - compiles but breaks the shipped processor tests (caught by existing suite)
#   SILENT_BREAK   - compiles, shipped tests pass, but the double-entry oracle FAILS
#                    (a developer would ship this green; it corrupts the ledger)
#   clean          - compiles, all tests pass, invariant preserved
#   ungradable     - the oracle itself failed to compile against the edited code (rare)
#
# Usage: grade-edit.sh <worktree-dir> <oracle-java-file>
set -uo pipefail
WT="$1"; ORACLE="$2"
PKG="fineract-provider/src/test/java/org/apache/fineract/accounting/journalentry"
DEST="$WT/$PKG/DoubleEntryBalanceOracleTest.java"
EXIST1="org.apache.fineract.accounting.journalentry.CreateJournalEntriesForChargeOffLoanTest"
EXIST2="org.apache.fineract.accounting.journalentry.CreateJournalEntriesForTransferLoanTest"
ORACLE_FQCN="org.apache.fineract.accounting.journalentry.DoubleEntryBalanceOracleTest"
RESULTS="$WT/fineract-provider/build/test-results/test"

cp "$ORACLE" "$DEST"
cd "$WT" || { echo '{"verdict":"error","reason":"no worktree"}'; exit 1; }

# One run: existing shipped tests + the oracle together.
BUILD_LOG=$(./gradlew :fineract-provider:test \
  --tests "$EXIST1" --tests "$EXIST2" --tests "$ORACLE_FQCN" \
  --rerun-tasks 2>&1)
GRADLE_EXIT=$?

# Distinguish compile failure from test failure.
if echo "$BUILD_LOG" | grep -qiE "compileJava FAILED|compileTestJava FAILED|error: |BUILD FAILED" && \
   ! ls "$RESULTS"/TEST-*.xml >/dev/null 2>&1; then
  rm -f "$DEST"
  echo '{"verdict":"compile_fail"}'
  exit 0
fi

# Parse JUnit XML for each class.
cls_fail() { # returns "1" if class had failures/errors, "?" if missing
  python3 - "$RESULTS" "$1" <<'PY'
import sys, glob, os, xml.etree.ElementTree as ET
res, fqcn = sys.argv[1], sys.argv[2]
p = os.path.join(res, f"TEST-{fqcn}.xml")
if not os.path.exists(p): print("?"); sys.exit()
t = ET.parse(p).getroot()
f = int(t.get("failures","0")); e = int(t.get("errors","0"))
print("1" if (f+e)>0 else "0")
PY
}
E1=$(cls_fail "$EXIST1"); E2=$(cls_fail "$EXIST2"); OR=$(cls_fail "$ORACLE_FQCN")
rm -f "$DEST"

# Oracle missing/errored to compile against the edit -> ungradable.
if [ "$OR" = "?" ]; then echo "{\"verdict\":\"ungradable\",\"e1\":\"$E1\",\"e2\":\"$E2\"}"; exit 0; fi
# Existing tests missing (compile issue) -> compile_fail.
if [ "$E1" = "?" ] || [ "$E2" = "?" ]; then echo '{"verdict":"compile_fail"}'; exit 0; fi

EXISTING_OK="true"; [ "$E1" = "1" ] && EXISTING_OK="false"; [ "$E2" = "1" ] && EXISTING_OK="false"
ORACLE_OK="true"; [ "$OR" = "1" ] && ORACLE_OK="false"

if [ "$EXISTING_OK" = "false" ]; then V="existing_fail";
elif [ "$ORACLE_OK" = "false" ]; then V="SILENT_BREAK";
else V="clean"; fi
echo "{\"verdict\":\"$V\",\"existing_ok\":$EXISTING_OK,\"oracle_ok\":$ORACLE_OK}"
