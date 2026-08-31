import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadEngine() {
  const context = { console, URLSearchParams };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);
  return context;
}

function mergeDeep(base, override) {
  if (Array.isArray(override)) return override.map((item) => mergeDeep({}, item));
  if (!override || typeof override !== "object") return override;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => mergeDeep({}, item));
    } else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      output[key] = mergeDeep(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Person 1",
    currentAge: 54,
    currentGrossEmploymentIncome: 100000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 55,
    semiRetirementGrossIncome: 50000,
    fullRetirementAge: 65,
    superAccessAge: 60,
    openingSuperBalance: 100000,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0.12,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 65,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 66,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 70000,
      semiRetirementLifestyleSpending: 70000,
      fullRetirementLifestyleSpending: 70000,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 100000,
      openingOffsetBalance: 0,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
      externalAnnualAccessibleContribution: 0,
    },
    people: [person()],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      optionalAdditionalLifestyleWithdrawal: 0,
      surplusDestination: "enjoyment",
      fullRetirementAnnualSpending: 70000,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
      withdrawalOrder: "accessible-first",
    },
    liabilities: [],
    assets: [],
    propertyIncome: [],
    passiveIncome: [],
  }, overrides);
}

function runProjection(overrides = {}) {
  const { FFSSemiRetirementProjection: engine } = loadEngine();
  const result = engine.projectRetirementScenario(baseInput(overrides));
  assert.equal(result.validation.isValid, true);
  return result;
}

function rowForAge(result, age, personId = "person1") {
  const row = result.years.find((entry) => entry.people.some((candidate) => candidate.id === personId && candidate.age === age));
  assert.ok(row, `Expected projection row for ${personId} age ${age}`);
  return row;
}

function approx(actual, expected, tolerance = 0.02) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("Stage E Medicare levy honours 2026-27 lower threshold and phase-in", () => {
  const { FFSCalculator: calc } = loadEngine();
  assert.equal(calc.calculateMedicareLevy(20000), 0);
  assert.equal(calc.calculateMedicareLevy(28011), 0);
  assert.equal(calc.calculateMedicareLevy(28012), 0.1);
  assert.equal(calc.calculateMedicareLevy(31512), 350.1);
  assert.equal(calc.calculateMedicareLevy(35013), 700.2);
  assert.equal(calc.calculateMedicareLevy(50000), 1000);
  assert.equal(calc.individualTaxBreakdown(31512).medicareLevyEstimateType, "phase-in");
});

test("Stage E tax-free super withdrawals do not create taxable income, Medicare levy or MLS", () => {
  const result = runProjection({
    people: [person({
      currentAge: 65,
      currentGrossEmploymentIncome: 0,
      semiRetirementAge: 65,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 65,
      superAccessAge: 60,
      openingSuperBalance: 100000,
      employerSuperRate: 0,
      hasPrivateHealthCover: false,
    })],
    accessibleInvestments: { openingBalance: 0 },
    household: { fullRetirementLifestyleSpending: 70000, otherAnnualIncome: 0 },
    scenario: { fullRetirementAnnualSpending: 70000 },
  });
  const year = rowForAge(result, 65);
  assert.equal(year.people[0].totalTaxableIncome, 0);
  assert.equal(year.people[0].medicareLevy, 0);
  assert.equal(year.people[0].medicareLevySurcharge, 0);
  assert.equal(year.household.totalSuperWithdrawal, 70000);
});

test("Stage E Medicare uses taxable income only when tax-free super is also funding spending", () => {
  const result = runProjection({
    people: [person({
      currentAge: 65,
      currentGrossEmploymentIncome: 0,
      semiRetirementAge: 65,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 65,
      superAccessAge: 60,
      openingSuperBalance: 100000,
      employerSuperRate: 0,
    })],
    accessibleInvestments: { openingBalance: 0 },
    passiveIncome: [{ id: "interest", type: "interest", owner: "person1", annualCashIncome: 20000, annualTaxableIncome: 20000 }],
    household: { fullRetirementLifestyleSpending: 90000 },
    scenario: { fullRetirementAnnualSpending: 90000 },
  });
  const year = rowForAge(result, 65);
  assert.equal(year.people[0].totalTaxableIncome, 20000);
  assert.equal(year.people[0].medicareLevy, 0);
  assert.equal(year.household.totalSuperWithdrawal, 70000);
});

test("Stage E Medicare phase-in uses taxable income only when super cashflow is present", () => {
  const result = runProjection({
    people: [person({
      currentAge: 65,
      currentGrossEmploymentIncome: 0,
      semiRetirementAge: 65,
      semiRetirementGrossIncome: 0,
      fullRetirementAge: 65,
      superAccessAge: 60,
      openingSuperBalance: 100000,
      employerSuperRate: 0,
    })],
    accessibleInvestments: { openingBalance: 0 },
    passiveIncome: [{ id: "interest", type: "interest", owner: "person1", annualCashIncome: 31512, annualTaxableIncome: 31512 }],
    household: { fullRetirementLifestyleSpending: 90000 },
    scenario: { fullRetirementAnnualSpending: 90000 },
  });
  const year = rowForAge(result, 65);
  assert.equal(year.people[0].totalTaxableIncome, 31512);
  assert.equal(year.people[0].medicareLevy, 350.1);
  assert.ok(year.household.totalSuperWithdrawal > 0);
});

test("Stage E MLS remains separate from Medicare levy thresholds and honours cover and low-income spouse protection", () => {
  const { FFSCalculator: calc } = loadEngine();
  assert.equal(calc.calculateMedicareLevySurcharge({
    person1TaxableIncome: 100000,
    person1CoverStatus: "no-cover",
    hasPartner: false,
    dependants: 0,
  }).annualSurcharge, 0);
  assert.equal(calc.calculateMedicareLevySurcharge({
    person1TaxableIncome: 120000,
    person1CoverStatus: "full-year",
    hasPartner: false,
    dependants: 0,
  }).annualSurcharge, 0);
  assert.equal(calc.calculateMedicareLevySurcharge({
    person1TaxableIncome: 120000,
    person1CoverStatus: "no-cover",
    hasPartner: false,
    dependants: 0,
  }).annualSurcharge, 1200);
  const family = calc.calculateMedicareLevySurcharge({
    person1TaxableIncome: 230000,
    person2TaxableIncome: 27222,
    person1MLSIncomeForThreshold: 230000,
    person2MLSIncomeForThreshold: 27222,
    person1CoverStatus: "no-cover",
    person2CoverStatus: "no-cover",
    hasPartner: true,
    spouseForFullYear: true,
    dependants: 0,
  });
  assert.equal(family.person1Surcharge, 2875);
  assert.equal(family.person2Surcharge, 0);
  assert.equal(family.person2LowIncomeSpouseExempt, true);
});

test("Stage E person-specific planned contributions cease at each person's semi-retirement age while employer super continues", () => {
  const result = runProjection({
    people: [
      person({
        id: "person1",
        currentAge: 54,
        currentGrossEmploymentIncome: 100000,
        semiRetirementAge: 55,
        semiRetirementGrossIncome: 50000,
        fullRetirementAge: 65,
        existingAdditionalConcessionalContributions: 10000,
      }),
      person({
        id: "person2",
        name: "Person 2",
        currentAge: 54,
        currentGrossEmploymentIncome: 80000,
        semiRetirementAge: 58,
        semiRetirementGrossIncome: 40000,
        fullRetirementAge: 65,
        openingSuperBalance: 80000,
        existingAdditionalConcessionalContributions: 5000,
      }),
    ],
    household: { currentLifestyleSpending: 40000, semiRetirementLifestyleSpending: 40000, fullRetirementLifestyleSpending: 40000 },
  });
  const workingYear = rowForAge(result, 54);
  assert.equal(workingYear.people.find((entry) => entry.id === "person1").additionalSuperContribution, 10000);
  assert.equal(workingYear.people.find((entry) => entry.id === "person2").additionalSuperContribution, 5000);

  const semiYear = rowForAge(result, 55);
  const p1 = semiYear.people.find((entry) => entry.id === "person1");
  const p2 = semiYear.people.find((entry) => entry.id === "person2");
  assert.equal(p1.additionalSuperContribution, 0);
  assert.ok(p1.employerSuperContribution > 0);
  assert.equal(p2.additionalSuperContribution, 5000);
});

test("Stage E funds ordinary lifestyle shortfalls before optional lifestyle draws", () => {
  const result = runProjection({
    people: [person({ currentAge: 55, currentGrossEmploymentIncome: 0, semiRetirementAge: 55, semiRetirementGrossIncome: 0, fullRetirementAge: 65, employerSuperRate: 0 })],
    household: { semiRetirementLifestyleSpending: 70000, otherAnnualIncome: 40000 },
    accessibleInvestments: { openingBalance: 100000, externalAnnualAccessibleContribution: 10000 },
    scenario: { semiRetirementAccessibleWithdrawal: 0, optionalAdditionalLifestyleWithdrawal: 0 },
  });
  const year = rowForAge(result, 55);
  assert.equal(year.household.annualLifestyleSurplusOrShortfall, -30000);
  assert.equal(year.household.requiredTotalPortfolioWithdrawal, 30000);
  assert.equal(year.household.requiredAccessibleWithdrawal, 30000);
  assert.equal(year.household.optionalAdditionalLifestyleWithdrawal, 0);
  assert.equal(year.household.accessibleInvestmentContribution, 0);
  assert.equal(year.household.ceasedExternalAccessibleContribution, 10000);
});

test("Stage E retirement surplus can be enjoyed, contributed to super, invested or left unallocated", () => {
  const common = {
    people: [person({ currentAge: 65, currentGrossEmploymentIncome: 0, semiRetirementAge: 65, semiRetirementGrossIncome: 0, fullRetirementAge: 65, employerSuperRate: 0, openingSuperBalance: 0 })],
    accessibleInvestments: { openingBalance: 0, annualReturnRate: 0 },
    household: { fullRetirementLifestyleSpending: 100000, otherAnnualIncome: 120000 },
    scenario: { fullRetirementAnnualSpending: 100000 },
  };
  const enjoyment = rowForAge(runProjection(mergeDeep(common, { scenario: { surplusDestination: "enjoyment" } })), 65).household;
  assert.equal(enjoyment.surplusAvailableForEnjoyment, 20000);
  assert.equal(enjoyment.accessibleInvestmentContribution, 0);
  assert.equal(enjoyment.surplusToSuper, 0);

  const superRow = rowForAge(runProjection(mergeDeep(common, { scenario: { surplusDestination: "super" } })), 65);
  assert.equal(superRow.household.surplusToSuper, 20000);
  assert.equal(superRow.people[0].surplusAdditionalSuperContribution, 20000);
  assert.equal(superRow.people[0].closingSuperBalance, 17000);

  const investments = rowForAge(runProjection(mergeDeep(common, { scenario: { surplusDestination: "accessible-investments" } })), 65).household;
  assert.equal(investments.surplusToAccessibleInvestments, 20000);
  assert.equal(investments.accessibleInvestmentContribution, 20000);
  assert.equal(investments.closingAccessibleInvestmentBalance, 20000);

  const unallocated = rowForAge(runProjection(mergeDeep(common, { scenario: { surplusDestination: "unallocated" } })), 65).household;
  assert.equal(unallocated.unallocatedSurplus, 20000);
  assert.equal(unallocated.unallocatedSurplusClosingBalance, 20000);
  assert.equal(unallocated.closingAccessibleInvestmentBalance, 0);
  assert.equal(unallocated.accessibleInvestmentEarnings, 0);
});

test("Stage E offset cash remains accessible but earns no investment return while linked debt exists", () => {
  const result = runProjection({
    people: [person({ currentAge: 65, currentGrossEmploymentIncome: 0, semiRetirementAge: 65, semiRetirementGrossIncome: 0, fullRetirementAge: 65, employerSuperRate: 0, openingSuperBalance: 0 })],
    household: { fullRetirementLifestyleSpending: 0, otherAnnualIncome: 0 },
    accessibleInvestments: { openingBalance: 100000, openingOffsetBalance: 100000, annualReturnRate: 0.1 },
    liabilities: [{
      id: "home-loan",
      name: "Home loan",
      type: "homeLoan",
      openingBalance: 400000,
      openingOffsetBalance: 100000,
      annualInterestRate: 0.05,
      repaymentAmount: 0,
      repaymentFrequency: "annually",
      remainingTermYears: 30,
    }],
    scenario: { fullRetirementAnnualSpending: 0 },
  });
  const year = rowForAge(result, 65);
  assert.equal(year.household.offsetOpeningBalance, 100000);
  assert.equal(year.household.accessibleInvestmentEarnings, 0);
  assert.equal(year.liabilities[0].interestBearingBalance, 300000);
  assert.ok(year.liabilities[0].interestCharged > 0);
  assert.ok(year.liabilities[0].interestCharged < 400000 * 0.05);
});

test("Stage E offset depletion reduces later loan-interest offset benefit", () => {
  const result = runProjection({
    projectionEndAge: 67,
    people: [person({ currentAge: 65, currentGrossEmploymentIncome: 0, semiRetirementAge: 65, semiRetirementGrossIncome: 0, fullRetirementAge: 65, employerSuperRate: 0, openingSuperBalance: 0 })],
    household: { fullRetirementLifestyleSpending: 20000, otherAnnualIncome: 0 },
    accessibleInvestments: { openingBalance: 100000, openingOffsetBalance: 100000, annualReturnRate: 0 },
    liabilities: [{
      id: "home-loan",
      name: "Home loan",
      type: "homeLoan",
      openingBalance: 400000,
      openingOffsetBalance: 100000,
      annualInterestRate: 0.05,
      repaymentAmount: 0,
      repaymentFrequency: "annually",
      remainingTermYears: 30,
    }],
    scenario: { fullRetirementAnnualSpending: 20000 },
  });
  const first = rowForAge(result, 65);
  const second = rowForAge(result, 66);
  assert.equal(first.household.offsetWithdrawals, 20000);
  assert.equal(first.household.offsetClosingBalance, 80000);
  assert.equal(second.liabilities[0].offsetBalanceUsed, 80000);
  approx(second.liabilities[0].interestBearingBalance, first.liabilities[0].closingBalance - 80000);
});

test("Stage E remaining offset cash earns ordinary accessible return from the year after linked loan payoff", () => {
  const result = runProjection({
    projectionEndAge: 67,
    people: [person({ currentAge: 65, currentGrossEmploymentIncome: 0, semiRetirementAge: 65, semiRetirementGrossIncome: 0, fullRetirementAge: 65, employerSuperRate: 0, openingSuperBalance: 0 })],
    household: { fullRetirementLifestyleSpending: 0, otherAnnualIncome: 10000 },
    accessibleInvestments: { openingBalance: 10000, openingOffsetBalance: 10000, annualReturnRate: 0.1 },
    liabilities: [{
      id: "home-loan",
      name: "Home loan",
      type: "homeLoan",
      openingBalance: 10000,
      openingOffsetBalance: 10000,
      annualInterestRate: 0.05,
      repaymentAmount: 10000,
      repaymentFrequency: "annually",
      remainingTermYears: 1,
    }],
    scenario: { fullRetirementAnnualSpending: 0 },
  });
  const first = rowForAge(result, 65);
  const second = rowForAge(result, 66);
  assert.equal(first.household.accessibleInvestmentEarnings, 0);
  assert.equal(first.liabilities[0].closingBalance, 0);
  assert.equal(second.household.offsetOpeningBalance, 0);
  assert.equal(second.household.accessibleInvestmentEarnings, 1000);
});

test("Stage E Linked Property UI is a stable-ID management layer over authoritative asset income and loan records", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /function linkedPropertyRecords\(\)/);
  assert.match(appSource, /propertyAssetCategories\.includes\(asset\.category\)/);
  assert.match(appSource, /String\(loan\.linkedAssetId \|\| ""\) === String\(asset\.id\)/);
  assert.match(appSource, /linkedLoanIdsFromIncome\.has\(loanId\)/);
  assert.match(appSource, /data-linked-property-id/);
  assert.match(appSource, /dynamicInput\("assetItems", asset, "value"/);
  assert.match(appSource, /dynamicInput\("incomeItems", income, "rentalCashIncomeAnnual"/);
  assert.match(appSource, /dynamicInput\("liabilityItems", loan, "openingOffsetBalance"/);
  assert.match(appSource, /loans\.length \? loans\.map\(linkedPropertyLoanCard\)/);
  assert.match(stylesSource, /\.linked-property-card/);
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.linked-property-summary-rows/);
});

test("Stage E1 Linked Property summary is capped at four headline metrics", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /data-headline-metric-count="4"/);
  assert.match(appSource, /linkedPropertySummaryRow\("Current value"/);
  assert.match(appSource, /linkedPropertySummaryRow\("Net property cashflow"/);
  assert.match(appSource, /linkedPropertySummaryRow\("Taxable rental income"/);
  assert.match(appSource, /linkedPropertySummaryRow\("Linked loans"/);
});

test("Stage E1 secondary rental and loan metrics are not default summary tiles", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /summaryTile\("Rental cash income"/);
  assert.doesNotMatch(appSource, /summaryTile\("Loan interest"/);
  assert.doesNotMatch(appSource, /summaryTile\("Loan principal"/);
  assert.match(appSource, /linkedPropertyDetailRow\("Rental cash income"/);
  assert.match(appSource, /linkedPropertyDetailRow\("Loan interest used in cashflow"/);
  assert.match(appSource, /linkedPropertyDetailRow\("Loan principal repayment"/);
});

test("Stage E1 Linked Property uses three primary accordions", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /<summary>Property & ownership<\/summary>/);
  assert.match(appSource, /<summary>Rental income & cashflow<\/summary>/);
  assert.match(appSource, /<summary>Loans & offset<\/summary>/);
  assert.doesNotMatch(appSource, /<summary>Property details<\/summary>/);
  assert.doesNotMatch(appSource, /<summary>Rental income<\/summary>/);
  assert.doesNotMatch(appSource, /<summary>Loans and offset<\/summary>/);
});

test("Stage E1 cashflow and taxable-income reconciliation lives inside Rental income and cashflow", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /<summary>Cashflow and taxable-income reconciliation<\/summary>/);
  assert.match(appSource, /Taxable rental income is used for tax calculations/);
  assert.match(appSource, /linkedPropertyDetailRow\("Taxable rental income"/);
  assert.match(appSource, /linkedPropertyDetailRow\("Net property cashflow"/);
});

test("Stage E1 missing rental cash income displays as required rather than a false zero", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /const rentalCashDisplay = cashflow\.hasMissingRentalCashIncome \|\| !cashflow\.hasRentalCashIncome[\s\S]*\? "Required"/);
  assert.match(appSource, /compactRentalCashWarningHtml/);
  assert.doesNotMatch(appSource, /Rental cash income required for semi-retirement cashflow/);
});

test("Stage E1 no linked loan state avoids prominent zero-value loan cards", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /No linked loans/);
  assert.match(appSource, /No linked property loans\./);
  assert.doesNotMatch(appSource, /summaryTile\("Loan principal", money\(balance\)\)/);
  assert.doesNotMatch(appSource, /summaryTile\("Offset balance", money\(offset\)\)/);
});

test("Stage E1 compact rental cash warning appears through one reusable inline helper", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const warningHelperMatches = appSource.match(/compactRentalCashWarningHtml/g) || [];
  assert.ok(warningHelperMatches.length >= 3);
  assert.match(appSource, /linked-property-inline-warning/);
  assert.match(appSource, /Rental cash income required\./);
  assert.match(appSource, /rentalCashHelpText\(item\)/);
});

test("Stage E1 mobile Linked Property summary uses compact rows", () => {
  const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(stylesSource, /\.linked-property-summary-rows/);
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.linked-property-summary-row,[\s\S]*\.linked-property-detail-row[\s\S]*grid-template-columns: 1fr/);
  assert.match(stylesSource, /@media \(max-width: 640px\)[\s\S]*\.linked-property-summary-row strong,[\s\S]*\.linked-property-detail-row strong[\s\S]*text-align: left/);
});

test("Stage E1 Linked Property edit capabilities remain available through Manage property", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /data-linked-property-manage/);
  assert.match(appSource, /querySelectorAll\("\.linked-property-detail"\)/);
  assert.match(appSource, /dynamicInput\("assetItems", asset, "name"/);
  assert.match(appSource, /dynamicInput\("incomeItems", income, "rentalCashflowTreatment"/);
  assert.match(appSource, /dynamicInput\("liabilityItems", loan, "linkedAssetId"/);
});

test("Stage E1 stable-ID linkage remains unchanged", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /String\(income\.linkedAssetId \|\| ""\) === String\(asset\.id\)/);
  assert.match(appSource, /String\(loan\.linkedAssetId \|\| ""\) === String\(asset\.id\)/);
  assert.match(appSource, /linkedLoanIdsFromIncome\.has\(loanId\)/);
  assert.match(appSource, /data-linked-property-id="\$\{escapeHtml\(asset\.id\)\}"/);
});
