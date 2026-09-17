import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function planWithProperties(assetItems = [], overrides = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Alex";
  plan.personal.person1Age = 50;
  plan.personal.person2Name = "";
  plan.personal.person2Age = 0;
  plan.personal.fullRetirementAge = 55;
  plan.personal.targetAnnualSpending = 60000;
  plan.assets.cash = 100000;
  plan.assets.homeValue = overrides.homeValue ?? 0;
  plan.assets.otherPropertyValue = overrides.otherPropertyValue ?? 0;
  plan.assets.superPerson1 = 0;
  plan.investing.expectedInvestmentReturnPct = 0;
  plan.investing.expectedSuperReturnPct = 0;
  plan.investing.inflationPct = 0;
  plan.investing.wageGrowthPct = 0;
  if (overrides.investmentPropertyGrowthRatePct !== undefined) plan.investing.investmentPropertyGrowthRatePct = overrides.investmentPropertyGrowthRatePct;
  if (overrides.principalResidenceGrowthRatePct !== undefined) plan.investing.principalResidenceGrowthRatePct = overrides.principalResidenceGrowthRatePct;
  plan.assetItems = assetItems;
  plan.liabilityItems = overrides.liabilityItems || [];
  plan.incomeItems = [];
  return plan;
}

function projectFromPlan(plan) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  const projection = ENGINE.projectRetirementScenario(inputs);
  assert.equal(projection.validation.isValid, true, JSON.stringify(projection.validation.errors));
  const viewModel = UI.buildSemiRetirementResultsViewModel(projection, inputs, defaults.draft);
  return { plan, result, defaults, inputs, projection, viewModel };
}

function projectFromDraft(draft) {
  const run = UI.runSemiRetirementProjection(ENGINE, draft);
  assert.equal(run.validation.isValid, true, JSON.stringify(run.validation.errors));
  const viewModel = UI.buildSemiRetirementResultsViewModel(run.result, run.inputs, draft);
  return { inputs: run.inputs, projection: run.result, viewModel };
}

function findAsset(inputs, id) {
  const asset = inputs.assets.find((item) => item.id === id);
  assert.ok(asset, `Expected asset ${id}`);
  return asset;
}

function findProperty(row, id) {
  const property = row.properties.find((item) => item.id === id);
  assert.ok(property, `Expected property ${id} in ${row.calendarYear}`);
  return property;
}

function assumption(viewModel, label) {
  return viewModel.assumptions.rows.find((row) => row.label === label);
}

test("Stage B1 default investment property growth compounds from the main-app 3% default", () => {
  const { inputs, projection } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ]));
  const asset = findAsset(inputs, "smith");
  assert.equal(asset.annualGrowthRate, 0.03);
  assert.equal(asset.growthRateSource, "investment-property-default");
  const property = findProperty(projection.years[0], "smith");
  assert.equal(property.openingValue, 600000);
  assert.equal(property.closingValue, 618000);
});

test("Stage B1 semi-retirement defaults use the main-app investment-property default rather than false 0%", () => {
  const { defaults, viewModel } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ]));
  assert.equal(defaults.draft.assumptions.investmentPropertyCapitalGrowthRatePct, 3);
  const investmentRow = assumption(viewModel, "Investment property capital growth");
  assert.ok(investmentRow);
  assert.equal(investmentRow.value, 0.03);
  assert.ok(!viewModel.assumptions.rows.some((row) => /Smith St property growth/.test(row.label) && row.value === 0));
});

test("Stage B1 property-specific override wins over the scenario investment-property default", () => {
  const { inputs, projection, viewModel } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 4 },
  ], { investmentPropertyGrowthRatePct: 3 }));
  const asset = findAsset(inputs, "smith");
  assert.equal(asset.annualGrowthRate, 0.04);
  assert.equal(asset.growthRateSource, "asset-specific");
  assert.equal(findProperty(projection.years[0], "smith").closingValue, 624000);
  assert.equal(assumption(viewModel, "Smith St property growth").value, 0.04);
});

test("Stage B1 a second investment property without override still uses the scenario default", () => {
  const { inputs, projection } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 4 },
    { id: "jones", name: "Jones St", category: "rentalInvestmentProperty", value: 400000 },
  ], { investmentPropertyGrowthRatePct: 3 }));
  assert.equal(findAsset(inputs, "smith").annualGrowthRate, 0.04);
  assert.equal(findAsset(inputs, "jones").annualGrowthRate, 0.03);
  assert.equal(findProperty(projection.years[0], "jones").closingValue, 412000);
});

test("Stage B1 principal residence uses its own assumption", () => {
  const { inputs, projection, viewModel } = projectFromPlan(planWithProperties([], {
    homeValue: 800000,
    principalResidenceGrowthRatePct: 2,
  }));
  const home = findAsset(inputs, "legacy-home");
  assert.equal(home.annualGrowthRate, 0.02);
  assert.equal(home.growthRateSource, "principal-residence-default");
  assert.equal(findProperty(projection.years[0], "legacy-home").closingValue, 816000);
  assert.equal(assumption(viewModel, "Principal residence capital growth").value, 0.02);
});

test("Stage B1 investment-property growth does not override the principal residence", () => {
  const { inputs, projection } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ], {
    homeValue: 800000,
    principalResidenceGrowthRatePct: 2,
    investmentPropertyGrowthRatePct: 5,
  }));
  assert.equal(findAsset(inputs, "legacy-home").annualGrowthRate, 0.02);
  assert.equal(findAsset(inputs, "smith").annualGrowthRate, 0.05);
  assert.equal(findProperty(projection.years[0], "legacy-home").closingValue, 816000);
  assert.equal(findProperty(projection.years[0], "smith").closingValue, 630000);
});

test("Stage B1 principal residence falls back to the documented app default when no home-specific rate exists", () => {
  const { inputs, viewModel } = projectFromPlan(planWithProperties([], { homeValue: 800000 }));
  assert.equal(findAsset(inputs, "legacy-home").annualGrowthRate, 0.03);
  assert.equal(findAsset(inputs, "legacy-home").growthRateSource, "principal-residence-default");
  assert.equal(assumption(viewModel, "Principal residence capital growth").note, "principal residence capital-growth assumption");
});

test("Stage B1 property equity reconciles to projected property value less linked debt for the same year", () => {
  const { projection } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ], {
    liabilityItems: [
      { id: "smith-loan", name: "Smith loan", type: "rentalPropertyLoan", linkedAssetId: "smith", balance: 300000, interestRatePct: 0, repayment: 10000, repaymentFrequency: "annually", termYears: 30 },
    ],
  }));
  const property = findProperty(projection.years[0], "smith");
  assert.equal(property.propertyEquity, property.closingValue - property.linkedLoanClosingBalance);
});

test("Stage B1 displayed property equity equals the engine property row", () => {
  const { projection, viewModel } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ], {
    liabilityItems: [
      { id: "smith-loan", name: "Smith loan", type: "rentalPropertyLoan", linkedAssetId: "smith", balance: 300000, interestRatePct: 0, repayment: 10000, repaymentFrequency: "annually", termYears: 30 },
    ],
  }));
  const card = viewModel.debtProperty.propertyCards.find((item) => item.id === "smith");
  const property = findProperty(projection.years.find((row) => row.calendarYear === card.selectedYear), "smith");
  assert.equal(card.projectedPropertyEquity, property.propertyEquity);
  assert.equal(card.projectedPropertyValue, property.closingValue);
});

test("Stage B1 projected net worth uses the same projected property value as annual property rows", () => {
  const { projection } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ], {
    liabilityItems: [
      { id: "smith-loan", name: "Smith loan", type: "rentalPropertyLoan", linkedAssetId: "smith", balance: 300000, interestRatePct: 0, repayment: 10000, repaymentFrequency: "annually", termYears: 30 },
    ],
  }));
  const row = projection.years[0];
  const property = findProperty(row, "smith");
  assert.equal(row.household.totalPropertyValue, property.closingValue);
  assert.equal(row.household.totalPropertyEquity, property.propertyEquity);
  assert.equal(row.household.totalNetWorth, row.household.closingAccessibleInvestmentBalance + row.household.totalSuperBalance + row.household.totalPropertyValue - row.household.totalDebt);
});

test("Stage B1 changing property growth from 0% to 3% changes projected net worth by the property-value difference only", () => {
  const flat = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 0 },
  ])).projection.years[0];
  const grown = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ])).projection.years[0];
  const propertyDifference = grown.household.totalPropertyValue - flat.household.totalPropertyValue;
  assert.equal(propertyDifference, 18000);
  assert.equal(grown.household.totalNetWorth - flat.household.totalNetWorth, propertyDifference);
});

test("Stage B1 accessible retirement assets do not change solely because property capital growth changes", () => {
  const flat = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 0 },
  ])).projection.years[0];
  const grown = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ])).projection.years[0];
  assert.equal(grown.household.totalInvestableAssets, flat.household.totalInvestableAssets);
  assert.equal(grown.household.closingAccessibleInvestmentBalance, flat.household.closingAccessibleInvestmentBalance);
});

test("Stage B1 assumptions display investment, principal and override rows without contradiction", () => {
  const { viewModel } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 4 },
    { id: "jones", name: "Jones St", category: "rentalInvestmentProperty", value: 400000 },
  ], {
    homeValue: 800000,
    principalResidenceGrowthRatePct: 2,
    investmentPropertyGrowthRatePct: 3,
  }));
  assert.equal(assumption(viewModel, "Principal residence capital growth").value, 0.02);
  assert.equal(assumption(viewModel, "Investment property capital growth").value, 0.03);
  assert.equal(assumption(viewModel, "Smith St property growth").value, 0.04);
  assert.equal(viewModel.assumptions.rows.filter((row) => row.label === "Jones St property growth").length, 0);
  assert.ok(!viewModel.assumptions.rows.some((row) => /property growth/i.test(row.label) && row.value === 0));
});

test("Stage B1 scenario investment-property growth recalculates projected value, equity and net worth", () => {
  const { defaults } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ], {
    liabilityItems: [
      { id: "smith-loan", name: "Smith loan", type: "rentalPropertyLoan", linkedAssetId: "smith", balance: 300000, interestRatePct: 0, repayment: 10000, repaymentFrequency: "annually", termYears: 30 },
    ],
  }));
  const three = projectFromDraft(defaults.draft).projection.years[0];
  defaults.draft.assumptions.investmentPropertyCapitalGrowthRatePct = 4;
  const four = projectFromDraft(defaults.draft).projection.years[0];
  assert.equal(findProperty(four, "smith").closingValue - findProperty(three, "smith").closingValue, 6000);
  assert.equal(findProperty(four, "smith").propertyEquity - findProperty(three, "smith").propertyEquity, 6000);
  assert.equal(four.household.totalNetWorth - three.household.totalNetWorth, 6000);
});

test("Stage B1 scenario property-growth changes do not directly change accessible investments", () => {
  const { defaults } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ]));
  const three = projectFromDraft(defaults.draft).projection.years[0];
  defaults.draft.assumptions.investmentPropertyCapitalGrowthRatePct = 4;
  const four = projectFromDraft(defaults.draft).projection.years[0];
  assert.equal(four.household.closingAccessibleInvestmentBalance, three.household.closingAccessibleInvestmentBalance);
  assert.equal(four.household.totalInvestableAssets, three.household.totalInvestableAssets);
});

test("Stage B1 invalid property-growth input preserves validation state instead of producing a result", () => {
  const { defaults } = projectFromPlan(planWithProperties([
    { id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 },
  ]));
  defaults.draft.assumptions.investmentPropertyCapitalGrowthRatePct = -150;
  const run = UI.runSemiRetirementProjection(ENGINE, defaults.draft);
  assert.equal(run.validation.isValid, false);
  assert.equal(run.result, null);
  assert.ok(run.validation.errors.some((error) => error.path === "assumptions.investmentPropertyCapitalGrowthRatePct"));
});

test("Stage B1 user-facing UI labels include property growth assumptions and no property sale implication", () => {
  assert.match(appSource, /Principal residence growth \(%\)/);
  assert.match(appSource, /Investment property growth \(%\)/);
  assert.match(appSource, /Capital growth assumption/);
  assert.match(appSource, /Property equity contributes to projected net worth but is not treated as available retirement spending/);
});
