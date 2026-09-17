import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const baselineRoot = resolve(process.argv[2] || "");
const candidateRoot = resolve(".");
const outputPath = resolve(process.argv[3] || "R6C-RETIREMENT-PARITY.json");

if (!process.argv[2] || baselineRoot === candidateRoot) {
  throw new Error("Usage: node scripts/r6c-retirement-parity.mjs <accepted-r6b-root> [output-json]");
}

function loadRuntime(root) {
  for (const file of ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js", "v2-data.js"]) {
    if (!existsSync(join(root, file))) throw new Error(`Missing ${file} in ${root}`);
  }
  const context = { console, structuredClone };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  for (const file of ["calculator.js", "semiRetirementProjection.js", "semiRetirementUi.js", "v2-data.js"]) {
    vm.runInContext(readFileSync(join(root, file), "utf8"), context, { filename: join(root, file) });
  }
  return {
    calc: context.FFSCalculator,
    engine: context.FFSSemiRetirementProjection,
    ui: context.FFSSemiRetirementUi,
    data: context.FFS_DATA,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function runPlan(runtime, plan, mutateDraft = () => {}) {
  const inputPlan = runtime.calc.clonePlan(plain(plan));
  const result = runtime.calc.calculatePlan(inputPlan);
  const draft = runtime.ui.buildSemiRetirementScenarioDefaults(inputPlan, result).draft;
  mutateDraft(draft);
  const outcome = runtime.ui.runSemiRetirementProjection(runtime.engine, draft);
  assert.equal(outcome.validation?.isValid, true, JSON.stringify(outcome.validation?.errors || []));
  return {
    inputs: plain(outcome.inputs),
    projection: plain(outcome.result),
  };
}

function taylorMorganPlan(runtime) {
  const plan = runtime.calc.emptyPlan();
  Object.assign(plan.personal, {
    person1Name: "Taylor",
    person2Name: "Morgan",
    person1Age: 40,
    person2Age: 38,
    dependants: 2,
    workOptionalAge: 50,
    semiRetirementAge: 55,
    fullRetirementAge: 60,
    targetAnnualSpending: 70000,
  });
  plan.incomeItems = [
    { id: "income-taylor", name: "Taylor salary", type: "salaryWages", owner: "person1", amount: 3500, frequency: "fortnightly" },
    { id: "income-morgan", name: "Morgan salary", type: "salaryWages", owner: "person2", amount: 2800, frequency: "fortnightly" },
  ];
  plan.assetItems = [
    { id: "asset-home", name: "Home", type: "home", value: 650000 },
    { id: "asset-offset", name: "Offset account", type: "offset", value: 30000 },
    { id: "asset-cash", name: "Cash", type: "cash", value: 20000 },
    { id: "asset-shares", name: "Shares / ETFs", type: "sharesEtfs", value: 100000 },
    { id: "asset-crypto", name: "Crypto", type: "crypto", value: 10000 },
    { id: "asset-super-1", name: "Taylor Super", type: "super", owner: "person1", value: 150000 },
    { id: "asset-super-2", name: "Morgan Super", type: "super", owner: "person2", value: 120000 },
    { id: "asset-vehicles", name: "Vehicles", type: "vehicles", value: 30000 },
  ];
  Object.assign(plan.assets, {
    homeValue: 650000,
    offsetBalance: 30000,
    cash: 20000,
    sharesEtfs: 100000,
    crypto: 10000,
    superPerson1: 150000,
    superPerson2: 120000,
    vehicles: 30000,
  });
  plan.liabilityItems = [
    { id: "home-loan", name: "Home loan", type: "homeLoan", balance: 400000, interestRatePct: 5.8, repaymentAmount: 2500, repaymentFrequency: "monthly", remainingTermYears: 25 },
    { id: "credit-card", name: "Credit Card", type: "creditCard", balance: 2000, interestRatePct: 19.99, repaymentAmount: 200, repaymentFrequency: "monthly", creditLimit: 10000 },
    { id: "other-debt", name: "Other debts", type: "otherDebt", balance: 10000, interestRatePct: 8, repaymentAmount: 300, repaymentFrequency: "monthly", remainingTermYears: 3 },
  ];
  plan.expenseItems = [
    { id: "living", name: "Living costs", category: "living", amount: 1500, frequency: "monthly" },
    { id: "food", name: "Food", category: "food", amount: 250, frequency: "weekly" },
    { id: "utilities", name: "Utilities", category: "utilities", amount: 4000, frequency: "annually" },
    { id: "insurance", name: "Insurance", category: "insurance", amount: 2500, frequency: "annually" },
    { id: "school", name: "School / children", category: "school", amount: 5000, frequency: "annually" },
    { id: "rates", name: "Rates / property costs", category: "rates", amount: 3000, frequency: "annually" },
    { id: "other", name: "Other expenses", category: "other", amount: 300, frequency: "monthly" },
    { id: "subscriptions", name: "Monthly subscriptions", category: "subscriptions", amount: 80, frequency: "monthly" },
    { id: "phone", name: "Phone / Internet", category: "phoneInternet", amount: 150, frequency: "monthly" },
    { id: "health", name: "Private health insurance", category: "privateHealth", amount: 300, frequency: "monthly" },
    { id: "petrol", name: "Petrol", category: "petrol", amount: 120, frequency: "weekly" },
    { id: "vehicle", name: "Motor vehicle rego / insurance", category: "vehicleRegoInsurance", amount: 2000, frequency: "annually" },
  ];
  Object.assign(plan.investing, {
    annualInvestingTarget: 12000,
    extraSuperContributions: 5000,
    expectedInvestmentReturnPct: 7,
    expectedSuperReturnPct: 6.5,
    inflationPct: 2.5,
    wageGrowthPct: 3,
  });
  return plan;
}

function staggeredDraft(draft) {
  draft.people[0].currentAge = 40;
  draft.people[1].currentAge = 38;
  for (const person of draft.people) {
    person.hasSemiRetirement = false;
    person.semiRetirementAge = 60;
    person.fullRetirementAge = 60;
  }
  draft.household.currentLifestyleSpending = 63700;
  draft.household.semiRetirementLifestyleSpending = 63700;
  draft.household.fullRetirementLifestyleSpending = 63700;
  draft.accessibleInvestments.openingBalance = 160000;
  draft.accessibleInvestments.externalAnnualAccessibleContribution = 0;
  draft.projectionEndAge = 90;
}

const baseline = loadRuntime(baselineRoot);
const candidate = loadRuntime(candidateRoot);
const baselineSamples = new Map(baseline.data.samplePlans.map((sample) => [sample.id, sample]));
const candidateSamples = new Map(candidate.data.samplePlans.map((sample) => [sample.id, sample]));
assert.deepEqual([...candidateSamples.keys()].sort(), [...baselineSamples.keys()].sort());

const sampleComparisons = [...baselineSamples.keys()].sort().map((id) => {
  const before = runPlan(baseline, baselineSamples.get(id).plan);
  const after = runPlan(candidate, candidateSamples.get(id).plan);
  assert.deepEqual(after.inputs, before.inputs, `${id}: projection inputs`);
  assert.deepEqual(after.projection, before.projection, `${id}: full annual projection`);
  return {
    id,
    annualRows: before.projection.years.length,
    projectionSha256: hash(before.projection),
    identical: true,
  };
});

const taylorBefore = runPlan(baseline, taylorMorganPlan(baseline), staggeredDraft);
const taylorAfter = runPlan(candidate, taylorMorganPlan(candidate), staggeredDraft);
assert.deepEqual(taylorAfter.inputs, taylorBefore.inputs, "Taylor/Morgan projection inputs");
assert.deepEqual(taylorAfter.projection, taylorBefore.projection, "Taylor/Morgan full annual projection");

const transitionRows = taylorBefore.projection.years.filter((row) => row.householdPhase === "semi-retirement");
const firstFullRetirement = taylorBefore.projection.years.find((row) => row.householdPhase === "full-retirement");
const transitionFunding = transitionRows.reduce((sum, row) => sum + Number(row.household?.requiredAccessibleWithdrawal || 0) + Number(row.household?.requiredSuperWithdrawal || 0), 0);
const result = {
  comparedAt: new Date().toISOString(),
  baselineRoot,
  candidateRoot,
  comparisonScope: "Projection inputs and every property of every annual projection row",
  sevenFictionalPlans: sampleComparisons,
  taylorMorgan: {
    annualRows: taylorBefore.projection.years.length,
    projectionSha256: hash(taylorBefore.projection),
    firstHouseholdTransitionYear: transitionRows[0]?.calendarYear ?? null,
    householdFullRetirementYear: firstFullRetirement?.calendarYear ?? null,
    transitionFunding,
    endingAssets: taylorBefore.projection.years.at(-1)?.household?.totalInvestableAssets ?? null,
    identical: true,
  },
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`R6C retirement arithmetic parity passed for ${sampleComparisons.length} samples plus Taylor/Morgan.`);
console.log(`Taylor/Morgan transition: ${result.taylorMorgan.firstHouseholdTransitionYear}-${result.taylorMorgan.householdFullRetirementYear}; funding ${result.taylorMorgan.transitionFunding}.`);
console.log(`Evidence: ${outputPath}`);
