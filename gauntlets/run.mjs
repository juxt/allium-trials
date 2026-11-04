#!/usr/bin/env node
// Gauntlet runner (provider-agnostic CLI).
//
// Runs a gauntlet from gauntlets/<name>/ against any OpenAI-compatible endpoint
// (OpenAI, Anthropic's OpenAI-compat endpoint, Google, or a litellm proxy), so
// the same eval can be driven by Claude, GPT, Gemini or anything else. Nothing
// about what is tested lives in this script; it all lives in the gauntlet's
// config, arms/ and tasks/ directories.
//
// It measures the SPECIFICATION: how many of a task's hidden requirements each
// process captures, and how many questions it asks. No code is generated or run.
//
// Usage:
//   node gauntlets/run.mjs <name> [options]
//   node gauntlets/run.mjs requirements-capture --mode sequential --iterations 1
//
// Options (all override the gauntlet's config):
//   --mode parallel|sequential   how cells are scheduled
//   --concurrency N              cells in flight when parallel
//   --iterations N              repeats per (arm, task) cell
//   --arms a,b,c                only these arm ids (comma-separated subset of the enabled arms)
//   --tasks x,y                 only these task ids (comma-separated subset of the enabled tasks)
//   --run-label X               output goes to results/<X>/ (default: config value)
//   --model ID                  set the AUTHOR model (who drives each process)
//   --author-model ID           same as --model
//   --stakeholder-model ID      the proxy stakeholder model
//   --auditor-model ID          the scoring auditor model
//   --base-url URL              OpenAI-compatible endpoint (else $GAUNTLET_BASE_URL)
//   --dry-run                   validate config + print the plan; make no API calls
//   --resume                    reuse cells already in results/<run-label>/metadata.json;
//                               run only the missing ones and merge into one full report
//
// Bias-check mode (certifies a task's decisions are genuinely non-inferable):
//   --guess-only                ignore the arms; for each task, have the author guess the whole
//                               spec with NO stakeholder, then score each decision. A decision a
//                               capable model can guess is inferable and does not test elicitation.
//   --guess-n N                 guesses per task (default 10)
//   --guess-threshold T         a decision is INFERABLE if guessed correctly > T times (default 3)
//
// Endpoint + key come from --base-url / $GAUNTLET_BASE_URL and $GAUNTLET_API_KEY
// (falls back to $OPENAI_API_KEY). Model ids must be whatever your endpoint serves.

import {
  readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync, mkdtempSync, readdirSync,
} from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { chatJSON } from "./lib/provider.mjs";
import { claudeJSON, claudeProduceHooked, claudeAgentInterview } from "./lib/claude-engine.mjs";

const GAUNTLETS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Load a .env (walking up from gauntlets/) into process.env without overriding
// anything already set. Keeps endpoint, key and model ids in one file.
function loadEnv(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const p = path.join(dir, ".env");
    if (existsSync(p)) {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m || line.trim().startsWith("#")) continue;
        const k = m[1];
        const v = m[2].replace(/^["']|["']$/g, "");
        if (process.env[k] === undefined) process.env[k] = v;
      }
      return p;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
loadEnv(GAUNTLETS_DIR);

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);

const name = positional[0] || "requirements-capture";
const ROOT = path.join(GAUNTLETS_DIR, name);
if (!existsSync(path.join(ROOT, "gauntlet.config.json"))) {
  console.error(`No gauntlet '${name}' at ${ROOT}.`);
  console.error(`Available: ` + readdirSync(GAUNTLETS_DIR).filter((d) => existsSync(path.join(GAUNTLETS_DIR, d, "gauntlet.config.json"))).join(", "));
  process.exit(1);
}

const readText = (p) => readFileSync(p, "utf8");
const readJSON = (p) => JSON.parse(readText(p));

// ---- resolve config + overrides ----
const cfg = readJSON(path.join(ROOT, "gauntlet.config.json"));
const ex = cfg.execution || {};
const mode = opt("mode", ex.mode || "parallel");
const iterations = Number(opt("iterations", ex.iterations || 3));
const concurrency = mode === "sequential" ? 1 : Number(opt("concurrency", ex.concurrency || 2));
const runLabel = opt("run-label", cfg.run_label || "run");
// engine: "openai" = litellm/OpenAI-compatible, single-shot (default, model-agnostic).
// "claude" = every call via `claude -p` (subscription), and produce runs as a real
// agent with the allium-check hook live (the whiteboard loop). See lib/claude-engine.mjs.
const engine = opt("engine", process.env.GAUNTLET_ENGINE || ex.engine || "openai");
const authorModel = opt("model", opt("author-model", process.env.GAUNTLET_AUTHOR_MODEL || ex.author_model));
const stakeholderModel = opt("stakeholder-model", process.env.GAUNTLET_STAKEHOLDER_MODEL || ex.stakeholder_model);
const auditorModel = opt("auditor-model", process.env.GAUNTLET_AUDITOR_MODEL || ex.auditor_model);
const dryRun = flag("dry-run");
const resume = flag("resume");
const guessOnly = flag("guess-only");
const guessN = Number(opt("guess-n", 10));
const guessThreshold = Number(opt("guess-threshold", 3));

// max_tokens per call. Must clear the endpoint's reasoning/thinking budget if it
// has one, so keep it generous. Override with $GAUNTLET_MAX_TOKENS.
const MAXTOK = Number(process.env.GAUNTLET_MAX_TOKENS || 16384);
const SMALLTOK = Math.min(MAXTOK, 8192);

const baseURL = opt("base-url", process.env.GAUNTLET_BASE_URL || (cfg.provider && cfg.provider.default_base_url) || "http://localhost:4000/v1");
const apiKey = process.env.GAUNTLET_API_KEY || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || "sk-noauth";
const OUT = path.join(ROOT, "results", runLabel);

// ---- load arms + tasks (optional --arms / --tasks filters, comma-separated) ----
const onlyArms = opt("arms", null);
const onlyArmSet = onlyArms ? new Set(onlyArms.split(",").map((s) => s.trim())) : null;
const arms = (cfg.arms || []).filter((a) => a.enabled && (!onlyArmSet || onlyArmSet.has(a.id))).map((a) => {
  const def = readJSON(path.join(ROOT, "arms", a.id, "arm.json"));
  const dir = path.join(ROOT, "arms", a.id);
  // Agentic arms run as a real Claude agent from a workspace overlay (their authentic
  // installed skills), not from a process.md fed as text. Text arms carry a process_file.
  if (def.execution === "agent") {
    return { ...def, dir, overlayDir: path.join(dir, def.workspace || "workspace") };
  }
  return { ...def, dir, processPath: path.join(dir, def.process_file), processText: readText(path.join(dir, def.process_file)) };
});
const onlyTasks = opt("tasks", null);
const onlyTaskSet = onlyTasks ? new Set(onlyTasks.split(",").map((s) => s.trim())) : null;
const tasks = (cfg.tasks || []).filter((t) => t.enabled && (!onlyTaskSet || onlyTaskSet.has(t.id))).map((t) => {
  const def = readJSON(path.join(ROOT, "tasks", t.id, "task.json"));
  const dir = path.join(ROOT, "tasks", t.id);
  return {
    ...def, dir,
    brief: readText(path.join(dir, def.brief_file)),
    answerKey: readText(path.join(dir, def.answer_key_file)),
    reference: readText(path.join(dir, def.reference_file)),
  };
});

if (!arms.length) { console.error(`No arms selected. --arms '${onlyArms}' matched none of the enabled arms: ${(cfg.arms || []).filter((a) => a.enabled).map((a) => a.id).join(", ")}`); process.exit(1); }
if (!tasks.length) { console.error(`No tasks selected. --tasks '${onlyTasks}' matched none of the enabled tasks: ${(cfg.tasks || []).filter((t) => t.enabled).map((t) => t.id).join(", ")}`); process.exit(1); }

console.log(`gauntlet: ${name}`);
console.log(`arms:     ${arms.map((a) => a.id).join(", ")}`);
console.log(`tasks:    ${tasks.map((t) => t.id).join(", ")}`);
if (guessOnly) console.log(`plan:     bias check — ${tasks.length} task(s) x ${guessN} guesses = ${tasks.length * guessN} specs, concurrency=${concurrency}, inferable if guessed > ${guessThreshold}/${guessN}`);
else console.log(`plan:     ${arms.length} x ${tasks.length} x ${iterations} = ${arms.length * tasks.length * iterations} cells, mode=${mode} concurrency=${concurrency}`);
console.log(`models:   author=${authorModel} stakeholder=${stakeholderModel} auditor=${auditorModel}`);
console.log(engine === "claude"
  ? `engine:   claude (via \`claude -p\`, Claude subscription; produce runs the allium-check hook loop)`
  : `engine:   openai (litellm/OpenAI-compatible) · endpoint: ${baseURL}  (key: ${apiKey === "sk-noauth" ? "none set" : "from env"})`);
console.log(`output:   ${path.relative(process.cwd(), OUT)}/`);

if (dryRun) {
  console.log("\n--dry-run: config valid, all arm/task files present. No API calls made.");
  process.exit(0);
}

// ---- prompt steps ----
const SYS = "You follow instructions precisely and reply with a single JSON object and nothing else.";
function tt(t) {
  if (!t.length) return "(no questions asked yet)";
  return t.map((x, i) => `Round ${i + 1}:\n` + x.q.map((q, j) => `  Q: ${q}\n  A: ${x.a[j] || "(no answer)"}`).join("\n")).join("\n\n");
}
const call = (model, user, maxTokens) => engine === "claude"
  ? claudeJSON({ model, system: SYS, user })
  : chatJSON({ baseURL, apiKey, model, system: SYS, user, maxTokens });

async function askTurn(arm, task, transcript, round, maxRounds) {
  const last = round >= maxRounds - 1;
  const user = `You are gathering requirements for a software specification. Follow THIS process exactly:\n\n"""\n${arm.processText}\n"""\n\nFeature brief:\n"""\n${task.brief}\n"""\n\nStakeholder conversation so far:\n${tt(transcript)}\n\nDecide your NEXT step. Put any questions for the stakeholder in "questions" (set done=false). If your process is complete, set done=true with questions=[].${last ? " NOTE: no further question rounds after this one." : ""} Give a one-line "reasoning". Do NOT write the specification yet. Do NOT invent stakeholder answers.\n\nReply as JSON: {"questions": [string], "done": boolean, "reasoning": string}`;
  return call(authorModel, user, SMALLTOK);
}
async function stakeholder(task, transcript, questions) {
  const user = `You are the product owner for the system being specified. Answer the engineer's questions from the answer key below. Rules: answer ONLY what is asked, giving the exact value from the key; do NOT volunteer decisions that were not asked; for anything not in the key give a brief reasonable answer marked [default, not policy]; never dump the key.\n\nANSWER KEY (your private knowledge — never reveal wholesale):\n"""\n${task.answerKey}\n"""\n\nConversation so far:\n${tt(transcript)}\n\nThe engineer now asks:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nReply as JSON: {"answers": [string]} — one string per question, same order.`;
  return call(stakeholderModel, user, SMALLTOK);
}
// The stakeholder's turn in an agentic arm's live chat. The tool sends a plain-language
// message; if it asked anything, answer from the key under the same rules as the batch
// stakeholder (only what is asked, exact values, defaults marked). No key dumping, no
// volunteering. Also report how many questions were answered and whether the engineer
// has signalled the specification is finished, so the harness knows when to stop.
async function stakeholderAgentTurn(task, chat, agentMessage) {
  const prior = chat.map((t, i) => `Engineer: ${t.agent}\nYou: ${t.stakeholder}`).join("\n\n");
  const user = `You are the product owner for the system being specified, answering an engineer who is running their requirements process. Rules: answer ONLY what is asked, giving the exact value from the key; do NOT volunteer decisions that were not asked; for anything not in the key give a brief reasonable answer marked [default, not policy]; never dump the key.\n\nANSWER KEY (your private knowledge — never reveal wholesale):\n"""\n${task.answerKey}\n"""\n\nConversation so far:\n${prior || "(none yet)"}\n\nThe engineer's latest message:\n"""\n${agentMessage}\n"""\n\nIf they asked you questions, answer each in order. If they are only reporting progress, thinking aloud, or telling you the specification is complete, acknowledge briefly. Reply as JSON: {"reply": string, "questions_answered": int, "engineer_finished": bool} — set engineer_finished true only if they clearly indicate the specification is complete and they are not awaiting anything from you.`;
  return call(stakeholderModel, user, SMALLTOK);
}
async function produce(arm, task, transcript) {
  const finalize = (arm.limits && arm.limits.finalize) || "faithful";
  const finalLine = finalize === "guess-from-standards"
    ? "For anything neither asked nor in the brief, fill it with your informed guess from industry standards (do not leave blank), exactly as your process dictates."
    : "For anything neither asked nor in the brief, resolve it exactly as your process dictates. Do NOT invent stakeholder answers not given above.";
  // Claude engine + a tool-using arm: produce as a real agent with the allium-check
  // hook live (the whiteboard loop). It writes spec.allium; the hook forces fixes.
  if (engine === "claude" && arm.tools) {
    const p = `Produce a requirements specification, following your process. READ your process at ${arm.processPath} and the brief at ${task.dir}/${task.brief_file}.\n\nStakeholder conversation (the ONLY facts beyond the brief):\n${tt(transcript)}\n\nWrite the COMPLETE specification as an Allium v3 spec (first line \`-- allium: 3\`) to a file named spec.allium in the current directory using the Write tool. The environment runs the Allium checker on every write and will BLOCK with errors you MUST fix in the same turn. Iterate until it is clean and you have captured every decision the conversation settled. ${finalLine} Do NOT invent answers not given above. Put the spec in spec.allium; do not print it in chat.`;
    const r = await claudeProduceHooked({ model: authorModel, prompt: p });
    return { spec: r.spec, check_runs: r.check_runs };
  }
  const user = `Produce the final requirements specification, following your process:\n\n"""\n${arm.processText}\n"""\n\nFeature brief:\n"""\n${task.brief}\n"""\n\nStakeholder conversation (the ONLY facts beyond the brief):\n${tt(transcript)}\n\nWrite the complete specification. Capture every decision your process settled. ${finalLine}\n\nReply as JSON: {"spec": string}`;
  return call(authorModel, user, MAXTOK);
}
// Bias-check author: write the spec from the brief ALONE, guessing every unstated
// decision as a capable engineer would. No process, no stakeholder. This is what
// defines "inferable": a decision this guesser gets right needs no elicitation.
async function guessProduce(task) {
  const user = `You are writing a requirements specification for the feature below, working from the brief ALONE. There is no stakeholder to ask and no process to follow. Fill in EVERY material decision with your best judgement, exactly as a capable engineer would default from standard industry practice. Do not leave anything open or unspecified; commit to a concrete answer for each decision.\n\nFeature brief:\n"""\n${task.brief}\n"""\n\nWrite the complete specification.\n\nReply as JSON: {"spec": string}`;
  return call(authorModel, user, MAXTOK);
}
async function audit(task, spec) {
  const N = task.decisions_total;
  const user = `You are a neutral auditor. A hidden reference set of ${N} numbered decisions, and a specification produced by an engineer who could only learn these by asking a stakeholder.\n\nFor EACH decision 1..${N}: surfaced (does the spec address it?), correct (does the spec's resolution MATCH the reference set's exact value/order/precision? correct requires the SPEC to state it; be strict and literal — a plausible-but-different answer is NOT correct), evidence (exact quote/location from the spec, or "absent"), reasoning (one or two sentences justifying the verdict so a reviewer can check every close call).\n\nHIDDEN REFERENCE:\n"""\n${task.reference}\n"""\n\nSPECIFICATION UNDER TEST:\n"""\n${spec}\n"""\n\nReply as JSON: {"decisions": [{"n": int, "surfaced": bool, "correct": bool, "evidence": string, "reasoning": string}], "summary": string} — all ${N} decisions.`;
  return call(auditorModel, user, MAXTOK);
}

// Optional spec-side check: if the produced artefact is an Allium spec and the CLI
// is present, record whether `allium check` passes. Logged only; never scored.
function runAlliumCheck(spec) {
  if (!spec || !spec.trimStart().startsWith("-- allium")) return null;
  const tmp = mkdtempSync(path.join(os.tmpdir(), "gauntlet-allium-"));
  const file = path.join(tmp, "spec.allium");
  try {
    writeFileSync(file, spec);
    const out = execFileSync("allium", ["check", file], { encoding: "utf8", timeout: 20000 });
    return { available: true, ok: true, output: out.slice(0, 500) };
  } catch (e) {
    if (/ENOENT/.test(String(e.message))) return { available: false };
    return { available: true, ok: false, output: String(e.stdout || e.message || e).slice(0, 500) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- one cell ----
const cellSlug = (c) => `${c.arm}__${c.task}__iter${c.iteration}`;
// The machine-readable per-cell record (used both for the incremental crash-safe
// progress.jsonl and the final metadata.json).
const metaCell = (r) => ({
  arm: r.arm, task: r.task, iteration: r.iteration, questions: r.questions,
  captured: r.captured, decisions_total: r.decisions_total,
  bespoke_captured: r.bespoke_captured, bespoke_total: r.bespoke_total,
  audit_summary: r.audit_summary, decisions: r.decisions,
  allium_check: r.allium_check, log: `logs/${cellSlug(r)}.md`,
});
function cellLogMd(c) {
  const rounds = c.ask_log.map((r) => {
    const qa = c.transcript[r.round - 1] || { q: [], a: [] };
    const body = r.asked.length ? r.asked.map((q, j) => `Q: ${q}\nA: ${qa.a[j] || "(no answer)"}`).join("\n\n") : "(no questions this round)";
    return `### Round ${r.round}${r.done ? " (process signalled done)" : ""}\n_Step reasoning:_ ${r.reasoning || "(none given)"}\n\n${body}`;
  }).join("\n\n");
  const verdict = c.decisions.map((d) => `| ${d.n} | ${d.surfaced ? "yes" : "no"} | ${d.correct ? "**yes**" : "no"} | ${String(d.evidence || "").replace(/\|/g, "\\|").replace(/\n/g, " ")} | ${String(d.reasoning || "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`).join("\n");
  const alliumBlock = c.allium_check ? `\n\n## Allium checker (spec-side, not scored)\n\n${c.allium_check.available === false ? "allium binary not found on PATH (skipped)." : (c.allium_check.ok ? "check passed" : "check reported issues") + ":\n\n```\n" + (c.allium_check.output || "") + "\n```"}` : "";
  return `# ${c.arm} — ${c.task} — iteration ${c.iteration}\n\n`
    + `Model (author): ${authorModel} · Questions asked: ${c.questions} · Captured: ${c.captured}/${c.decisions_total} · Bespoke captured: ${c.bespoke_captured}/${c.bespoke_total}`
    + `\n\n## Conversation\n\n${rounds}\n\n## Produced specification\n\n${c.spec}\n\n## Auditor verdict\n\n_${c.audit_summary || ""}_\n\n| # | surfaced | correct | evidence | auditor reasoning |\n|---|---|---|---|---|\n${verdict}${alliumBlock}\n`;
}

// A cell for an agentic arm: the tool runs as a real Claude agent with its authentic
// skills installed, interviewing the harness's stakeholder in a live session, then its
// produced artefact is audited exactly like every other arm's.
async function runAgentCell(arm, task, i) {
  const maxTurns = (arm.limits && arm.limits.max_rounds) || 16;
  const r = await claudeAgentInterview({
    model: authorModel,
    overlayDir: arm.overlayDir,
    brief: task.brief,
    maxTurns,
    answerTurn: async (agentMessage, chat) => {
      const a = await stakeholderAgentTurn(task, chat, agentMessage);
      return { reply: (a && a.reply) || "", questions_answered: (a && a.questions_answered) || 0, engineer_finished: !!(a && a.engineer_finished) };
    },
  });
  const spec = r.spec || "";
  const au = await audit(task, spec);
  const decs = (au && au.decisions) || [];
  const bespokeSet = task.bespoke_decisions || [];
  const bespoke = decs.filter((d) => bespokeSet.includes(d.n));
  // Represent the live chat in the log using the same shape as text arms.
  const transcript = (r.transcript || []).map((t) => ({ q: [t.agent], a: [t.stakeholder] }));
  const askLog = (r.transcript || []).map((t, idx) => ({ round: idx + 1, reasoning: "(live agent turn)", asked: [t.agent], done: false }));
  const cell = {
    arm: arm.id, task: task.id, iteration: i + 1,
    questions: r.questions,
    captured: decs.filter((d) => d.correct).length, decisions_total: task.decisions_total,
    bespoke_captured: bespoke.filter((d) => d.correct).length, bespoke_total: bespoke.length,
    audit_summary: (au && au.summary) || "",
    decisions: decs, ask_log: askLog, transcript, spec,
    allium_check: null,
  };
  mkdirSync(path.join(OUT, "logs"), { recursive: true });
  writeFileSync(path.join(OUT, "logs", `${cellSlug(cell)}.md`), cellLogMd(cell));
  return cell;
}

async function runCell(arm, task, i) {
  const limits = arm.limits || {};
  const maxRounds = limits.max_rounds || 6;
  const maxQ = limits.max_questions == null ? null : limits.max_questions;
  const qpr = limits.questions_per_round == null ? null : limits.questions_per_round;
  const transcript = [];
  const askLog = [];
  let qcount = 0;
  for (let r = 0; r < maxRounds; r++) {
    const t = await askTurn(arm, task, transcript, r, maxRounds);
    let qs = (t && t.questions) || [];
    if (qpr) qs = qs.slice(0, qpr);
    if (maxQ != null) qs = qs.slice(0, Math.max(0, maxQ - qcount));
    askLog.push({ round: r + 1, reasoning: (t && t.reasoning) || "", asked: qs, done: !!(t && t.done) });
    if (qs.length) {
      qcount += qs.length;
      const a = await stakeholder(task, transcript, qs);
      transcript.push({ q: qs, a: (a && a.answers) || [] });
    }
    if ((t && t.done) || !qs.length) break;
    if (maxQ != null && qcount >= maxQ) break;
  }
  const pr = await produce(arm, task, transcript);
  const spec = (pr && pr.spec) || "";
  const au = await audit(task, spec);
  const decs = (au && au.decisions) || [];
  const bespokeSet = task.bespoke_decisions || [];
  const bespoke = decs.filter((d) => bespokeSet.includes(d.n));
  const cell = {
    arm: arm.id, task: task.id, iteration: i + 1,
    questions: qcount,
    captured: decs.filter((d) => d.correct).length, decisions_total: task.decisions_total,
    bespoke_captured: bespoke.filter((d) => d.correct).length, bespoke_total: bespoke.length,
    audit_summary: (au && au.summary) || "",
    decisions: decs, ask_log: askLog, transcript, spec,
    allium_check: arm.tools ? runAlliumCheck(spec) : null,
  };
  mkdirSync(path.join(OUT, "logs"), { recursive: true });
  writeFileSync(path.join(OUT, "logs", `${cellSlug(cell)}.md`), cellLogMd(cell));
  return cell;
}

// ---- concurrency pool ----
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  async function next() {
    const i = idx++;
    if (i >= items.length) return;
    try { out[i] = await worker(items[i], i); } catch (e) { console.error(`cell failed: ${e.message}`); out[i] = null; }
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return out;
}

// ---- bias-check mode ----
async function runGuessOnly() {
  console.log(`\nbias check: guessing with no stakeholder, ${guessN}x per task, author=${authorModel}. Inferable if guessed correct > ${guessThreshold}/${guessN}.\n`);
  const gcells = [];
  for (const task of tasks) for (let i = 0; i < guessN; i++) gcells.push({ task });
  let gdone = 0;
  const raw = await pool(gcells, concurrency, async ({ task }) => {
    const pr = await guessProduce(task);
    const au = await audit(task, (pr && pr.spec) || "");
    const correct = [...new Set(((au && au.decisions) || []).filter((d) => d.correct).map((d) => d.n))];
    console.log(`  [${++gdone}/${gcells.length}] ${task.id}: guessed ${correct.length}/${task.decisions_total} correct`);
    return { task: task.id, correct };
  });

  const report = {};
  let md = `# Bias check — ${runLabel}\n\nGuessing with no stakeholder, author=${authorModel}, ${guessN}x per task. A decision is INFERABLE if a capable model guesses it correctly more than ${guessThreshold}/${guessN} times (no elicitation needed); otherwise NON-INFERABLE (only asking gets it).\n`;
  for (const task of tasks) {
    const rs = raw.filter((r) => r && r.task === task.id);
    const rows = [];
    for (let n = 1; n <= task.decisions_total; n++) {
      const c = rs.filter((r) => r.correct.includes(n)).length;
      rows.push({ n, correct: c, of: rs.length, inferable: c > guessThreshold });
    }
    const inferable = rows.filter((r) => r.inferable).map((r) => r.n);
    report[task.id] = { runs: rs.length, threshold: guessThreshold, rows, inferable };
    md += `\n## ${task.id}\n\n| # | guessed correct | verdict |\n|---|---|---|\n`;
    for (const row of rows) md += `| ${row.n} | ${row.correct}/${row.of} | ${row.inferable ? "inferable" : "**non-inferable**"} |\n`;
    md += inferable.length
      ? `\n**Inferable (need hardening): [${inferable.join(", ")}]** — ${task.decisions_total - inferable.length}/${task.decisions_total} are non-inferable.\n`
      : `\nAll ${task.decisions_total} decisions are non-inferable. ✓\n`;
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "bias-check.md"), md);
  writeFileSync(path.join(OUT, "bias-check.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`\n${md}`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}/bias-check.{md,json}`);
}

if (guessOnly) { await runGuessOnly(); process.exit(0); }

// ---- run ----
const totalPlanned = tasks.length * arms.length * iterations;
const cells = [];
for (const task of tasks) for (const arm of arms) for (let i = 0; i < iterations; i++) cells.push({ arm, task, i });
mkdirSync(OUT, { recursive: true });

// --resume: reuse cells already completed for this run-label and run only the ones still
// missing, then merge. Crash-safe: progress.jsonl is appended after every cell, so a pass
// killed mid-way (usage limit, machine sleep) never loses a completed cell. We seed prior
// results from progress.jsonl unioned with any metadata.json, deduped by cell slug.
const PROGRESS = path.join(OUT, "progress.jsonl");
let priorResults = [];
if (resume) {
  const bySlug = new Map();
  const metaPath = path.join(OUT, "metadata.json");
  if (existsSync(metaPath)) for (const c of (readJSON(metaPath).cells || [])) bySlug.set(cellSlug(c), c);
  if (existsSync(PROGRESS)) {
    for (const line of readText(PROGRESS).split("\n")) {
      if (!line.trim()) continue;
      try { const c = JSON.parse(line); bySlug.set(cellSlug(c), c); } catch {}
    }
  }
  priorResults = [...bySlug.values()];
  const doneSlugs = new Set(bySlug.keys());
  const remaining = cells.filter((c) => !doneSlugs.has(`${c.arm.id}__${c.task.id}__iter${c.i + 1}`));
  console.log(`resume:   ${priorResults.length} cells already recorded; running the remaining ${remaining.length}/${totalPlanned}.`);
  cells.length = 0; cells.push(...remaining);
}

let done = 0;
const fresh = (await pool(cells, concurrency, async ({ arm, task, i }) => {
  const c = arm.execution === "agent" ? await runAgentCell(arm, task, i) : await runCell(arm, task, i);
  // append to the crash-safe progress log the instant a cell finishes
  try { appendFileSync(PROGRESS, JSON.stringify(metaCell(c)) + "\n"); } catch {}
  console.log(`  [${++done}/${cells.length}] ${arm.id}/${task.id} iter${i + 1}: captured ${c.captured}/${c.decisions_total}, ${c.questions} questions`);
  return c;
})).filter(Boolean);

// merge prior + fresh, then order by config (task, then arm, then iteration) for a
// clean report regardless of which cells were resumed.
const armOrder = new Map(arms.map((a, i) => [a.id, i]));
const taskOrder = new Map(tasks.map((t, i) => [t.id, i]));
// dedup by slug (fresh wins over prior), then order by config for a clean report
const mergedBySlug = new Map();
for (const r of priorResults) mergedBySlug.set(cellSlug(r), r);
for (const r of fresh) mergedBySlug.set(cellSlug(r), r);
const results = [...mergedBySlug.values()].sort((a, b) =>
  ((taskOrder.get(a.task) ?? 99) - (taskOrder.get(b.task) ?? 99))
  || ((armOrder.get(a.arm) ?? 99) - (armOrder.get(b.arm) ?? 99))
  || (a.iteration - b.iteration));

// ---- reports ----
const pct = (num, den) => (den ? Number(((num / den) * 100).toFixed(1)) : 0);
const cols = ["arm", "task", "iteration", "questions", "captured", "decisions_total", "bespoke_captured", "bespoke_total"];
const csv = [cols.join(",")].concat(results.map((r) => cols.map((c) => (r[c] == null ? "" : r[c])).join(","))).join("\n") + "\n";

const aggRows = arms.map((a) => {
  const rs = results.filter((r) => r.arm === a.id);
  if (!rs.length) return { id: a.id, n: 0 };
  const n = rs.length;
  return {
    id: a.id, n,
    cov: pct(rs.reduce((s, r) => s + r.captured / (r.decisions_total || 1), 0), n),
    bespoke: pct(rs.reduce((s, r) => s + (r.bespoke_total ? r.bespoke_captured / r.bespoke_total : 0), 0), n),
    q: Number((rs.reduce((s, r) => s + r.questions, 0) / n).toFixed(1)),
  };
});
const aggHead = ["arm", "runs", "coverage % (all)", "coverage % (bespoke)", "avg questions"];
const aggMd = ["| " + aggHead.join(" | ") + " |", "|" + aggHead.map(() => "---").join("|") + "|"]
  .concat(aggRows.map((a) => `| ${a.id} | ${a.n} | ${a.n ? a.cov : ""} | ${a.n ? a.bespoke : ""} | ${a.n ? a.q : ""} |`)).join("\n");

const cellHead = ["arm", "task", "iter", "questions", "captured", "of", "bespoke", "of"];
const cellMd = ["| " + cellHead.join(" | ") + " |", "|" + cellHead.map(() => "---").join("|") + "|"]
  .concat(results.map((r) => `| ${r.arm} | ${r.task} | ${r.iteration} | ${r.questions} | ${r.captured} | ${r.decisions_total} | ${r.bespoke_captured} | ${r.bespoke_total} |`)).join("\n");

const provHead = ["arm", "version / source", "fidelity", "sha256"];
const provMd = ["| " + provHead.join(" | ") + " |", "|" + provHead.map(() => "---").join("|") + "|"]
  .concat(arms.map((a) => { const p = a.provenance || {}; return `| ${a.id} | ${String(p.source || "").replace(/\|/g, "\\|")} | ${p.fidelity || ""} | ${p.sha256 ? p.sha256.slice(0, 12) + "…" : ""} |`; })).join("\n");

const reportMd = `# ${name} — ${runLabel}\n\n`
  + `arms: ${arms.map((a) => a.id).join(", ")} · tasks: ${tasks.map((t) => t.id).join(", ")} · iterations: ${iterations} · mode: ${mode} · concurrency: ${concurrency}\n`
  + `models: author=${authorModel} · stakeholder=${stakeholderModel} · auditor=${auditorModel} · endpoint: ${baseURL}\n\n`
  + `## Per-arm summary\n\n${aggMd}\n\n## Per-cell results\n\n${cellMd}\n\n## Arm provenance\n\n${provMd}\n\n`
  + `Full transcripts and per-decision auditor reasoning: \`logs/\`. Machine-readable per-decision capture: \`metadata.json\`.\n`;

const metadata = {
  gauntlet: name, run_label: runLabel, mode, concurrency, iterations,
  endpoint: baseURL,
  models: { author: authorModel, stakeholder: stakeholderModel, auditor: auditorModel },
  arms: arms.map((a) => ({ id: a.id, display: a.display, provenance: a.provenance, limits: a.limits })),
  tasks: tasks.map((t) => ({ id: t.id, decisions_total: t.decisions_total, bespoke_decisions: t.bespoke_decisions })),
  cells: results.map(metaCell),
};

writeFileSync(path.join(OUT, "report.csv"), csv);
writeFileSync(path.join(OUT, "report.md"), reportMd);
writeFileSync(path.join(OUT, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");

console.log(`\nDone. ${results.length}/${totalPlanned} cells.`);
console.log(`\n${aggMd}\n`);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}/{report.csv, report.md, metadata.json} and ${results.length} logs/.`);
