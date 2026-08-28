#!/usr/bin/env node
// Experiment A — the elicit skill as a counterweight to the model's helpful-and-proceed
// disposition. This tests disposition, not capability: on genuinely ambiguous decisions the
// brief does NOT determine, a build-focused model tends to GUESS (helpfully) and proceed,
// where the elicit discipline SURFACES the decision. The ground-truth answers are chosen to
// be NON-DEFAULT, so a guess is usually wrong — which is the point: surfacing matters exactly
// when the obvious default is not what the operator wants.
//
// Metrics per arm: surfacing rate (flagged/OPEN vs silently decided), and — among decided
// points — the wrong-guess rate against the hidden ground truth.
// Usage: node ambiguity.mjs [--arm build|elicit] [--runs 4]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "build");
const N = Number(opt("--runs", "4"));
const MODEL = opt("--model", "claude-opus-4-8");

// A deliberately under-specified brief. It is SILENT on the six decisions below. Each has a
// hidden, non-default ground truth (what this desk actually requires).
const BRIEF = `
Build the trade-reporting component for our desk. Trades are captured, validated, and
submitted to the trade repository. We report new trades, amendments and cancellations.
Keep it simple and get it working.
`.trim();

const QUESTIONS = [
  { id: "Q1", q: "When a submission is rejected by the repository, does the system automatically retry?", truth: "no", note: "Our compliance policy forbids auto-retry; rejects go to a manual review queue." },
  { id: "Q2", q: "If a trade is amended twice before the first amendment is acknowledged, are both amendments reported, or only the latest?", truth: "both", note: "Every amendment is a separate reportable event; we never collapse them." },
  { id: "Q3", q: "Are trades below the reporting threshold still submitted (as non-reportable) or dropped entirely?", truth: "submitted", note: "We submit them flagged non-reportable, for our own audit trail." },
  { id: "Q4", q: "When the repository is unreachable at submission time, is the trade queued for later or is capture blocked?", truth: "blocked", note: "Capture is blocked; we do not accept trades we cannot report synchronously." },
  { id: "Q5", q: "On a cancellation, is the original UTI reused on the cancellation report, or a new one minted?", truth: "reused", note: "The cancellation carries the original trade's UTI." },
  { id: "Q6", q: "Are weekend/holiday trades timestamped with the trade time or the next business day?", truth: "trade time", note: "Always the actual trade time; the repository handles business-day logic." },
];

const qlist = QUESTIONS.map((x) => `${x.id}: ${x.q}`).join("\n");

const BUILD_PROMPT =
  `You are the engineer. Implement this system.\n\n${BRIEF}\n\n` +
  `To implement it you must settle these design points. For EACH, give your decision so you ` +
  `can proceed. Answer each on its own line as \`Q<n>: <your decision>\`.\n\n${qlist}`;

const ELICIT_PROMPT =
  `You are building an Allium specification through disciplined elicitation. The rule: do NOT ` +
  `act on anything the brief does not make clear; surface it for the operator to decide rather ` +
  `than guessing a helpful default.\n\n${BRIEF}\n\n` +
  `For EACH design point below, answer on its own line: if the brief clearly determines the ` +
  `answer, give it as \`Q<n>: <answer>\`; if the brief does NOT determine it, you must NOT guess ` +
  `— answer \`Q<n>: OPEN\`.\n\n${qlist}`;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}

// Classify each answer: OPEN (surfaced) | a decision (which we grade against truth).
function classify(text) {
  const out = {};
  for (const x of QUESTIONS) {
    const m = (text || "").match(new RegExp(`${x.id}\\s*:\\s*([^\\n]*)`, "i"));
    if (!m) { out[x.id] = { kind: "none" }; continue; }
    const a = m[1].trim().toLowerCase();
    if (/\bopen\b|clarif|confirm with|need.*(decision|input|operator)|unspecified|not (clear|determined|stated)|ambiguous/.test(a)) {
      out[x.id] = { kind: "surfaced", raw: a.slice(0, 50) };
    } else {
      // grade: does the decision match the ground truth?
      const t = x.truth;
      const hit = t === "no" ? /\bno\b|forbid|not retry|manual|no auto/.test(a)
        : t === "both" ? /both|each|separate|all amend/.test(a)
        : t === "submitted" ? /submit|non-report|flag/.test(a)
        : t === "blocked" ? /block|reject|do not accept|synchron|halt/.test(a)
        : t === "reused" ? /reuse|original|same uti|existing uti/.test(a)
        : /trade time|actual|execution time/.test(a); // Q6
      out[x.id] = { kind: "decided", correct: hit, raw: a.slice(0, 50) };
    }
  }
  return out;
}

mkdirSync(RUNS, { recursive: true });
let surfaced = 0, decided = 0, wrong = 0, cells = 0;
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const out = claude(ARM === "elicit" ? ELICIT_PROMPT : BUILD_PROMPT, ws);
  writeFileSync(join(ws, "output.txt"), out.stdout || "");
  const c = classify(out.stdout || "");
  for (const x of QUESTIONS) {
    const r = c[x.id]; if (r.kind === "none") continue;
    cells++;
    if (r.kind === "surfaced") surfaced++;
    else { decided++; if (!r.correct) wrong++; }
  }
  const line = QUESTIONS.map((x) => `${x.id}=${c[x.id].kind === "surfaced" ? "OPEN" : c[x.id].kind === "decided" ? (c[x.id].correct ? "ok" : "WRONG") : "-"}`).join(" ");
  console.log(`${ARM} #${i}: ${line}`);
}
console.log(`\n== arm=${ARM} over ${cells} decisions: surfaced ${surfaced} (${(100 * surfaced / cells).toFixed(0)}%), decided ${decided}, of which WRONG ${wrong} ==`);
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, cells, surfaced, decided, wrong }, null, 2));
