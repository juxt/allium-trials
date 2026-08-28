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

// Two kinds. INFERABLE: a careful model can reason the sensible answer (elicit surfacing
// these is over-caution, a cost). NON-INFERABLE: an org-specific policy/number the model
// cannot know — a helpful model fills in a plausible-but-wrong specific; elicit must surface.
const QUESTIONS = [
  { id: "Q1", inferable: true, q: "On a cancellation, is the original trade's UTI reused on the cancellation report, or a new one minted?" },
  { id: "Q2", inferable: true, q: "If a trade is amended twice before the first amendment is acknowledged, are both amendments reportable events, or only the latest?" },
  { id: "Q3", inferable: false, q: "What is our desk's internal submission deadline after execution (we run tighter than the regulatory window)?" },
  { id: "Q4", inferable: false, q: "For inter-desk give-up trades, which of our two legal entities (LEI A or LEI B) is the reporting party?" },
  { id: "Q5", inferable: false, q: "Our bespoke collateral schedules cannot carry a standard portfolio code — what placeholder do we submit in that field?" },
  { id: "Q6", inferable: false, q: "Which trades does our desk treat as out of reporting scope entirely (an internal carve-out the regulation does not define)?" },
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

// Tuned: distinguish a point that GENERAL DOMAIN KNOWLEDGE settles (state it, for the
// operator to confirm) from one that is genuinely ORG-SPECIFIC and cannot be known without
// the operator (surface as OPEN). Aim: keep the org-specific catch, cut the over-caution.
const ELICIT_TUNED_PROMPT =
  `You are building an Allium specification through disciplined elicitation. Never fabricate an ` +
  `org-specific answer you cannot know. But do not surface points that standard domain practice ` +
  `settles — state those so the operator can correct them.\n\n${BRIEF}\n\n` +
  `For EACH design point: if standard practice or the brief determines the answer, give it as ` +
  `\`Q<n>: <answer>\`. If the answer depends on THIS desk's internal policy/specifics and cannot ` +
  `be known without asking, answer \`Q<n>: OPEN\`.\n\n${qlist}`;

function claude(prompt, ws) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "3", "--permission-mode", "bypassPermissions",
    "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Task NotebookEdit"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 26, timeout: 300000, killSignal: "SIGKILL" });
}

// Each answer is either surfaced (OPEN/clarify) or decided.
function classify(text) {
  const out = {};
  for (const x of QUESTIONS) {
    const m = (text || "").match(new RegExp(`${x.id}\\s*:\\s*([^\\n]*)`, "i"));
    if (!m) { out[x.id] = "none"; continue; }
    const a = m[1].trim().toLowerCase();
    out[x.id] = /\bopen\b|clarif|confirm|need.*(decision|input|operator|desk)|unspecified|not (clear|determined|stated|specified)|ambiguous|depends|would ask|tbd|to be (confirmed|decided)/.test(a) ? "surfaced" : "decided";
  }
  return out;
}

mkdirSync(RUNS, { recursive: true });
// The counterweight metric splits by inferable. On NON-INFERABLE points a "decided" is an
// unfounded specific the model cannot know (the error the counterweight prevents); on
// INFERABLE points a "surfaced" is over-caution (the counterweight's cost).
const agg = { ni_decided: 0, ni_surfaced: 0, inf_decided: 0, inf_surfaced: 0 };
for (let i = 0; i < N; i++) {
  const ws = join(RUNS, `${ARM}-${i}`); mkdirSync(ws, { recursive: true });
  const prompt = ARM === "elicit" ? ELICIT_PROMPT : ARM === "tuned" ? ELICIT_TUNED_PROMPT : BUILD_PROMPT;
  const out = claude(prompt, ws);
  writeFileSync(join(ws, "output.txt"), out.stdout || "");
  const c = classify(out.stdout || "");
  for (const x of QUESTIONS) {
    const k = c[x.id]; if (k === "none") continue;
    if (!x.inferable) agg[k === "surfaced" ? "ni_surfaced" : "ni_decided"]++;
    else agg[k === "surfaced" ? "inf_surfaced" : "inf_decided"]++;
  }
  console.log(`${ARM} #${i}: ` + QUESTIONS.map((x) => `${x.id}${x.inferable ? "" : "*"}=${c[x.id] === "surfaced" ? "OPEN" : c[x.id] === "decided" ? "dec" : "-"}`).join(" "));
}
const niTot = agg.ni_decided + agg.ni_surfaced, infTot = agg.inf_decided + agg.inf_surfaced;
console.log(`\n== arm=${ARM} ==`);
console.log(`  NON-INFERABLE (org-specific): guessed-unfounded ${agg.ni_decided}/${niTot}, surfaced ${agg.ni_surfaced}/${niTot}  <- counterweight value`);
console.log(`  INFERABLE: decided ${agg.inf_decided}/${infTot}, over-surfaced ${agg.inf_surfaced}/${infTot}  <- counterweight cost`);
writeFileSync(join(RUNS, `result-${ARM}.json`), JSON.stringify({ arm: ARM, ...agg }, null, 2));
