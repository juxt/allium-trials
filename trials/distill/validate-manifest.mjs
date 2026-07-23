#!/usr/bin/env node
// Validates a fixture's golden.json for internal consistency, and cross-checks
// it against the fixture codebase. Catches manifest authoring bugs (a typo'd
// transition endpoint, a terminal state that doesn't exist, a manifest state
// that appears nowhere in the code) before they corrupt a scoring run.
//
// Usage: node validate-manifest.mjs <golden.json> [codebaseDir]
//
// Exits non-zero if any ERROR is found. WARN lines are advisory.

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";

const [goldenPath, codebaseDir = ""] = process.argv.slice(2);
if (!goldenPath) {
  console.error("usage: node validate-manifest.mjs <golden.json> [codebaseDir]");
  process.exit(2);
}

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

let golden;
try {
  golden = JSON.parse(readFileSync(goldenPath, "utf8"));
} catch (e) {
  console.error(`golden.json: invalid JSON — ${e.message}`);
  process.exit(1);
}

// gather codebase text once for cross-checks
let codeText = "";
if (codebaseDir && existsSync(codebaseDir)) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(py|ts|js|tsx|jsx|java|go|rb)$/.test(entry)) codeText += readFileSync(p, "utf8") + "\n";
    }
  };
  walk(codebaseDir);
} else {
  warn(codebaseDir ? `no codebase dir at ${codebaseDir} — skipping code cross-checks` : "no codebase dir given — skipping code cross-checks");
}
const codeLower = codeText.toLowerCase();

if (!Object.keys(golden.entities ?? {}).length) err("no internal entities defined");

for (const [name, e] of Object.entries(golden.entities ?? {})) {
  const states = new Set(e.states ?? []);
  if (!states.size) warn(`${name}: no states (fine for a stateless entity)`);
  // duplicate states
  if ((e.states ?? []).length !== states.size) err(`${name}: duplicate entries in states[]`);
  // transitions (and optional_transitions) reference declared states
  for (const t of [...(e.transitions ?? []), ...(e.optional_transitions ?? [])]) {
    if (!Array.isArray(t) || t.length !== 2) { err(`${name}: malformed transition ${JSON.stringify(t)}`); continue; }
    for (const s of t) if (!states.has(s)) err(`${name}: transition endpoint '${s}' not in states[] (${t.join(" -> ")})`);
  }
  // terminals exist and have no outbound transitions
  for (const term of e.terminal ?? []) {
    if (!states.has(term)) err(`${name}: terminal '${term}' not in states[]`);
    const out = (e.transitions ?? []).find((t) => t[0] === term);
    if (out) warn(`${name}: terminal '${term}' has an outbound transition ${out.join(" -> ")}`);
  }
  // non-terminal states should be reachable / have an exit (advisory).
  // optional_transitions count for reachability (e.g. a wildcard withdraw edge).
  const allTransitions = [...(e.transitions ?? []), ...(e.optional_transitions ?? [])];
  for (const s of states) {
    const isTerminal = (e.terminal ?? []).includes(s);
    const hasOut = allTransitions.some((t) => t[0] === s);
    const hasIn = allTransitions.some((t) => t[1] === s);
    if (!isTerminal && !hasOut && allTransitions.length) warn(`${name}: non-terminal state '${s}' has no outbound transition`);
    if (!hasIn && !hasOut && allTransitions.length) warn(`${name}: state '${s}' is isolated (no transitions touch it)`);
  }
  // state_aliases canonicals must be real states
  for (const canonical of Object.keys(e.state_aliases ?? {})) {
    if (!states.has(canonical)) err(`${name}: state_aliases key '${canonical}' is not a declared state`);
  }
  // cross-check: each state (or one of its aliases) appears in the code.
  // A state is implicit (softer check) only if IT has state_aliases — mixed
  // entities (some enum-backed states, some derived) get the strict check for
  // their explicit states.
  if (codeText) {
    for (const s of states) {
      const aliases = (e.state_aliases?.[s] ?? []);
      const candidates = [s, ...aliases];
      const inCode = candidates.some((c) => codeLower.includes(c.toLowerCase()));
      if (!inCode && !aliases.length) err(`${name}: state '${s}' appears nowhere in the codebase`);
      else if (!inCode) warn(`${name}: state '${s}' (implicit) not found verbatim in code — confirm it is genuinely derived`);
    }
  }
}

// external entities should not be in allowed_extra (they're matched directly)
for (const name of Object.keys(golden.external_entities ?? {})) {
  if ((golden.allowed_extra_entities ?? []).map((x) => x.toLowerCase()).includes(name.toLowerCase()))
    warn(`${name}: listed in both external_entities and allowed_extra_entities`);
}

// rules: non-empty distinctive fingerprints; warn on generic-only ensures
const GENERIC = new Set(["created", "updated", "set", "now", "true", "false", "status"]);
const seenIds = new Set();
for (const r of golden.rules ?? []) {
  if (!r.id) err(`rule with no id: ${JSON.stringify(r).slice(0, 80)}`);
  if (seenIds.has(r.id)) err(`duplicate rule id '${r.id}'`);
  seenIds.add(r.id);
  if (!Array.isArray(r.ensures_all) || !r.ensures_all.length) err(`rule '${r.id}': empty ensures_all (cannot match)`);
  else if (r.ensures_all.every((t) => GENERIC.has(t.toLowerCase())))
    warn(`rule '${r.id}': ensures_all is only generic terms ${JSON.stringify(r.ensures_all)} — may match the wrong block`);
}

// config and exclusions sanity
for (const c of golden.config ?? []) {
  if (!c.name_any?.length) err(`config entry with no name_any: ${JSON.stringify(c)}`);
  if (c.value == null && !c.value_any?.length) err(`config '${c.name_any?.[0]}': no value/value_any`);
}
for (const term of [...(golden.exclusions?.dead_code ?? []), ...(golden.exclusions?.implementation ?? [])]) {
  if (codeText && !codeLower.includes(term.toLowerCase()))
    warn(`exclusion term '${term}' appears nowhere in the codebase — is it a real plant?`);
}

const fixtureName = path.basename(path.dirname(path.resolve(goldenPath)));
console.log(`[${fixtureName}] ${Object.keys(golden.entities ?? {}).length} entities, ${(golden.rules ?? []).length} rules, ${Object.keys(golden.boundaries ?? {}).length} boundaries`);
for (const w of warns) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(`  => ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
