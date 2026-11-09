#!/bin/bash
# Overnight full re-run of the requirements-capture gauntlet: all 9 arms x 3 tasks
# x 3 iterations = 81 cells, single-moment (no reuse across runs), into run-002.
#
# Resume-safe: each cell is appended to results/run-002/progress.jsonl the instant it
# finishes, so if a cell dies (e.g. the Claude subscription token lapses mid-run, as it
# did once during development) this loop retries with --resume and only the missing cells
# re-run. It stops when all 81 are present or after a safety cap on attempts.
#
# Usage, from the repo root:
#   bash gauntlets/requirements-capture/run-overnight.sh
# Watch progress in another terminal:
#   tail -f gauntlets/requirements-capture/results/run-002/overnight.log

set -u
cd "$(dirname "$0")/../.." || exit 1          # -> repo root (gauntlets/..)
REPO="$(pwd)"
R="$REPO/gauntlets/requirements-capture/results/run-002"
LOG="$R/overnight.log"
TARGET=81
MAX_ATTEMPTS=20

# Fresh start: clear run-002 so nothing is reused and the table is single-moment.
rm -rf "$R"
mkdir -p "$R"

echo "overnight run started $(date)" | tee -a "$LOG"

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  # First attempt is a clean run; subsequent attempts resume the survivors.
  if [ "$attempt" -eq 1 ]; then
    FLAGS=""
  else
    FLAGS="--resume"
  fi
  echo "--- attempt $attempt ($(date)) ${FLAGS:-fresh} ---" | tee -a "$LOG"
  node gauntlets/run.mjs requirements-capture --run-label run-002 $FLAGS >> "$LOG" 2>&1

  # Count distinct completed cells recorded so far.
  done_cells=$(node -e '
    const fs=require("fs");const p=process.argv[1];
    if(!fs.existsSync(p)){console.log(0);process.exit(0)}
    const s=new Set();
    for(const l of fs.readFileSync(p,"utf8").split("\n")){if(!l.trim())continue;
      try{const c=JSON.parse(l);s.add(`${c.arm}__${c.task}__iter${c.iteration}`)}catch{}}
    console.log(s.size);
  ' "$R/progress.jsonl" 2>/dev/null || echo 0)

  echo "completed $done_cells/$TARGET cells after attempt $attempt" | tee -a "$LOG"
  if [ "$done_cells" -ge "$TARGET" ]; then
    echo "all cells done; regenerating final report via one more --resume pass" | tee -a "$LOG"
    node gauntlets/run.mjs requirements-capture --run-label run-002 --resume >> "$LOG" 2>&1
    echo "overnight run finished $(date)" | tee -a "$LOG"
    exit 0
  fi
  sleep 10
done

echo "stopped after $MAX_ATTEMPTS attempts with $done_cells/$TARGET cells ($(date))" | tee -a "$LOG"
exit 1
