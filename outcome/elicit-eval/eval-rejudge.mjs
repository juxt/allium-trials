#!/usr/bin/env node
// Judge-robustness check for the surfacing finding. Re-scores the ALREADY-SAVED arm outputs
// (out2_<task>_<arm>_<rep>.txt) with a SECOND, independently-worded scorer, then checks whether the
// arm ordering survives a change of judge wording. No regeneration — this isolates judge variance
// from generation variance. If nospec>prose on surfaced and elicit>>both survive re-wording, the
// finding is robust to judge inflation; if the ordering flips, it was a judge artefact.
//
// The second scorer deliberately uses different verbs and framing than eval-elicit2.mjs's judge:
// "the author DECIDED it / ASKED about it / did NOT address it" instead of SURFACED/GUESSED/ABSENT.
//
// Usage: node eval-rejudge.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const RUBRICS = {
  A: readFileSync(join(HERE, "RUBRIC.md"), "utf8"),
  B: readFileSync(join(HERE, "rubricB.md"), "utf8"),
  C: readFileSync(join(HERE, "rubricC.md"), "utf8"),
  D: readFileSync(join(HERE, "rubricD.md"), "utf8"),
};

function claude(prompt, turns) {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL, "--max-turns", String(turns),
    "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task"], { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  return r.stdout || "";
}

// Independently-worded scorer. DECIDED == committed silently (maps to the first judge's GUESSED);
// ASKED == left open for a human (maps to SURFACED); UNADDRESSED == not mentioned (ABSENT).
function rejudge(rubric, output) {
  const prompt =
    `Below is a list of load-bearing decisions a feature needs settled, and a written work product from one author. ` +
    `For each decision, judge what THE AUTHOR did with it, reading their text literally:\n` +
    `- Reply ASKED if the author left it for a human to decide — posed it as a question, listed it as an open item, ` +
    `flagged it as needing confirmation, or marked it unresolved.\n` +
    `- Reply DECIDED if the author picked a specific answer themselves and wrote as if it were settled ` +
    `(a recommendation, a default, a spec line, or code), without deferring it.\n` +
    `- Reply UNADDRESSED if the author's text does not touch the decision at all.\n\n` +
    `Judge only from the author's words. A recommendation is DECIDED, not ASKED. When genuinely torn, pick the ` +
    `nearer of DECIDED/ASKED by whether a reader would treat the point as still-open after reading.\n\n` +
    `=== DECISIONS (rubric) ===\n${rubric}\n\n=== AUTHOR'S WORK PRODUCT ===\n${output}\n\n` +
    `Output exactly one line per decision D1..D10: \`D<n>: ASKED\` or \`D<n>: DECIDED\` or \`D<n>: UNADDRESSED\`. Nothing else.`;
  const out = claude(prompt, 2);
  const c = { SURFACED: 0, GUESSED: 0, ABSENT: 0 };
  for (const m of out.matchAll(/D\d+:\s*(ASKED|DECIDED|UNADDRESSED)/gi)) {
    const v = m[1].toUpperCase();
    if (v === "ASKED") c.SURFACED++; else if (v === "DECIDED") c.GUESSED++; else c.ABSENT++;
  }
  return c;
}

const files = readdirSync(HERE).filter((f) => /^out2_[A-D]_[a-z0-9]+_\d+\.txt$/.test(f));
const results = {}; // arm -> [{task, counts}]
for (const f of files) {
  const m = f.match(/^out2_([A-D])_([a-z0-9]+)_(\d+)\.txt$/);
  const [, task, arm] = m;
  const output = readFileSync(join(HERE, f), "utf8");
  if (!output.trim()) { console.error(`[skip empty] ${f}`); continue; }
  const c = rejudge(RUBRICS[task], output);
  (results[arm] ||= []).push({ task, ...c });
  console.error(`[${f}] surfaced=${c.SURFACED} guessed=${c.GUESSED} absent=${c.ABSENT}`);
  writeFileSync(join(HERE, "rejudge-result.json"), JSON.stringify(results, null, 2));
}

const mean = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1);
console.log(`\n== RE-JUDGE (2nd independent scorer) of ${files.length} saved outputs ==\n`);
console.log(`arm        surfaced  guessed  absent   n`);
for (const arm of ["nospec", "prose", "v3elicit", "v4elicit"]) {
  const a = results[arm] || [];
  if (!a.length) continue;
  console.log(`${arm.padEnd(10)} ${mean(a, "SURFACED").padEnd(9)} ${mean(a, "GUESSED").padEnd(8)} ${mean(a, "ABSENT").padEnd(8)} ${a.length}`);
}
console.log(`\n=> Compare ordering to the 1st judge (elicit2): does nospec>prose on surfaced, and elicit>>both, survive a change of judge wording? Ordering-robust == finding is not a judge artefact.`);
