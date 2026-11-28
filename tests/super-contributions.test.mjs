import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function loadRuntime() {
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
  Object.entries(override).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => mergeDeep({}, item));
    } else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      output[key] = mergeDeep(base[key], value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Luke",
    currentAge: 40,
    currentGrossEmploymentIncome: 100000,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 60,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 65,
    superAccessAge: 60,
    openingSuperBalance: 50000,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0.12,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 60,
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
      currentLifestyleSpending: 80000,
      semiRetirementLifestyleSpending: 80000,
      fullRetirementLifestyleSpending: 80000,
      otherAnnualIncome: 120000,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 0,
      openingOffsetBalance: 0,
      annualReturnRate: 0,
      annualFeesRate: 0,
      externalAnnualAccessibleContribution: 10000,
    },
    people: [person()],
    scenario: {
      oneOffLifestyleEvents: [],
      plannedConcessionalContributions: [],
      workingPhaseSurplusDestination: "accessible-investments",
      surplusDestination: "enjoyment",
      fullRetirementAnnualSpending: 80000,
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

function runProjection(input) {
  const { FFSSemiRetirementProjection: engine } = loadRuntime();
  const result = engine.projectRetirementScenario(input);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation.errors));
  return result;
}

function rowForYear(result, year) {
  const row = result.years.find((entry) => entry.calendarYear === year);
  assert.ok(row, `Expected row for ${year}`);
  return row;
}

function personIn(row, id = "person1") {
  const entry = row.people.find((personRow) => personRow.id === id);
  assert.ok(entry, `Expected ${id} in ${row.calendarYear}`);
  return entry;
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function assertMoney(actual, expected, message) {
  assert.equal(money(actual), money(expected), message);
}

function taxSaving(basePerson, contributionPerson) {
  return money(
    (basePerson.incomeTax + basePerson.medicareLevy + basePerson.medicareLevySurcharge + basePerson.stslRepayment)
    - (contributionPerson.incomeTax + contributionPerson.medicareLevy + contributionPerson.medicareLevySurcharge + contributionPerson.stslRepayment),
  );
}

const entry = (overrides = {}) => ({ id:'a', type:'personal-deductible', frequency:'one-off', amount:20000, startYear:2026, indexation:'none', ...overrides });
const project = (entries, overrides = {}) => runProjection(baseInput({people:[person({superContributions:entries})], ...overrides}));
test('20000 gross immediately, clear/re-enter, edit/remove and serialised reopen are deterministic', () => {
  const first=project([entry()]);
  assert.equal(first.years[0].people[0].personalDeductibleContribution,20000);
  assert.equal(first.years[0].people[0].netAdditionalSuperContribution,17000);
  assert.equal(project([]).years[0].people[0].additionalSuperContribution,0);
  assert.equal(JSON.stringify(project([entry()])),JSON.stringify(first));
  assert.equal(project([entry({amount:24000})]).years[0].people[0].personalDeductibleContribution,24000);
  assert.equal(JSON.stringify(project(JSON.parse(JSON.stringify([entry()])))),JSON.stringify(first));
});
test('concurrent types, future start, stop-before age and CPI from commencement', () => {
  const result=project([entry({frequency:'annual',startYear:2028,stopAge:44,indexation:'cpi'}),entry({id:'b',type:'personal-after-tax',startYear:2028}),entry({id:'c',type:'salary-sacrifice',startYear:2028,amount:5000})],{inflationRate:.03});
  assert.equal(result.years[0].people[0].additionalSuperContribution,0);
  const p=result.years[2].people[0];
  assert.equal(p.personalDeductibleContribution,20000);
  assert.equal(p.personalAfterTaxContribution,20000);
  assert.equal(p.salarySacrificeSuper,5000);
  assert.equal(p.employerSuperContribution,12000);
  assert.equal(p.netAdditionalSuperContribution,41250);
  assert.equal(result.years[3].people[0].personalDeductibleContribution,20600);
  assert.equal(result.years[4].people[0].personalDeductibleContribution || 0,0);
});
test('after-tax transfers reduce cash once, without deduction or contributions tax', () => {
 const base=project([]).years[0], withContribution=project([entry({type:'personal-after-tax'})]).years[0];
 assert.equal(base.people[0].incomeTax,withContribution.people[0].incomeTax);
 assert.equal(base.people[0].superContributionsTax,withContribution.people[0].superContributionsTax);
 assert.equal(withContribution.people[0].closingSuperBalance-base.people[0].closingSuperBalance,20000);
 assert.equal(base.household.closingAccessibleInvestmentBalance-withContribution.household.closingAccessibleInvestmentBalance,20000);
 assert.equal(withContribution.people[0].superReconciliation.difference,0);
});
test('salary sacrifice respects employment capacity and cessation without reducing SG base', () => {
 const result=project([entry({type:'salary-sacrifice',frequency:'annual',stopAge:70,amount:120000})]);
 assert.equal(result.years[0].people[0].salarySacrificeSuper,100000);
 assert.equal(result.years[0].people[0].employerSuperContribution,12000);
 assert.equal(result.years[25].people[0].salarySacrificeSuper || 0,0);
 assert.ok(result.warnings.some(w=>w.includes('eligible employment income')));
});
test('legacy migration is idempotent, nominal and does not duplicate retained legacy fields', () => {
 const {FFSSemiRetirementUi:ui,FFSSemiRetirementProjection:engine}=loadRuntime();
 const input=baseInput({people:[person({existingAdditionalConcessionalContributions:5000})],scenario:{plannedConcessionalContributions:[{id:'old',personId:'person1',financialYear:2026,amount:20000}]}});
 const expected=engine.projectRetirementScenario(input);
 ui.migrateSuperContributions(input); const snapshot=JSON.stringify(input); ui.migrateSuperContributions(input);
 assert.equal(JSON.stringify(input),snapshot);
 const migrated=engine.projectRetirementScenario(JSON.parse(snapshot));
 assert.deepEqual(migrated.years,expected.years);
 input.people[0].superContributions=[];
 assert.equal(engine.projectRetirementScenario(input).years[0].people[0].additionalSuperContribution,0);
});
test('standard caps warn, do not truncate; same-year arrangements combine', () => {
 const result=project([entry(),entry({id:'b'}),entry({id:'c',type:'personal-after-tax',amount:140000})],{accessibleInvestments:{openingBalance:1000000,annualReturnRate:0,annualFeesRate:0}});
 assert.equal(result.years[0].people[0].personalDeductibleContribution,40000);
 assert.ok(result.warnings.some(w=>w.includes('concessional contributions exceed')));
 assert.ok(result.warnings.some(w=>w.includes('after-tax contributions exceed')));
});
test('insufficient funding is explicit and invalid rather than a silently funded plan', () => {
 const {FFSSemiRetirementProjection:engine}=loadRuntime();
 const input=baseInput({people:[person({currentGrossEmploymentIncome:0,openingSuperBalance:0,superContributions:[entry()]})],household:{otherAnnualIncome:0},accessibleInvestments:{openingBalance:0}});
 const result=engine.projectRetirementScenario(input);
 assert.equal(result.validation.isValid,false);
 assert.ok(result.validation.errors.some(e=>e.message.includes('cannot both be funded')));
});
test('STSL add-back and MLS threshold remain correct after deductible contributions', () => {
 const override=entries=>({people:[person({currentGrossEmploymentIncome:110000,stslOpeningBalance:80000,hasPrivateHealthCover:false,superContributions:entries})]});
 const baseline=project([],override([])).years[0].people[0];
 const revised=project([],override([entry()])).years[0].people[0];
 assert.equal(revised.stslRepayment,baseline.stslRepayment);
 assert.equal(revised.medicareLevySurcharge,900);
 assert.ok(revised.incomeTax<baseline.incomeTax);
});
test('invalid arrangements fail validation rather than silently disappearing', () => {
 const {FFSSemiRetirementProjection:engine}=loadRuntime();
 for(const invalid of [{amount:0},{type:'unknown'},{frequency:'annual',stopAge:40},{startYear:2020}]) {
  assert.equal(engine.projectRetirementScenario(baseInput({people:[person({superContributions:[entry(invalid)]})]})).validation.isValid,false);
 }
});

test('baseline salary packaging and scenario sacrifice combine once for SG, MLS and STSL', () => {
 const {FFSSemiRetirementProjection:engine}=loadRuntime();
 const result=engine.projectRetirementScenario(baseInput({people:[person({currentGrossEmploymentIncome:120000,currentSalarySacrificeSuper:5000,stslOpeningBalance:80000,hasPrivateHealthCover:false,superContributions:[entry({type:'salary-sacrifice',amount:10000})]})]}));
 const p=result.years[0].people[0];
 assert.equal(p.salarySacrificeSuper,15000);
 assert.equal(p.baselineSalarySacrificeSuper,5000);
 assert.equal(p.scenarioSalarySacrificeSuper,10000);
 assert.equal(p.employerSuperContribution,14400);
 assert.equal(p.totalTaxableIncome,105000);
 assert.equal(p.stslRepaymentIncome,120000);
 assert.equal(p.medicareLevySurcharge,1050);
});
