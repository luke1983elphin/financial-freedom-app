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

// Independently calculate tax for these incomes (all exceed LITO thresholds
// and stay within the $45k-$135k bracket), rather than reusing tax helpers.
for(const type of ['personal-deductible','salary-sacrifice','personal-after-tax'])for(const startYear of [2026,2029])test(`both people: $18000 fixed nominal ${type}, start ${startYear}`,()=>{
 const people=[person({id:'person1',currentAge:43,currentGrossEmploymentIncome:125000,stslOpeningBalance:2000000,hasPrivateHealthCover:false}),person({id:'person2',currentAge:45,currentGrossEmploymentIncome:105000,stslOpeningBalance:2000000,hasPrivateHealthCover:false})];
 const overrides={inflationRate:.025,household:{currentLifestyleSpending:60000,semiRetirementLifestyleSpending:60000,fullRetirementLifestyleSpending:60000},accessibleInvestments:{openingBalance:2000000,externalAnnualAccessibleContribution:0}};
 const base=runProjection(baseInput({...overrides,people}));
 const revised=runProjection(baseInput({...overrides,people:people.map(p=>({...p,superContributions:[entry({type,frequency:'annual',startYear,stopAge:58,indexation:'none',amount:18000})]}))}));
 const credits=[0,0];
 for(let i=0;i<revised.years.length;i++){
  const row=revised.years[i],original=base.years[i];let expectedCashChange=0,expectedPersonalFunding=0;
  row.people.forEach((p,index)=>{
   const before=original.people[index],income=people[index].currentGrossEmploymentIncome;
   const applicable=row.calendarYear>=startYear&&p.age<58;
   const amount=applicable?18000:0,concessional=type!=='personal-after-tax',deduction=concessional?amount:0;
   assert.equal(p.totalTaxableIncome,before.totalTaxableIncome-deduction,`${p.id} deduction in ${row.calendarYear}`);
   if(p.employmentPhase==='working'){
    const taxable=income-deduction,firstRate=row.calendarYear===2026?.15:.14;
    const tax=Math.round(((45000-18200)*firstRate+(taxable-45000)*.3)*100)/100;
    assert.equal(p.incomeTax,tax);assert.equal(p.medicareLevy,taxable*.02);
    assert.equal(p.stslRepaymentIncome,income,'reportable contributions added back for STSL');
    assert.equal(p.stslRepayment,Math.round((income-69528)*.15*100)/100);
    assert.equal(p.medicareLevySurcharge,taxable*.01,'family tier uses original $230000 reportable income, not reduced taxable income');
    assert.equal(p.employerSuperContribution,income*.12,'SG base remains original employment income');
   }
   assert.equal(p.additionalSuperContribution,amount);
   assert.equal(Math.round((p.superContributionsTax-before.superContributionsTax)*100)/100,concessional?amount*.15:0);
   assert.equal(p.netAdditionalSuperContribution,concessional?amount*.85:amount);
   credits[index]+=concessional?amount*.85:amount;
   assert.equal(Math.round((p.closingSuperBalance-before.closingSuperBalance)*100)/100,credits[index]);
   const personalFunding=type==='salary-sacrifice'?0:amount;
   expectedPersonalFunding+=personalFunding;
   expectedCashChange+=before.incomeTax-p.incomeTax+before.medicareLevy-p.medicareLevy+before.medicareLevySurcharge-p.medicareLevySurcharge-(type==='salary-sacrifice'?amount:0)-personalFunding;
  });
  assert.equal(row.household.plannedAdditionalConcessionalContributionsPaidFromCash,expectedPersonalFunding);
  assert.equal(Math.round((row.household.cashSurplusOrShortfall-original.household.cashSurplusOrShortfall)*100)/100,expectedCashChange,'tax benefit and gross funding reach available cash once');
 }
 const age50=revised.years.find(r=>r.people[0].age===50).people[0];
 assert.equal(age50.additionalSuperContribution,18000);
 assert.equal(Math.round(18000/1.025**7),15143,'reported $15143 is the today-dollar display of $18000 at seven years and 2.5% CPI');
});

test('shared reporting categories include legacy amounts once and hide unused categories',()=>{
 const {FFSSemiRetirementUi:ui}=loadRuntime();
 const old={employerSuperContribution:12000,additionalSuperContribution:20000,recurringAdditionalSuperContribution:15000,plannedExtraConcessionalContribution:5000,superContributionsTax:4800};
 const modern={...old,personalDeductibleContribution:20000};
 const oldRows=JSON.parse(JSON.stringify(ui.superContributionBreakdown(old))),rows=JSON.parse(JSON.stringify(ui.superContributionBreakdown(modern)));
 assert.deepEqual(rows,oldRows);
 assert.deepEqual(rows.map(r=>r.label),['Employer super contributions','Personal deductible contributions','Total gross super contributions','Contributions tax','Net super contributions']);
 assert.deepEqual(rows.map(r=>r.amount),[12000,20000,32000,4800,27200]);
});
test('special existing allocations reconcile without being presented as personal deductions',()=>{
 const {FFSSemiRetirementUi:ui}=loadRuntime();
 const rows=ui.superContributionBreakdown({employerSuperContribution:12000,additionalSuperContribution:15000,salarySacrificeSuper:2000,personalDeductibleContribution:5000,personalAfterTaxContribution:3000,surplusAdditionalSuperContribution:5000,downsizerSuperContribution:10000,superContributionsTax:3600});
 const amount=key=>rows.find(r=>r.key===key)?.amount;
 assert.equal(amount('deductible'),5000);assert.equal(amount('other'),5000);assert.equal(amount('downsizer'),10000);assert.equal(amount('gross'),37000);assert.equal(amount('net'),33400);
});
