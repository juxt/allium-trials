#!/usr/bin/env node
// Side-by-side v3 vs v4 conformance runner.
//
// The Allium binary carries BOTH language pipelines, dispatched on the
// `-- allium: N` header, so one binary gives both contestants. For each matched
// pair under pairs/<name>/ (a v3.allium and a v4.allium of the same system) this
// runs `allium check` on each and prints the diagnostics side by side.
//
// Scope today is the CHECK level — parse-error ergonomics, well-formedness and
// name resolution — where v3 and v4 are genuinely comparable. Verdict-level
// comparison (discharge / the diagnostic contract, where v4's design wins) is
// added once the v4 analyse layer (4c) lands; comparing verdicts now would
// misrepresent v4, whose analyse layer is not built.
//
// Usage: node run.mjs   (ALLIUM_BIN overrides the binary path)

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = process.env.ALLIUM_BIN ||
  join(HERE, "..", "..", "allium-tools", "target", "debug", "allium");
const PAIRS = join(HERE, "pairs");

function check(file) {
  let stdout;
  try {
    stdout = execFileSync(BIN, ["check", file], { encoding: "utf8" });
  } catch (e) {
    stdout = e.stdout || ""; // check exits non-zero when there are diagnostics
  }
  let d;
  try {
    d = JSON.parse(stdout);
  } catch {
    return { lang: "?", errors: ["<no JSON output>"], warnings: [] };
  }
  const ds = d.diagnostics || [];
  const bySev = (s) =>
    ds.filter((x) => String(x.severity || "").toLowerCase() === s).map((x) => x.message);
  return { lang: d.language_version || 3, errors: bySev("error"), warnings: bySev("warning") };
}

function summarise(r) {
  if (r.errors.length) return `MALFORMED  ${r.errors[0]}`;
  const w = r.warnings.length ? `  (${r.warnings.length} warning${r.warnings.length > 1 ? "s" : ""}${r.warnings[0] ? ": " + r.warnings[0] : ""})` : "";
  return `well-formed${w}`;
}

const pairs = readdirSync(PAIRS)
  .filter((p) => statSync(join(PAIRS, p)).isDirectory())
  .filter((p) => existsSync(join(PAIRS, p, "v3.allium")) && existsSync(join(PAIRS, p, "v4.allium")))
  .sort();

console.log("Allium v3-vs-v4 side-by-side (check level: parse + well-formedness + name resolution)\n");
let agree = 0;
for (const p of pairs) {
  const v3 = check(join(PAIRS, p, "v3.allium"));
  const v4 = check(join(PAIRS, p, "v4.allium"));
  const v3wf = v3.errors.length === 0;
  const v4wf = v4.errors.length === 0;
  const verdictAgrees = v3wf === v4wf;
  if (verdictAgrees) agree++;
  console.log(`■ ${p}   [${verdictAgrees ? "agree" : "DIFFER"} on well-formed]`);
  console.log(`    v3:  ${summarise(v3)}`);
  console.log(`    v4:  ${summarise(v4)}`);
  console.log("");
}
console.log(`pairs: ${pairs.length}   agree on well-formed: ${agree}/${pairs.length}`);
console.log("(check level only — verdict-level comparison awaits the v4 analyse layer, 4c)");
