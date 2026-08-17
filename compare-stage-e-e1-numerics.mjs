import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const currentRoot = resolve(".");
const baselineRoot = resolve("..", "stage-e-controlled-20260815");

function loadEngine(root) {
  const context = { console, URLSearchParams };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(resolve(root, "calculator.js"), "utf8"), context);
  vm.runInNewContext(readFileSync(resolve(root, "semiRetirementProjection.js"), "utf8"), context);
  return context.FFSSemiRetirementProjection;
}

function person(overrides = {}) {
  return {
    id: "person1",
    name: "Person 1",
    currentAge: 55,
    currentGrossEmploymentIncome: 60000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 60,
    semiRetirementGrossIncome: 30000,
    fullRetirementAge: 65,
    superAccessAge: 60,
    openingSuperBalance: 100000,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0.12,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 60,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
    ...overrides,
  };
}

const input = {
  projectionStartYear: 2026,
  projectionEndAge: 70,
  inflationRate: 0,
  household: {
    currentLifestyleSpending: 50000,
    semiRetirementLifestyleSpending: 50000,
    fullRetirementLifestyleSpending: 50000,
    otherAnnualIncome: 0,
    annualLoanPrincipalRepayments: 0,
  },
  accessibleInvestments: {
    openingBalance: 80000,
    openingOffsetBalance: 20000,
    annualReturnRate: 0.04,
    annualFeesRate: 0,
    currentAnnualContributions: 0,
    externalAnnualAccessibleContribution: 0,
  },
  people: [person()],
  scenario: {
    semiRetirementAccessibleWithdrawal: 0,
    optionalAdditionalLifestyleWithdrawal: 0,
    surplusDestination: "accessible-investments",
    fullRetirementAnnualSpending: 50000,
    minimumAccessibleBalance: 0,
    minimumEstateBalanceAtEndAge: 0,
    withdrawalOrder: "accessible-first",
  },
  liabilities: [{
    id: "rental-loan",
    name: "Rental loan",
    type: "rentalPropertyLoan",
    linkedAssetId: "rental-property",
    openingBalance: 210000,
    openingOffsetBalance: 20000,
    annualInterestRate: 0.05,
    repaymentAmount: 18000,
    repaymentFrequency: "annually",
    repaymentType: "principalAndInterest",
    remainingTermYears: 20,
  }],
  assets: [{
    id: "rental-property",
    name: "Smith Street",
    type: "rentalInvestmentProperty",
    openingValue: 350000,
    annualGrowthRate: 0.03,
  }],
  propertyIncome: [{
    id: "rent",
    linkedAssetId: "rental-property",
    linkedLoanIds: ["rental-loan"],
    annualIncome: 28000,
    annualTaxableIncome: -2000,
    taxableRentalIncome: -2000,
    rentalCashflowTreatment: "afterInterest",
  }],
  passiveIncome: [],
};

function project(root) {
  const engine = loadEngine(root);
  const result = engine.projectRetirementScenario(JSON.parse(JSON.stringify(input)));
  assert.equal(result.validation.isValid, true);
  const year = result.years[0];
  const property = year.properties.find((item) => item.id === "rental-property");
  const rent = year.propertyIncome.find((item) => item.linkedAssetId === "rental-property");
  const loan = year.liabilities.find((item) => item.id === "rental-loan");
  return {
    taxableRentalIncome: property.taxableRentalIncome,
    rentalCashIncome: property.rentalCashIncome ?? property.grossRentalIncome,
    loanInterest: property.loanInterest,
    loanPrincipal: property.loanPrincipal,
    netPropertyCashflow: property.netPropertyCashflow,
    propertyValue: property.closingValue,
    propertyEquity: property.propertyEquity,
    offset: year.household.offsetClosingBalance,
    loanBalance: loan.closingBalance,
    householdCashflow: year.household.netHouseholdCashIncome,
    semiRetirementRequiredWithdrawal: year.household.requiredAccessibleWithdrawal,
    tax: year.people[0].incomeTax + year.people[0].medicareLevy + year.people[0].medicareLevySurcharge,
    netWorth: year.household.totalNetWorth,
    rentRowNetPropertyCashflow: rent.netPropertyCashflow,
  };
}

const baseline = project(baselineRoot);
const current = project(currentRoot);

for (const key of Object.keys(baseline)) {
  assert.equal(current[key], baseline[key], `${key} changed`);
}

const report = [
  "Stage E vs Stage E1 representative numerical comparison",
  `Baseline: ${baselineRoot}`,
  `Stage E1: ${currentRoot}`,
  "",
  ...Object.keys(baseline).map((key) => `${key}: ${baseline[key]} -> ${current[key]}`),
  "",
  "Result: all compared numerical outputs are identical.",
].join("\n");

writeFileSync(resolve(currentRoot, "STAGE-E1-NUMERICAL-COMPARISON.txt"), `${report}\n`);
console.log(report);
