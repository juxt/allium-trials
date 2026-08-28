#!/usr/bin/env node
// Dual-syntax distil-at-scale, v3 vs v4, in ISOLATION. Each arm distils the real
// ProgressiveEMICalculator (2204 lines) into a spec of its OWN version, seeing only its own
// distil skill + language reference (no bleed). The v4 arm loops through the v4 CLI
// (allium check/analyse) to validate and conform. An external judge then scores each spec on
// COMPLETENESS and ELEGANCE against the reference invariants, and the process surfaces where
// v4 can't capture things cleanly (the OPEN lines it is told to write).
//
// Usage: node distill-dual.mjs [--arm v3|v4|judge] [--runs 1]

import { spawnSync } from "node:child_process";
import { mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs-dual");
const PLUGIN = "/Users/hgarner/code/allium";
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";
const CALC = join(HERE, "checkout", "fineract-progressive-loan", "src", "main", "java",
  "org", "apache", "fineract", "portfolio", "loanproduct", "calc", "ProgressiveEMICalculator.java");
const REFSPEC = join(HERE, "LoanScheduleInvariants.allium");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt("--arm", "v3");
const MODEL = opt("--model", "claude-opus-4-8");

const MATERIAL = {
  v3: { skill: join(PLUGIN, "skills/distill/SKILL.md"), ref: join(PLUGIN, "skills/allium/references/language-reference.md"), tag: 3, extra: "" },
  v4: { skill: join(PLUGIN, "skills-v4/distill/SKILL.md"), ref: join(PLUGIN, "skills-v4/allium/references/language-reference-v4.md"), tag: 4,
        extra: `Also run \`${ALLIUM} analyse spec.allium\`: if it reports the invariants CONTRADICTORY, you mis-stated a behaviour — reconcile against the code. Where a real load-bearing behaviour cannot be stated cleanly in v4, write it as an \`-- OPEN: v4 cannot express <behaviour>: <why>\` line rather than forcing it.` },
};

function claude(prompt, ws, turns) {
  return spawnSync("claude", ["-p", prompt, "--output-format", "text", "--model", MODEL,
    "--max-turns", String(turns), "--permission-mode", "bypassPermissions", "--setting-sources", "project"],
    { cwd: ws, encoding: "utf8", maxBuffer: 1 << 28, timeout: 900000, killSignal: "SIGKILL" });
}

function runArm(ver) {
  const m = MATERIAL[ver];
  const ws = join(RUNS, ver); mkdirSync(ws, { recursive: true });
  cpSync(m.skill, join(ws, "distil-skill.md"));
  cpSync(m.ref, join(ws, "language-reference.md"));
  cpSync(CALC, join(ws, "ProgressiveEMICalculator.java"));
  const prompt =
    `You are distilling an Allium v${m.tag} specification from code, in isolation — use ONLY the ` +
    `v${m.tag} materials in this directory.\n` +
    `Read distil-skill.md (the process) and language-reference.md (Allium v${m.tag} syntax). Then read ` +
    `ProgressiveEMICalculator.java — the core of a loan repayment-schedule / EMI calculator — and ` +
    `distil its SALIENT behavioural invariants (the load-bearing properties a change must never break: ` +
    `EMI/instalment, interest, principal, outstanding balance, the schedule) into a specification ` +
    `named spec.allium, whose first line is \`-- allium: ${m.tag}\`.\n` +
    `VALIDATE with the CLI: run \`${ALLIUM} check spec.allium\` and fix every error. ${m.extra}\n` +
    `Iterate — distil, check, re-read the code, conform — until spec.allium checks clean and faithfully ` +
    `mirrors the code's load-bearing behaviours. Leave the final spec.allium in this directory.`;
  claude(prompt, ws, 28);
  const path = join(ws, "spec.allium");
  const spec = existsSync(path) ? readFileSync(path, "utf8") : "(no spec.allium produced)";
  // record whether it checks clean
  const chk = spawnSync(ALLIUM, ["check", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  let errs = 0; try { errs = (JSON.parse(chk.stdout).diagnostics || []).filter((d) => d.severity === "error").length; } catch {}
  writeFileSync(join(ws, "spec.saved.allium"), spec);
  console.log(`${ver}: spec produced (${spec.split("\n").length} lines), check errors=${errs}, OPEN lines=${(spec.match(/-- OPEN:/g) || []).length}`);
}

function judge() {
  const ref = readFileSync(REFSPEC, "utf8");
  const v3 = existsSync(join(RUNS, "v3", "spec.allium")) ? readFileSync(join(RUNS, "v3", "spec.allium"), "utf8") : "(none)";
  const v4 = existsSync(join(RUNS, "v4", "spec.allium")) ? readFileSync(join(RUNS, "v4", "spec.allium"), "utf8") : "(none)";
  const ws = join(RUNS, "judge"); mkdirSync(ws, { recursive: true });
  const prompt =
    `You are an impartial reviewer scoring two distilled specifications of the SAME loan EMI/schedule ` +
    `calculator, written in two versions of a spec language (Allium v3 and v4). A reference list of the ` +
    `7 salient invariants that MUST be captured is given.\n\n` +
    `=== REFERENCE (the load-bearing invariants) ===\n${ref}\n\n` +
    `=== SPEC A (Allium v3) ===\n${v3}\n\n=== SPEC B (Allium v4) ===\n${v4}\n\n` +
    `For EACH spec, judge:\n` +
    `- COMPLETENESS (0-10): how many of the 7 reference invariants it genuinely captures (name which it ` +
    `misses), plus any correct load-bearing behaviour beyond them.\n` +
    `- ELEGANCE (0-10): how cleanly and naturally it expresses them — is the encoding direct, or awkward/` +
    `forced? Note specific awkwardness.\n` +
    `Then state which version captured the loan-schedule behaviour better and WHERE v4 specifically is ` +
    `weaker or more awkward than v3 (the finding that matters for growing v4).\n` +
    `Output:\nA_COMPLETENESS: <n>/10\nA_ELEGANCE: <n>/10\nB_COMPLETENESS: <n>/10\nB_ELEGANCE: <n>/10\n` +
    `then a few sentences of reasons and the v4-specific weaknesses.`;
  const out = claude(prompt, ws, 3);
  writeFileSync(join(ws, "verdict.txt"), out.stdout || "");
  console.log("\n=== JUDGE VERDICT ===\n" + (out.stdout || "").trim());
}

mkdirSync(RUNS, { recursive: true });
if (ARM === "judge") judge();
else runArm(ARM);
