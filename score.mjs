#!/usr/bin/env node
// Scores a distilled Allium spec against a golden manifest.
//
// Usage: node score.mjs <spec.allium> <golden.json>
//
// Prints a JSON report to stdout. Deterministic: structural validity comes
// from `allium check`, entity/state/transition recall from `allium model`,
// rule and config matching from text analysis of the spec, and exclusion
// violations from word-boundary search. No LLM involvement, so the score
// cannot drift between runs of the scorer itself.
//
// Recall asks "did the spec find the golden items?". Precision asks the
// inverse — "did the spec invent items the code does not support?" — because
// that is the failure mode aggressive token-cutting causes: an agent that
// reads less code confabulates plausible-but-wrong states, transitions and
// rules. The manifest defines each matched entity's states and transitions
// EXHAUSTIVELY, so any extra one is unambiguous confabulation and fails the
// gate. Extra entities/rules are judgement calls (a reasonable supporting
// entity vs a hallucinated one), so they are surfaced for review but do not
// auto-fail, keeping the gate's pass/fail trustworthy.

import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const [specPath, goldenPath] = process.argv.slice(2);
if (!specPath || !goldenPath) {
  console.error("usage: node score.mjs <spec.allium> <golden.json>");
  process.exit(2);
}

// Runs `allium <args>`, returning combined output on diagnostic (non-zero)
// exits. A missing binary is fatal: silently treating it as "no diagnostics"
// would score the spec as structurally valid while recall scores as zero.
function alliumExec(args) {
  try {
    return execFileSync("allium", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("fatal: `allium` CLI not found on PATH — scoring requires it. Install allium and re-run.");
      process.exit(2);
    }
    return `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
  }
}

const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
const report = {
  spec: specPath,
  structural: { spec_exists: existsSync(specPath), check_passed: false, check_output: "" },
  entities: {},
  external_entities: {},
  rules: { matched: [], missed: [] },
  config: { matched: [], missed: [] },
  exclusions: { violations: [] },
  precision: { spurious_states: [], spurious_transitions: [], spurious_entities: [], extra_rules: [] },
  summary: {},
};

function emit(code) {
  const s = report.summary;
  s.quality_pass =
    report.structural.check_passed &&
    s.entity_recall === 1 &&
    s.state_recall >= 0.9 &&
    s.transition_recall >= 0.9 &&
    s.rule_recall >= 0.8 &&
    report.exclusions.violations.length === 0 &&
    // confabulated states/transitions on matched entities are unambiguous and fail the gate
    report.precision.spurious_states.length === 0 &&
    report.precision.spurious_transitions.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(code);
}

if (!report.structural.spec_exists) {
  report.summary = { entity_recall: 0, state_recall: 0, transition_recall: 0, rule_recall: 0, config_recall: 0, confabulation_free: true };
  emit(0);
}

const specText = readFileSync(specPath, "utf8");

// --- structural validity ---------------------------------------------------
// `allium check` exits non-zero when any diagnostics exist; the gate only
// fails on severity "error" — warnings are advisory and a faithful spec can
// legitimately carry some (e.g. process-level observations).
{
  const out = alliumExec(["check", specPath]);
  let errors = [];
  let warnings = [];
  try {
    const diags = JSON.parse(out).diagnostics ?? [];
    errors = diags.filter((d) => d.severity === "error");
    warnings = diags.filter((d) => d.severity !== "error");
  } catch {
    if (out.trim()) errors = [{ message: out.slice(0, 2000) }];
  }
  report.structural.check_passed = errors.length === 0;
  report.structural.errors = errors;
  report.structural.warning_count = warnings.length;
  delete report.structural.check_output;
}

// --- entity / state / transition recall via `allium model` ------------------
let model = { entities: [] };
try {
  model = JSON.parse(alliumExec(["model", specPath]));
} catch {
  // unparseable spec: recall scored against empty model
}

const norm = (s) => s.toLowerCase().replace(/[_\s-]/g, "");
const findEntity = (name, aliases) => {
  const wanted = [name, ...(aliases ?? [])].map(norm);
  return (model.entities ?? []).find((e) => wanted.includes(norm(e.name)));
};

// state_aliases in the manifest map canonical state names to accepted
// synonyms (needed where the code defines no state-name strings and the
// distiller must invent them). Alias maps are scoped per entity for state and
// transition matching — two entities may map the same synonym to different
// canonicals. A merged table exists only for rule/config term matching, where
// extra breadth merely widens fuzzy candidate matching.
const aliasMapFor = (exp) => {
  const m = new Map();
  for (const [canonical, synonyms] of Object.entries(exp.state_aliases ?? {})) {
    for (const syn of synonyms) m.set(norm(syn), norm(canonical));
  }
  return m;
};
const mergedAlias = new Map();
for (const exp of [...Object.values(golden.entities), ...Object.values(golden.external_entities ?? {})]) {
  for (const [syn, can] of aliasMapFor(exp).entries()) mergedAlias.set(syn, can);
}

// model-entity names accounted for by the manifest (matched expected entities
// + declared external + allowlisted supporting/cross-cutting entities); any
// model entity outside this set is a candidate confabulation.
const accounted = new Set((golden.allowed_extra_entities ?? []).map(norm));

const tally = { entities: 0, states: { hit: 0, total: 0 }, transitions: { hit: 0, total: 0 } };
for (const [name, exp] of Object.entries(golden.entities)) {
  const entityAlias = aliasMapFor(exp);
  const canon = (s) => entityAlias.get(norm(s)) ?? norm(s);
  const found = findEntity(name, exp.aliases);
  const entry = { found: !!found, matched_as: found?.name ?? null, missing_states: [], missing_transitions: [] };
  tally.states.total += exp.states.length;
  tally.transitions.total += exp.transitions.length;
  if (found) {
    tally.entities += 1;
    accounted.add(norm(found.name));
    const states = new Set([
      ...(found.fields ?? []).flatMap((f) => f.enum_values ?? []),
      ...(found.transition_graphs ?? []).flatMap((g) => g.states ?? []),
    ].map(canon));
    const edges = new Set(
      (found.transition_graphs ?? []).flatMap((g) => (g.edges ?? []).map((e) => `${canon(e.from)}>${canon(e.to)}`))
    );
    for (const s of exp.states) {
      if (states.has(canon(s))) tally.states.hit += 1;
      else entry.missing_states.push(s);
    }
    for (const [from, to] of exp.transitions) {
      if (edges.has(`${canon(from)}>${canon(to)}`)) tally.transitions.hit += 1;
      else entry.missing_transitions.push(`${from} -> ${to}`);
    }
    // closed-world precision: manifest states/transitions are exhaustive, so
    // anything extra on a matched entity is confabulation. de-canonicalised
    // expected sets so accepted synonyms are not flagged. optional_transitions
    // are allowed (not flagged spurious) but not required (not in recall) —
    // for wildcard edges like "withdraw from any non-terminal state".
    const expStates = new Set(exp.states.map(canon));
    const expEdges = new Set(exp.transitions.map(([f, t]) => `${canon(f)}>${canon(t)}`));
    const allowedEdges = new Set([
      ...expEdges,
      ...(exp.optional_transitions ?? []).map(([f, t]) => `${canon(f)}>${canon(t)}`),
    ]);
    for (const st of states) if (!expStates.has(st)) report.precision.spurious_states.push(`${found.name}.${st}`);
    for (const e of edges) if (!allowedEdges.has(e)) report.precision.spurious_transitions.push(`${found.name}: ${e.replace(">", " -> ")}`);
  } else {
    entry.missing_states = exp.states;
    entry.missing_transitions = exp.transitions.map(([a, b]) => `${a} -> ${b}`);
  }
  report.entities[name] = entry;
}

for (const [name, exp] of Object.entries(golden.external_entities ?? {})) {
  const found = findEntity(name, exp.aliases);
  if (found) accounted.add(norm(found.name));
  report.external_entities[name] = {
    found: !!found,
    matched_as: found?.name ?? null,
    declared_external: found?.kind === "external",
  };
}

// Internal model entities not accounted for by the manifest — surfaced for
// review, not auto-failed (a reasonable supporting entity vs a hallucinated
// one is a judgement call). Grow allowed_extra_entities for genuine support
// types. External entities are excluded: distill legitimately models boundary
// parties/actors as `external entity` declarations (e.g. one per auth role),
// which vary by judgement and carry no invented internal behaviour.
for (const e of model.entities ?? []) {
  if (e.kind === "external") continue;
  if (!accounted.has(norm(e.name))) report.precision.spurious_entities.push(e.name);
}

// --- rule matching ----------------------------------------------------------
// Split the spec into rule blocks; an expected rule matches a block when every
// ensures_all term appears after the block's first `ensures` and at least one
// requires_any term (if any) appears before it.
const ruleBlocks = [];
const ruleRe = /^rule\s+(\w+)/gm;
let m;
const starts = [];
while ((m = ruleRe.exec(specText)) !== null) starts.push({ name: m[1], index: m.index });
for (let i = 0; i < starts.length; i++) {
  const end = i + 1 < starts.length ? starts[i + 1].index : specText.length;
  // a rule block ends at the next top-level declaration, if one comes sooner
  const tail = specText.slice(starts[i].index, end);
  const nextDecl = tail.search(/^\s*(entity|surface|invariant|config|contract|value|external)\b/m);
  ruleBlocks.push({ name: starts[i].name, text: nextDecl > 0 ? tail.slice(0, nextDecl) : tail });
}

// a manifest term matches if the term itself or any accepted state synonym
// for it appears (rule matching uses the merged alias table — see above)
const variants = (term) => {
  const out = [term];
  for (const [syn, can] of mergedAlias.entries()) if (can === norm(term)) out.push(syn);
  return out;
};
const has = (text, term) => {
  const t = text.toLowerCase().replace(/[_\s-]/g, "");
  return variants(term).some((v) => t.includes(norm(v)));
};
// Each expected rule's candidate blocks: those whose post-`ensures` text
// contains every ensures_all term and (if any) at least one requires_any
// term. Matching is one-to-one — a block is claimed by a single expected
// rule — and assigned most-constrained-first, so a weakly-fingerprinted rule
// cannot steal a block that uniquely fits another. (First-match-wins would
// let a vague rule grab the wrong block and inflate recall.)
const candidates = golden.rules.map((exp) => {
  const blocks = ruleBlocks.filter((b) => {
    const split = b.text.search(/\bensures\b/);
    if (split === -1) return false;
    const pre = b.text.slice(0, split);
    const post = b.text.slice(split);
    const ensuresOk = exp.ensures_all.every((t) => has(post, t));
    const requiresOk = exp.requires_any.length === 0 || exp.requires_any.some((t) => has(pre, t));
    return ensuresOk && requiresOk;
  });
  return { exp, blocks };
});
const usedBlocks = new Set();
for (const { exp, blocks } of [...candidates].sort((a, b) => a.blocks.length - b.blocks.length)) {
  const pick = blocks.find((b) => !usedBlocks.has(b.name));
  if (pick) {
    usedBlocks.add(pick.name);
    report.rules.matched.push({ id: exp.id, rule: pick.name });
  } else report.rules.missed.push(exp.id);
}

// rule blocks not matched to any expected rule — informational only, since
// distill may legitimately split or rename rules. Surfaced so a reviewer can
// scan for hallucinated rules (e.g. a rule the code never implements).
const matchedRuleNames = new Set(report.rules.matched.map((r) => r.rule));
report.precision.extra_rules = ruleBlocks.map((b) => b.name).filter((n) => !matchedRuleNames.has(n));

// --- config -----------------------------------------------------------------
const configBlock = specText.match(/^config\s*\{[\s\S]*?^\}/m)?.[0] ?? "";
for (const exp of golden.config ?? []) {
  const values = exp.value_any ?? [exp.value];
  const line = configBlock
    .split("\n")
    .find((l) => exp.name_any.some((n) => has(l, n)) && values.some((v) => has(l, v)));
  if (line) report.config.matched.push({ names: exp.name_any[0], line: line.trim() });
  else report.config.missed.push(exp.name_any[0]);
}

// --- exclusions ---------------------------------------------------------------
const allExclusions = [
  ...(golden.exclusions?.dead_code ?? []).map((t) => ({ term: t, kind: "dead_code" })),
  ...(golden.exclusions?.implementation ?? []).map((t) => ({ term: t, kind: "implementation" })),
];
// Non-normative content is exempt: the skill instructs documenting scope
// exclusions in header comments, and raising dead code as an open question
// for stakeholders is correct distillation, not a leak. A violation is the
// term appearing in normative content (entities, fields, rules, surfaces).
const specContent = specText
  .replace(/--[^\n]*/g, "")
  .replace(/^\s*open question[^\n]*/gm, "");
for (const { term, kind } of allExclusions) {
  // prefix match (word boundary only at the start) so compound identifiers
  // like LoyaltyAccount or SMS_NOTIFICATIONS still count as leaks
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  if (re.test(specContent)) report.exclusions.violations.push({ term, kind });
}

// --- boundary / actor coverage ----------------------------------------------
// Fuzzy: does the spec expose each expected system boundary as a surface,
// facing clause, actor or boundary external entity? Surface naming varies too
// much across runs to match exact names, so we match boundary aliases against
// the text of all boundary-declaring lines. Reported, not gated.
report.boundaries = { covered: [], missing: [] };
const boundaryLines = specText
  .split("\n")
  .filter((l) => /^\s*(surface|actor)\s|facing\s|^\s*external\s+entity\s/.test(l))
  .join("\n")
  .toLowerCase();
for (const [boundary, aliases] of Object.entries(golden.boundaries ?? {})) {
  if (aliases.some((a) => boundaryLines.includes(a.toLowerCase()))) report.boundaries.covered.push(boundary);
  else report.boundaries.missing.push(boundary);
}

// --- summary ------------------------------------------------------------------
const expEntities = Object.keys(golden.entities).length;
const boundaryCount = Object.keys(golden.boundaries ?? {}).length;
const p = report.precision;
report.summary = {
  entity_recall: +(tally.entities / expEntities).toFixed(3),
  state_recall: +(tally.states.hit / tally.states.total).toFixed(3),
  transition_recall: +(tally.transitions.hit / tally.transitions.total).toFixed(3),
  rule_recall: +(report.rules.matched.length / golden.rules.length).toFixed(3),
  config_recall: golden.config?.length ? +(report.config.matched.length / golden.config.length).toFixed(3) : null,
  boundary_recall: boundaryCount ? +(report.boundaries.covered.length / boundaryCount).toFixed(3) : null,
  // confabulation_free gates on the unambiguous cases (spurious states /
  // transitions on matched entities); spurious_entities / extra_rules counts
  // are review signals only, not part of the gate.
  confabulation_free: p.spurious_states.length === 0 && p.spurious_transitions.length === 0,
  spurious_entity_count: p.spurious_entities.length,
  extra_rule_count: p.extra_rules.length,
};
emit(0);
