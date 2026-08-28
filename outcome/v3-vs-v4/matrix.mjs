#!/usr/bin/env node
// v3-vs-v4 differential matrix. Model-free, signature-based. For each property class we
// hold a CORRECT and a FAULTED spec in each version that can express it. Each (class,
// version) has a SIGNATURE: the diagnostic that indicates catching THAT fault. A version
// CATCHES when its signature appears on the faulted spec and not on the correct one — so
// an incidental, unrelated finding never inflates a catch. A `null` signature means the
// version has no check for that class (cannot catch it). Soundness (TOOL-6): the signature
// appearing on the CORRECT spec is a false alarm, worse than a miss.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "corpus");
const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";

function jrun(cmd, file) {
  const r = spawnSync(ALLIUM, [cmd, file], { encoding: "utf8", maxBuffer: 1 << 26 });
  try { return JSON.parse(r.stdout); } catch { return {}; }
}
function messages(file, ver) {
  const out = [];
  const chk = jrun("check", file);
  for (const d of chk.diagnostics || []) out.push(`${d.severity}:${d.code || ""}:${d.message || ""}`);
  const ana = jrun("analyse", file);
  for (const f of ana.findings || []) out.push(`finding:${f.type}:${f.summary || ""}`);
  for (const d of ana.diagnostics || []) out.push(`${d.severity}:${d.code || ""}:${d.message || ""}`);
  return out;
}

// class -> { v3: signature|null, v4: signature|null }. null = no check for this class.
const CLASSES = {
  structural: { v3: /error:/, v4: /error:|is not declared/ },
  consistency: { v3: null, v4: /CONTRADICTORY/ },
  feasibility: { v3: /finding:(deadlock|dead_transition|missing_producer)/, v4: /INFEASIBLE/ },
  casesplit: { v3: null, v4: /NOT disjoint|uncovered/ },
  conflict: { v3: /finding:conflict/, v4: /NOT disjoint/ },
  "conflict-call": { v3: /finding:conflict/, v4: /NOT disjoint/ },
  lifecycle: { v3: /finding:deadlock/, v4: null },
};

function verdict(cls, ver, sig) {
  if (sig === null) return { v: "—" }; // this version has no check for this class
  const faulted = join(CORPUS, cls, `${ver}.faulted.allium`);
  if (!existsSync(faulted)) return { v: "no-spec" };
  const correct = join(CORPUS, cls, `${ver}.correct.allium`);
  const fMsgs = messages(faulted, ver);
  const cMsgs = existsSync(correct) ? messages(correct, ver) : [];
  const inFaulted = fMsgs.some((m) => sig.test(m));
  const inCorrect = cMsgs.some((m) => sig.test(m));
  return { v: inFaulted && !inCorrect ? "CATCH" : "miss", falseAlarm: inCorrect };
}

const rows = Object.entries(CLASSES).map(([cls, sigs]) => ({
  cls, v3: verdict(cls, "v3", sigs.v3), v4: verdict(cls, "v4", sigs.v4),
}));

const cell = (r) => (r.v === "—" ? "  —   " : r.v === "no-spec" ? " (no spec)" : r.v === "CATCH" ? (r.falseAlarm ? "CATCH!" : "CATCH ") : " miss  ");
const w = 12;
console.log("\nv3-vs-v4 differential matrix (signature-based; — = no such check; CATCH! = false alarm)\n");
console.log("property".padEnd(w) + "  v3       v4       reading");
for (const r of rows) {
  const read =
    r.v3.v === "—" && r.v4.v === "CATCH" ? "v4-only (v3 has no such check)" :
    r.v4.v === "—" && r.v3.v === "CATCH" ? "v4 GAP (v3 does it, v4 cannot express)" :
    r.v3.v === "CATCH" && r.v4.v === "CATCH" ? "parity" :
    r.v3.v === "miss" && r.v4.v === "CATCH" ? "v4 better (v3 has the check but missed)" :
    r.v4.v === "miss" && r.v3.v === "CATCH" ? "v4 regression" : "—";
  console.log(r.cls.padEnd(w) + "  " + cell(r.v3).padEnd(9) + "" + cell(r.v4).padEnd(9) + "" + read);
}
console.log("\nv4 GAPS (v3 does, v4 cannot — the build list):",
  rows.filter((r) => r.v4.v === "—" && r.v3.v === "CATCH").map((r) => r.cls).join(", ") || "—");
console.log("v4-only capabilities (v3 cannot):",
  rows.filter((r) => r.v3.v === "—" && r.v4.v === "CATCH").map((r) => r.cls).join(", ") || "—");
