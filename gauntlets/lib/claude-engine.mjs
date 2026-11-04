// Claude-native execution engine for the gauntlet: every model call runs through
// the `claude` CLI (`claude -p`), which authenticates via the user's Claude
// subscription rather than API credits. The produce step runs in a scratch
// workspace whose PostToolUse hook runs `allium check`/`analyse` on every
// `.allium` write and blocks (exit 2) until clean — so the author is forced to
// correct a broken spec in the same turn (the "whiteboard effect"), exactly as a
// real Allium user has it configured.
//
// Selected in run.mjs with --engine claude (or GAUNTLET_ENGINE=claude). The
// default engine stays openai/litellm so the published runner remains model-agnostic.

import { spawn, execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync, readdirSync, statSync } from "fs";
import os from "os";
import path from "path";
import { parseJSON } from "./provider.mjs";

// Run `claude` in its OWN process group (detached) so a timeout can kill the whole
// tree. claude -p spawns node workers / MCP children that leak as orphans if we only
// kill the parent — that caused an 81-process pile-up when savings cells hung.
function runClaude(args, { cwd, timeout = 600000, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "", settled = false;
    const done = (fn, v) => { if (settled) return; settled = true; clearTimeout(timer); fn(v); };
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
      const e = new Error("claude -p timed out"); e.killed = true; e.stderr = err;
      done(reject, e);
    }, timeout);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => done(reject, e));
    child.on("close", (code) => {
      if (code === 0) done(resolve, { stdout: out, stderr: err });
      else { const e = new Error(`claude exited ${code}`); e.code = code; e.stderr = err; e.stdout = out; done(reject, e); }
    });
  });
}

// CRITICAL: strip API-key auth from the environment we hand to `claude -p`. If
// ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set, the CLI uses it and bills
// API credits instead of the claude.ai subscription. We load .env (which carries
// the key for the litellm proxy) into this process, so we must remove it here so
// `claude -p` authenticates with the subscription login.
const CLAUDE_ENV = (() => { const e = { ...process.env }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e; })();

// litellm model aliases like "claude-opus" -> claude CLI --model alias "opus"
const mapModel = (m) => String(m || "opus").replace(/^claude-/, "");

// A plain claude -p call that returns parsed JSON (for ask / stakeholder / audit).
export async function claudeJSON({ model, system, user, timeout = 600000, retries = 3 }) {
  const prompt = (system ? system + "\n\n" : "") + user;
  let last;
  for (let a = 0; a < retries; a++) {
    try {
      const { stdout } = await runClaude(["-p", prompt, "--model", mapModel(model), "--output-format", "json"], { timeout, env: CLAUDE_ENV });
      let env;
      try { env = JSON.parse(stdout); } catch { return parseJSON(stdout); }
      const text = env.result ?? env.text ?? "";
      return parseJSON(text);
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (a + 1))); }
  }
  const detail = String((last && last.stderr) || (last && last.message) || last).slice(0, 600);
  throw new Error(`claude -p failed after ${retries}: [code=${last && last.code} signal=${last && last.signal}] ${detail}`);
}

const HOOK = `#!/bin/bash
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{console.log((JSON.parse(s).tool_input||{}).file_path||"")}catch(e){console.log("")}})')
LOG="\${CLAUDE_PROJECT_DIR:-.}/hook.log"
case "$FILE" in
  *.allium)
    CHK=$(allium check "$FILE" 2>&1); RC=$?
    echo "check rc=$RC" >> "$LOG"
    if [ $RC -ne 0 ]; then printf 'allium check reported problems you must fix:\\n%s\\n' "$CHK" >&2; exit 2; fi
    AN=$(allium analyse "$FILE" 2>&1)
    if echo "$AN" | grep -qiE 'contradict|infeasible|vacuous|unsat'; then echo "analyse blocked" >> "$LOG"; printf 'allium analyse found a consistency problem you must fix:\\n%s\\n' "$AN" >&2; exit 2; fi
    echo "clean" >> "$LOG"
    ;;
esac
exit 0
`;

// Produce a spec as a real claude -p agent, with the allium-check hook live.
// The prompt must instruct writing the spec to `spec.allium` in the cwd.
export async function claudeProduceHooked({ model, prompt, timeout = 900000, retries = 2 }) {
  let lastLog = "";
  for (let a = 0; a < retries; a++) {
    const ws = mkdtempSync(path.join(os.tmpdir(), "gauntlet-hook-"));
    try {
      mkdirSync(path.join(ws, ".claude", "hooks"), { recursive: true });
      const hookPath = path.join(ws, ".claude", "hooks", "allium-check.sh");
      writeFileSync(hookPath, HOOK); chmodSync(hookPath, 0o755);
      writeFileSync(path.join(ws, ".claude", "settings.json"), JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Write|Edit", hooks: [{ type: "command", command: hookPath }] }] } }));
      try {
        await runClaude(["-p", prompt, "--permission-mode", "acceptEdits", "--model", mapModel(model)], { cwd: ws, timeout, env: CLAUDE_ENV });
      } catch { /* claude -p may exit non-zero; still try to read the file */ }
      let spec = "", hookLog = "";
      try { spec = readFileSync(path.join(ws, "spec.allium"), "utf8"); } catch {}
      try { hookLog = readFileSync(path.join(ws, "hook.log"), "utf8"); } catch {}
      lastLog = hookLog;
      if (spec) return { spec, hookLog, check_runs: (hookLog.match(/check rc=/g) || []).length };
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
  return { spec: "", hookLog: lastLog, check_runs: (lastLog.match(/check rc=/g) || []).length };
}

// One turn of a persistent claude session. Returns { result, sessionId }.
async function claudeTurn({ ws, message, model, sessionId, timeout }) {
  const base = ["--permission-mode", "bypassPermissions", "--model", mapModel(model), "--output-format", "json"];
  const args = sessionId ? ["-p", "--resume", sessionId, message, ...base] : ["-p", message, ...base];
  const { stdout } = await runClaude(args, { cwd: ws, timeout, env: CLAUDE_ENV });
  let env; try { env = JSON.parse(stdout); } catch { return { result: stdout, sessionId }; }
  return { result: env.result ?? env.text ?? "", sessionId: env.session_id || sessionId };
}

// Snapshot the set of relative file paths under a dir (used to remember exactly which
// files the installed overlay put in the workspace, so they are never mistaken for the
// agent's output).
function listRel(dir, rel = "", out = new Set()) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name), r = rel ? rel + "/" + name : name;
    if (statSync(p).isDirectory()) listRel(p, r, out); else out.add(r);
  }
  return out;
}

// Gather the specification the agent produced. Prefer an explicit spec.md; otherwise
// concatenate the substantive markdown the agent wrote under docs/ or specs/ (the tools
// write their artefact to their own conventional paths). Never returns a file that was
// part of the installed overlay (`exclude`) — only what the agent actually created.
function collectArtefact(ws, exclude = new Set()) {
  const direct = path.join(ws, "spec.md");
  if (existsSync(direct) && !exclude.has("spec.md")) { const t = readFileSync(direct, "utf8"); if (t.trim()) return t; }
  const skip = new Set([".claude", ".specify", "node_modules", ".git"]);
  const hits = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = path.join(dir, name), r = rel ? rel + "/" + name : name;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, r);
      else if (/\.(md|allium|txt)$/.test(name) && name !== "brief.md" && !exclude.has(r)) hits.push({ r, p, size: st.size });
    }
  };
  try { walk(ws, ""); } catch {}
  if (!hits.length) return "";
  // Prefer requirements/spec/prd artefacts under docs/ or specs/; fall back to the largest.
  const pref = hits.filter((h) => /(requirement|spec|prd|use[_-]?case)/i.test(h.r)).sort((a, b) => b.size - a.size);
  const chosen = (pref.length ? pref : hits.sort((a, b) => b.size - a.size)).slice(0, 6);
  return chosen.map((h) => `<!-- ${h.r} -->\n` + readFileSync(h.p, "utf8")).join("\n\n");
}

// Run an arm as a REAL Claude Code agent with its authentic skills installed, and let
// the harness play the stakeholder in the chat. The tool runs exactly as its users run
// it: it asks questions in plain language; `answerTurn(agentMessage)` returns the
// stakeholder's reply (from the answer key) plus how many questions it answered and
// whether the engineer signalled done. No protocol is imposed on the tool — the stop
// decision lives with the stakeholder, as it does with a human. Returns
// { spec, transcript, questions, turns }.
export async function claudeAgentInterview({ model, overlayDir, brief, answerTurn, maxTurns = 16, timeout = 900000 }) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "gauntlet-agent-"));
  try {
    // lay the tool's authentic package into the workspace (skills, scripts, templates)
    let overlayFiles = new Set();
    if (overlayDir && existsSync(overlayDir)) { execFileSync("cp", ["-R", overlayDir + "/.", ws]); overlayFiles = listRel(ws); }
    writeFileSync(path.join(ws, "brief.md"), brief);
    const opening =
      `I need a requirements specification for a feature. Here is the brief:\n\n${brief}\n\n` +
      `Please work through your normal process to produce a complete requirements specification, using your installed skills. ` +
      `I am the product stakeholder for this system, so ask me whatever you need to pin down the requirements; ` +
      `I will answer. When the specification is complete, save it as spec.md in this directory and tell me it is done.`;
    const transcript = [];
    let sessionId = null, message = opening, questions = 0, turn = 0;
    for (; turn < maxTurns; turn++) {
      let r;
      try { r = await claudeTurn({ ws, message, model, sessionId, timeout }); }
      catch (e) { transcript.push({ agent: `(agent turn errored: ${String(e.message).slice(0, 200)})`, stakeholder: "" }); break; }
      sessionId = r.sessionId;
      const agentMsg = r.result || "";
      const st = await answerTurn(agentMsg, transcript);
      const reply = (st && st.reply) || "";
      questions += (st && st.questions_answered) || 0;
      transcript.push({ agent: agentMsg, stakeholder: reply });
      const specPresent = existsSync(path.join(ws, "spec.md"));
      if ((st && st.engineer_finished) || (specPresent && (!st || !st.questions_answered))) break;
      message = reply || "Please continue.";
    }
    const spec = collectArtefact(ws, overlayFiles);
    return { spec, transcript, questions, turns: turn + 1 };
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
