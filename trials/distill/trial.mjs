// Trial definition: distill token usage.
//
// Measures the token cost and output quality of the `distill` skill: the
// session reverse-engineers an Allium spec from a fixture codebase, and the
// spec is scored against a golden manifest (see score.mjs).

import { cpSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TRIAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(path.dirname(TRIAL_DIR));

export const name = "distill";
export const defaultFixture = "courier";
export const fixtures = () => readdirSync(path.join(TRIAL_DIR, "data")).sort();

const codebaseDir = (fixture) => path.join(REPO_DIR, "fixtures", fixture, "codebase");
const goldenPath = (fixture) => path.join(TRIAL_DIR, "data", fixture, "golden.json");
const specRel = (fixture) => path.join("spec", `${fixture}.allium`);

// paths whose content defines the fixture — hashed into provenance
export const hashPaths = (fixture) => [codebaseDir(fixture), goldenPath(fixture)];

export const validateArgs = (fixture) => [
  path.join(TRIAL_DIR, "validate-manifest.mjs"), goldenPath(fixture), codebaseDir(fixture),
];

export const prompt = (fixture) => [
  "Use the distill skill to extract an Allium specification from the codebase in the current directory.",
  `Write the finished specification to a single file: ${specRel(fixture)}.`,
  "Work fully autonomously: do not ask questions; where the skill says to ask the user or validate with stakeholders, make the best-supported choice from the code instead and move on.",
].join(" ");

export const setup = (fixture, workspace) => {
  cpSync(codebaseDir(fixture), workspace, { recursive: true });
};

export const artifact = (workspace, fixture) => {
  const preferred = path.join(workspace, specRel(fixture));
  if (existsSync(preferred)) return preferred;
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(".allium")) found.push(p);
    }
  })(workspace);
  // largest .allium file is the best guess at the main spec
  return found.sort((a, b) => statSync(b).size - statSync(a).size)[0] ?? null;
};

export const scoreArgs = (artifactPath, fixture) => [
  path.join(TRIAL_DIR, "score.mjs"), artifactPath, goldenPath(fixture),
];

export const emptyQuality = () => ({
  entity_recall: 0, state_recall: 0, transition_recall: 0, rule_recall: 0, quality_pass: false,
});

// quality metrics reported in summaries and compared by compare.mjs;
// guardrailFloors are the ones whose per-run minimum must not drop
export const qualityMetrics = ["entity_recall", "state_recall", "transition_recall", "rule_recall"];
export const guardrailFloors = qualityMetrics;

// trial-specific guardrail checks beyond the recall floors
export const extraGuardrails = (baselineValid, candidateValid) => {
  const problems = [];
  const confabFree = (runs) => runs.every((r) => r.quality?.confabulation_free !== false);
  if (confabFree(baselineValid) && !confabFree(candidateValid)) {
    problems.push("candidate has confabulated states/transitions in a run; baseline had none");
  }
  const leakFree = (runs) => runs.every((r) => !(r.exclusion_violations ?? []).length);
  if (leakFree(baselineValid) && !leakFree(candidateValid)) {
    problems.push("candidate leaked excluded terms in a run; baseline had none");
  }
  return problems;
};
