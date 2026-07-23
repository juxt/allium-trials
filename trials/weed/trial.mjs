// Trial definition: weed divergence detection.
//
// The fixture pairs a shared codebase with a spec into which known
// divergences have been planted (spec-side drift, missing behaviour, phantom
// behaviour, guard drift). The session runs the weed skill and reports the
// divergences it finds; the scorer measures recall against the planted list
// and counts false positives (see score.mjs).

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TRIAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(path.dirname(TRIAL_DIR));

export const name = "weed";
export const defaultFixture = "courier";
export const fixtures = () => readdirSync(path.join(TRIAL_DIR, "data")).sort();

const codebaseDir = (fixture) => path.join(REPO_DIR, "fixtures", fixture, "codebase");
const dataDir = (fixture) => path.join(TRIAL_DIR, "data", fixture);
const REPORT = "weed-findings.md";

export const hashPaths = (fixture) => [codebaseDir(fixture), dataDir(fixture)];

export const validateArgs = (fixture) => [path.join(TRIAL_DIR, "validate.mjs"), dataDir(fixture)];

export const prompt = (fixture) => [
  `Use the weed skill to audit the Allium specification in spec/${fixture}.allium against the implementation codebase in the current directory.`,
  "Work fully autonomously: do not ask questions, and do not modify the spec or the code.",
  `Write your findings to ${REPORT} in the current directory: one '## ' section per divergence, each stating what the spec says, what the code does, and where (file / rule / entity).`,
  `If spec and code fully agree, write a single section: '## No divergences found'.`,
].join(" ");

export const setup = (fixture, workspace) => {
  cpSync(codebaseDir(fixture), workspace, { recursive: true });
  mkdirSync(path.join(workspace, "spec"), { recursive: true });
  cpSync(path.join(dataDir(fixture), "spec.allium"), path.join(workspace, "spec", `${fixture}.allium`));
};

export const artifact = (workspace) => {
  const preferred = path.join(workspace, REPORT);
  if (existsSync(preferred)) return preferred;
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry === REPORT) found.push(p);
    }
  })(workspace);
  return found[0] ?? null;
};

export const scoreArgs = (artifactPath, fixture) => [
  path.join(TRIAL_DIR, "score.mjs"), artifactPath, path.join(dataDir(fixture), "golden.json"),
];

export const emptyQuality = () => ({
  divergence_recall: 0, false_positive_count: null, quality_pass: false,
});

export const qualityMetrics = ["divergence_recall", "false_positive_count"];
export const guardrailFloors = ["divergence_recall"];

// false positives are lower-is-better, so the floor rule doesn't cover them:
// the guardrail instead forbids the candidate's worst run from producing more
// false positives than the baseline's worst run
export const extraGuardrails = (baselineValid, candidateValid) => {
  const worstFp = (runs) => Math.max(...runs.map((r) => r.quality?.false_positive_count ?? 0), 0);
  const b = worstFp(baselineValid);
  const c = worstFp(candidateValid);
  return c > b ? [`false-positive ceiling rose: worst run ${b} -> ${c}`] : [];
};
