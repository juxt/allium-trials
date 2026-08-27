// Fidelity scorer for Trial F. Runs `allium route` on a drafted spec and compares its
// routing against the hidden oracle (oracle-uti.mjs) over the full 4096-combination
// space. A draft is FAITHFUL iff, for every combination, exactly one action fires and it
// is the action the table routes to. Robust to the variable name (atoms are keyed by
// predicate name) and to a draft that uses a subset of the 12 conditions.

import { spawnSync } from "node:child_process";
import { route, CONDITIONS, OUTCOMES } from "./oracle-uti.mjs";

const ALLIUM = "/Users/hgarner/code/allium-tools/target/debug/allium";

export function scoreFidelity(specPath) {
  const r = spawnSync(ALLIUM, ["route", specPath], { encoding: "utf8", maxBuffer: 1 << 28 });
  let d;
  try { d = JSON.parse(r.stdout); } catch { return { ok: false, reason: "route output unparseable" }; }
  if (d.error) return { ok: false, reason: d.error };

  const draftKeys = d.atoms.map((a) => a.replace(/\(.*$/, "").trim());
  const unknownConds = draftKeys.filter((k) => !CONDITIONS.includes(k));
  const missingConds = CONDITIONS.filter((k) => !draftKeys.includes(k));
  const usedActions = new Set();
  for (const row of d.rows) for (const nm of row) usedActions.add(nm);
  const unknownActions = [...usedActions].filter((nm) => !OUTCOMES.includes(nm));

  const nFull = CONDITIONS.length;
  let correct = 0, structOne = 0, total = 0, firstMismatch = null;
  for (let full = 0; full < (1 << nFull); full++) {
    const assign = {};
    CONDITIONS.forEach((k, i) => { assign[k] = ((full >> i) & 1) === 1; });
    let dmask = 0;
    for (let i = 0; i < draftKeys.length; i++) if (assign[draftKeys[i]]) dmask |= (1 << i);
    const firing = d.rows[dmask] || [];
    if (firing.length === 1) structOne++;
    const expected = route(assign);
    const ok = firing.length === 1 && firing[0] === expected;
    if (ok) correct++;
    else if (!firstMismatch) firstMismatch = { assign, expected, firing };
    total++;
  }
  return {
    ok: true,
    total,
    correct,
    structOne,
    fidelity: +(correct / total).toFixed(4),
    faithful: correct === total,
    vocabOk: unknownConds.length === 0 && unknownActions.length === 0 && missingConds.length === 0,
    unknownConds,
    missingConds,
    unknownActions,
    firstMismatch,
  };
}

if (process.argv[1] && process.argv[1].endsWith("fidelity.mjs")) {
  console.log(JSON.stringify(scoreFidelity(process.argv[2]), null, 2));
}
