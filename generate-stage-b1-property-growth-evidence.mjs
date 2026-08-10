import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(root, "stage-b1-evidence");
mkdirSync(evidenceDir, { recursive: true });

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(join(root, "calculator.js"), "utf8"), context);
vm.runInNewContext(readFileSync(join(root, "semiRetirementProjection.js"), "utf8"), context);
vm.runInNewContext(readFileSync(join(root, "semiRetirementUi.js"), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;

function money(value) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function basePlan(assetItems = [], overrides = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Alex";
  plan.personal.person1Age = 50;
  plan.personal.fullRetirementAge = 55;
  plan.personal.targetAnnualSpending = 60000;
  plan.assets.cash = 100000;
  plan.assets.homeValue = overrides.homeValue || 0;
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

function project(plan) {
  const result = CALC.calculatePlan(plan);
  const defaults = UI.buildSemiRetirementScenarioDefaults(plan, result);
  const inputs = UI.scenarioDraftToProjectionInputs(defaults.draft);
  const projection = ENGINE.projectRetirementScenario(inputs);
  if (!projection.validation.isValid) throw new Error(JSON.stringify(projection.validation.errors));
  const viewModel = UI.buildSemiRetirementResultsViewModel(projection, inputs, defaults.draft);
  return { inputs, projection, viewModel };
}

function propertyCase(name, plan, propertyId = "smith") {
  const { inputs, projection, viewModel } = project(plan);
  const inputAsset = inputs.assets.find((item) => item.id === propertyId);
  const card = viewModel.debtProperty.propertyCards.find((item) => item.id === propertyId);
  const selectedYear = card?.selectedYear || projection.years[0].calendarYear;
  const row = projection.years.find((item) => item.calendarYear === selectedYear) || projection.years[0];
  const firstYear = projection.years[0];
  const initialProperty = firstYear.properties.find((item) => item.id === propertyId);
  const property = row.properties.find((item) => item.id === propertyId);
  return {
    name,
    year: row.calendarYear,
    growthRate: inputAsset?.annualGrowthRate,
    growthRateSource: inputAsset?.growthRateSource,
    initialOpeningValue: initialProperty?.openingValue,
    milestoneOpeningValue: property?.openingValue,
    projectedValue: property?.closingValue,
    linkedDebt: property?.linkedLoanClosingBalance,
    projectedEquity: property?.propertyEquity,
    projectedNetWorth: row.household.totalNetWorth,
    accessibleInvestableAssets: row.household.totalInvestableAssets,
    cardProjectedValue: card?.projectedPropertyValue,
    cardProjectedEquity: card?.projectedPropertyEquity,
  };
}

const cases = [
  propertyCase(
    "Case 1 - investment property uses 3% default",
    basePlan([{ id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 }]),
  ),
  propertyCase(
    "Case 2 - Smith St property-specific override uses 4%",
    basePlan([{ id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000, propertyGrowthRatePct: 4 }], { investmentPropertyGrowthRatePct: 3 }),
  ),
  propertyCase(
    "Case 3 - property value, linked debt, equity and net worth reconcile",
    basePlan([{ id: "smith", name: "Smith St", category: "rentalInvestmentProperty", value: 600000 }], {
      liabilityItems: [
        { id: "smith-loan", name: "Smith loan", type: "rentalPropertyLoan", linkedAssetId: "smith", balance: 300000, interestRatePct: 0, repayment: 10000, repaymentFrequency: "annually", termYears: 30 },
      ],
    }),
  ),
];

writeFileSync(join(evidenceDir, "stage-b1-property-growth-evidence.json"), JSON.stringify({ generatedAt: new Date().toISOString(), cases }, null, 2), "utf8");

const html = `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stage B1 Property Growth Evidence</title>
    <link rel="stylesheet" href="../styles.css">
    <style>
      body { margin: 0; background: #f5f7fb; color: #0f2742; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 18px; }
      .evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
      .evidence-card { background: #fff; border: 1px solid #d8e0ed; border-radius: 18px; padding: 18px; box-shadow: 0 12px 30px rgba(15, 39, 66, 0.08); }
      .evidence-card h2 { margin: 0 0 12px; font-size: 20px; }
      .evidence-row { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid #eef2f7; padding: 10px 0; font-size: 14px; }
      .evidence-row strong { text-align: right; }
      @media (max-width: 600px) { .evidence-row { display: block; } .evidence-row strong { display: block; text-align: left; margin-top: 4px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Stage B1 Property Growth Evidence</h1>
      <p>Deterministic fixture generated from the real calculator, semi-retirement UI adapter and projection engine.</p>
      <div class="evidence-grid">
        ${cases.map((item) => `
          <article class="evidence-card">
            <h2>${item.name}</h2>
            <div class="evidence-row"><span>Milestone year</span><strong>${item.year}</strong></div>
            <div class="evidence-row"><span>Capital growth assumption</span><strong>${percent(item.growthRate)}</strong></div>
            <div class="evidence-row"><span>Growth source</span><strong>${item.growthRateSource}</strong></div>
            <div class="evidence-row"><span>Initial opening value</span><strong>${money(item.initialOpeningValue)}</strong></div>
            <div class="evidence-row"><span>Milestone opening value</span><strong>${money(item.milestoneOpeningValue)}</strong></div>
            <div class="evidence-row"><span>Projected property value</span><strong>${money(item.projectedValue)}</strong></div>
            <div class="evidence-row"><span>Linked debt</span><strong>${money(item.linkedDebt)}</strong></div>
            <div class="evidence-row"><span>Projected equity</span><strong>${money(item.projectedEquity)}</strong></div>
            <div class="evidence-row"><span>Projected net worth</span><strong>${money(item.projectedNetWorth)}</strong></div>
            <div class="evidence-row"><span>Accessible investable assets</span><strong>${money(item.accessibleInvestableAssets)}</strong></div>
          </article>
        `).join("")}
      </div>
    </main>
  </body>
</html>`;

writeFileSync(join(evidenceDir, "stage-b1-property-growth-evidence.html"), html, "utf8");
console.log(`Wrote Stage B1 evidence to ${evidenceDir}`);
