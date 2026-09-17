import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const metricDefinitions = [
  { label: "annualGrossIncome", path: ["annualGrossIncome"], type: "number" },
  { label: "annualNetIncome", path: ["annualNetIncome"], type: "number" },
  { label: "annualLivingExpenses", path: ["annualLivingExpenses"], type: "number" },
  { label: "annualExpenses", path: ["annualExpenses"], type: "number" },
  { label: "annualDebtRepayments", path: ["annualDebtRepayments"], type: "number" },
  { label: "annualMortgageRepayments", path: ["annualMortgageRepayments"], type: "number" },
  { label: "finalProjectedCashSurplus", path: ["finalProjectedCashSurplus"], type: "number" },
  { label: "currentNetWorth", path: ["currentNetWorth"], type: "number" },
  { label: "currentNetFiAssets", path: ["currentNetFiAssets"], type: "number" },
  { label: "annualPassiveIncome", path: ["annualPassiveIncome"], type: "number" },
  { label: "financialFreedomProgressDisplay", path: ["financialFreedomProgressDisplay"], type: "number" },
  { label: "lifestyleFundingPercent", path: ["lifestyleFundingPercent"], type: "number" },
  { label: "targetCapital", path: ["targetCapital"], type: "number" },
  { label: "rentalPropertyCashflow.annualHouseholdCashflowContribution", path: ["rentalPropertyCashflow", "annualHouseholdCashflowContribution"], type: "number" },
];

function loadCalculator(path) {
  const source = readFileSync(path, "utf8");
  const context = { console, structuredClone, window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: path });
  return context.FFSCalculator || context.window.FFSCalculator;
}

function loadData(path) {
  const source = readFileSync(path, "utf8");
  const context = { console, structuredClone, window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: path });
  return context.FFS_DATA || context.window.FFS_DATA;
}

function readOptions(args, name) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === name && args[index + 1]) values.push(args[index + 1]);
  });
  return values;
}

function readBaselineArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sample") {
      index += 1;
      continue;
    }
    if (!arg.startsWith("--")) return arg;
  }
  return null;
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toPlainData(value) {
  return JSON.parse(JSON.stringify(value));
}

export function readMetric(result, definition) {
  let value = result;
  const traversed = [];
  for (const segment of definition.path) {
    traversed.push(segment);
    if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, segment)) {
      throw new Error(`Missing required metric path: ${traversed.join(".")}`);
    }
    value = value[segment];
  }
  if (value === null) {
    if (definition.nullable) return value;
    throw new Error(`Metric ${definition.label} is null but is required to be numeric.`);
  }
  if (definition.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`Metric ${definition.label} is not a finite numeric value: ${String(value)}`);
  }
  return value;
}

export function compact(result, definitions = metricDefinitions) {
  return Object.fromEntries(definitions.map((definition) => [definition.label, readMetric(result, definition)]));
}

export function getSampleMap(data, label) {
  const samplePlans = Array.isArray(data?.samplePlans) ? data.samplePlans : [];
  if (!samplePlans.length) throw new Error(`No samplePlans found in ${label}.`);
  const map = new Map();
  for (const entry of samplePlans) {
    const id = entry?.id || entry?.name;
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error(`Sample entry in ${label} is missing a stable id/name.`);
    }
    if (map.has(id)) throw new Error(`Duplicate sample ID in ${label}: ${id}`);
    if (entry.plan === null || typeof entry.plan !== "object" || Array.isArray(entry.plan)) {
      throw new Error(`Sample ${id} in ${label} is missing a real input plan.`);
    }
    map.set(id, toPlainData(entry.plan));
  }
  return map;
}

export function resolveComparisonSamples(baselineData, candidateData, selectedSampleIds = []) {
  const baselineMap = getSampleMap(baselineData, "baseline");
  const candidateMap = getSampleMap(candidateData, "candidate");
  const requested = selectedSampleIds.filter(Boolean);
  let sampleIds;

  if (requested.length) {
    sampleIds = requested;
    for (const id of sampleIds) {
      if (!baselineMap.has(id)) throw new Error(`Selected sample ID not found in baseline: ${id}`);
      if (!candidateMap.has(id)) throw new Error(`Selected sample ID not found in candidate: ${id}`);
    }
  } else {
    const baselineIds = [...baselineMap.keys()].sort();
    const candidateIds = [...candidateMap.keys()].sort();
    assert.deepEqual(candidateIds, baselineIds, "Sample ID sets differ between baseline and candidate.");
    sampleIds = candidateIds;
  }

  return sampleIds.map((sample) => {
    const baselinePlan = baselineMap.get(sample);
    const candidatePlan = candidateMap.get(sample);
    assert.deepEqual(candidatePlan, baselinePlan, `Input plan data differs for sample ${sample}. Parity requires identical explicit input plans.`);
    return { sample, baselinePlan, candidatePlan, inputPlanHash: stableHash(baselinePlan) };
  });
}

export function runNumericalParity({ baselineRoot, candidateRoot = resolve("."), selectedSampleIds = [] }) {
  const resolvedBaselineRoot = resolve(baselineRoot);
  const resolvedCandidateRoot = resolve(candidateRoot);
  if (resolvedBaselineRoot === resolvedCandidateRoot) {
    throw new Error("Baseline and candidate paths are identical; refusing to create a baseline from the candidate.");
  }
  for (const requiredFile of ["calculator.js", "v2-data.js"]) {
    for (const [label, root] of [["baseline", resolvedBaselineRoot], ["candidate", resolvedCandidateRoot]]) {
      const file = join(root, requiredFile);
      if (!existsSync(file)) throw new Error(`Blocked: ${label} file not found: ${file}`);
    }
  }

  const baselineCalc = loadCalculator(join(resolvedBaselineRoot, "calculator.js"));
  const candidateCalc = loadCalculator(join(resolvedCandidateRoot, "calculator.js"));
  const baselineData = loadData(join(resolvedBaselineRoot, "v2-data.js"));
  const candidateData = loadData(join(resolvedCandidateRoot, "v2-data.js"));
  const samples = resolveComparisonSamples(baselineData, candidateData, selectedSampleIds);

  const comparisons = samples.map(({ sample, baselinePlan, candidatePlan, inputPlanHash }) => {
    const before = compact(baselineCalc.calculatePlan(baselinePlan));
    const after = compact(candidateCalc.calculatePlan(candidatePlan));
    assert.deepEqual(after, before, sample);
    return { sample, inputPlanHash, before, after, identical: true };
  });

  return {
    comparedAt: new Date().toISOString(),
    baselineRoot: resolvedBaselineRoot,
    candidateRoot: resolvedCandidateRoot,
    selectedSampleIds,
    metricDefinitions: metricDefinitions.map(({ label, path, type, nullable }) => ({
      label,
      path: path.join("."),
      type,
      nullable: Boolean(nullable),
    })),
    samples: comparisons,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  const args = process.argv.slice(2);
  const baselineArg = readBaselineArg(args);
  if (!baselineArg) {
    console.error("Usage: node scripts/r1-numerical-parity.mjs <path-to-genuine-baseline> [--sample sample-id ...]");
    process.exit(2);
  }

  try {
    const result = runNumericalParity({
      baselineRoot: baselineArg,
      candidateRoot: resolve("."),
      selectedSampleIds: readOptions(args, "--sample"),
    });
    writeFileSync("R2-NUMERICAL-PARITY.json", JSON.stringify(result, null, 2));
    console.log(`Numerical parity passed for ${result.samples.length} sample plan(s) against ${result.baselineRoot}.`);
  } catch (error) {
    console.error(`[NUMERICAL PARITY FAILED] ${error.message}`);
    process.exit(1);
  }
}
