#!/usr/bin/env node
// SCALE + TOKEN-EFFICIENCY test, beyond a single context window.
//
// Task: over the FULL Fineract repo (~985k LOC Java, ~40M tokens — cannot be held in one context;
// the agent MUST retrieve), locate the code load-bearing for double-entry on the loan posting path.
// Two arms, both agentic (Read/Grep/Glob/Bash), repo NOT pre-loaded:
//   - nospec: task only. Must rediscover the cross-module structure by searching.
//   - spec:   task + a distilled behavioural double-entry spec (a compass; names NO code identifiers).
// The question is NOT only "who is more correct" (accuracy may saturate) but "who reaches correctness
// for fewer tokens / dollars / turns" — the token-efficiency angle. Every arm records cost + tokens
// + turns alongside a blind correctness score against ANSWER-KEY.md.
//
// Hygiene: each arm is a fresh headless `claude -p` in the repo dir with only its own inputs; the
// answer key never enters an arm's context; the judge is separate and blind to which arm produced
// the text. Writes are disallowed so the agents cannot mutate the repo.
//
// Usage: node eval-locate.mjs [--reps 1] [--turns 40]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "checkout");           // full Fineract root
const MODEL = "claude-opus-4-8";
const argv = process.argv.slice(2);
const REPS = Number(argv[argv.indexOf("--reps") + 1] ?? "1");
const TURNS = Number(argv[argv.indexOf("--turns") + 1] ?? "40");

const SPEC = readFileSync(join(HERE, "spec-doubleentry.allium"), "utf8");
const KEY = readFileSync(join(HERE, "ANSWER-KEY.md"), "utf8");

const TASK = `You are a senior engineer, new to this codebase (Apache Fineract, rooted in the current working directory). It is far too large to read in full, so you must search it.

TASK. There is an accounting invariant: for every posted loan transaction, the sum of the debit journal-entry legs must equal the sum of the credit legs (double-entry balance). Find the code that is LOAD-BEARING for this invariant ON THE LOAN posting path. Specifically determine:
  1. Where a loan transaction enters the accounting / journal-entry layer (the bridge/entry point).
  2. Where the transaction is split into debit/credit legs and those legs are posted to the ledger (the processor(s) and the posting primitives).
  3. Whether any existing check actually enforces debit = credit, and CRUCIALLY whether that check guards the LOAN posting path or only some other path.

Use the search tools. Cite exact file paths, and file:line where you can. Do not modify any files.
End your reply with a section headed exactly "LOAD-BEARING SITES:" that lists each site as "path :: method — one-line role", followed by a line "GUARD ON LOAN PATH: <yes/no + one sentence>".`;

const ARMS = {
  nospec: () => TASK,
  spec: () => `You have been given a distilled behavioural specification of the double-entry invariant. It is a MAP of what to trace — it names no files, classes or methods, only the domain behaviour. Read it, then do the task.

=== DISTILLED SPEC (the compass) ===
${SPEC}
=== END SPEC ===

${TASK}`,
};

function agent(prompt) {
  const r = spawnSync("claude", [
    "-p", prompt, "--output-format", "json", "--model", MODEL, "--max-turns", String(TURNS),
    "--dangerously-skip-permissions",
    "--disallowedTools", "Task,Agent,Edit,Write,NotebookEdit,WebFetch,WebSearch",
  ], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 29, timeout: 1200000 });
  let j = {};
  try { j = JSON.parse(r.stdout || "{}"); } catch { j = { result: r.stdout || "", parse_error: true }; }
  const u = j.usage || {};
  return {
    text: j.result || "",
    cost: j.total_cost_usd ?? null,
    turns: j.num_turns ?? null,
    in_tok: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    out_tok: u.output_tokens ?? 0,
    err: j.is_error || j.parse_error || false,
    stderr: (r.stderr || "").slice(-400),
  };
}

function judge(text) {
  const prompt = `You are an impartial grader. Below is an ANSWER KEY of the load-bearing sites for a code-localization task, then one engineer's ANSWER. Score ONLY from the key.

${KEY}

=== ENGINEER'S ANSWER TO SCORE ===
${text}

Output EXACTLY these four lines and nothing else:
RECALL_STRUCT: <0-4>    (how many of S1,S2,S3,S4 they correctly located)
RECALL_INSIGHT: <0-2>   (how many of D1,D2 they surfaced)
GUARD_GAP: <YES|NO>     (did they state the loan path is NOT covered by the debit=credit check)
PRECISION: <FEW|SOME|MANY>  (how many irrelevant/wrong sites they asserted)`;
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", "2", "--disallowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch"],
    { encoding: "utf8", maxBuffer: 1 << 27, timeout: 300000 });
  const out = r.stdout || "";
  const g = (re, d) => (out.match(re)?.[1] ?? d);
  return {
    struct: Number(g(/RECALL_STRUCT:\s*(\d)/i, 0)),
    insight: Number(g(/RECALL_INSIGHT:\s*(\d)/i, 0)),
    guard: /GUARD_GAP:\s*YES/i.test(out) ? 1 : 0,
    precision: g(/PRECISION:\s*(FEW|SOME|MANY)/i, "?").toUpperCase(),
    raw: out.trim(),
  };
}

const results = {};
for (const [arm, mk] of Object.entries(ARMS)) {
  results[arm] = [];
  for (let r = 0; r < REPS; r++) {
    const a = agent(mk() + (r ? `\n(independent attempt ${r + 1})` : ""));
    writeFileSync(join(HERE, `out_${arm}_${r}.txt`), a.text || `(empty; err=${a.err}; stderr=${a.stderr})`);
    const sc = a.text ? judge(a.text) : { struct: 0, insight: 0, guard: 0, precision: "?", raw: "no output" };
    const row = { rep: r, ...a, ...sc };
    delete row.text; delete row.stderr;
    results[arm].push(row);
    console.error(`[${arm} ${r}] struct=${sc.struct}/4 insight=${sc.insight}/2 guard=${sc.guard} prec=${sc.precision} | $${a.cost?.toFixed(3)} turns=${a.turns} tok=${(a.in_tok/1000).toFixed(0)}k+${a.out_tok}`);
    writeFileSync(join(HERE, "locate-result.json"), JSON.stringify(results, null, 2));
  }
}

const mean = (a, k) => (a.reduce((s, x) => s + (Number(x[k]) || 0), 0) / a.length);
console.log(`\n== SCALE + TOKEN localization over ~985k LOC Fineract (${REPS} rep/arm, ${TURNS} turn cap) ==\n`);
console.log(`arm      struct/4 insight/2 guard  $cost   turns   Mtok   correct-per-$`);
for (const [arm, a] of Object.entries(results)) {
  const score = mean(a, "struct") + mean(a, "insight") + mean(a, "guard"); // out of 7
  const cpd = score / (mean(a, "cost") || 1);
  console.log(`${arm.padEnd(8)} ${mean(a, "struct").toFixed(1)}     ${mean(a, "insight").toFixed(1)}      ${mean(a, "guard").toFixed(1)}   $${mean(a, "cost").toFixed(3)}  ${mean(a, "turns").toFixed(0)}    ${(mean(a, "in_tok") / 1e6).toFixed(2)}   ${cpd.toFixed(2)}`);
}
console.log(`\n=> accuracy question: does spec beat nospec on struct+insight+guard (score/7)?`);
console.log(`=> token question: does spec reach the same score for fewer $ / turns / tokens? (correct-per-$ higher = more efficient)`);
