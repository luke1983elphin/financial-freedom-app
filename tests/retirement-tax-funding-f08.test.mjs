import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const context = { console, structuredClone };
context.globalThis = context;
for (const file of ['calculator.js', 'agePensionEstimate.js', 'semiRetirementProjection.js', 'semiRetirementUi.js', 'forecast-assumptions.js', 'growth-scenarios.js', 'dollar-basis.js']) {
  vm.runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
}
const ENGINE = context.FFSSemiRetirementProjection, UI = context.FFSSemiRetirementUi;
// Independent 2026-27 resident arithmetic: at $60k, $4,020 + .30*$15k
// less $100 LITO, plus $1,200 Medicare = $9,620. No MLS or concessions assumed.
const TAX = 9620;
function person(overrides = {}) {
  return { id: 'person1', name: 'A', currentAge: 65, currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0, semiRetirementAge: 65, semiRetirementGrossIncome: 0,
    fullRetirementAge: 65, superAccessAge: 60, openingSuperBalance: 0,
    superReturnBeforeRetirement: 0, superReturnAfterRetirement: 0, superAnnualFeesRate: 0,
    employerSuperRate: .12, existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 65, stslOpeningBalance: 0, hasPrivateHealthCover: true, ...overrides };
}
function input({ cash = 0, balance = 100000, people, reserve = 0, spending = 0, pension = false } = {}) {
  return { projectionStartYear: 2026, projectionEndAge: Math.max(...(people || [person()]).map(p => p.fullRetirementAge)) + 1,
    inflationRate: 0, people: people || [person()],
    household: { currentLifestyleSpending: spending, semiRetirementLifestyleSpending: spending,
      fullRetirementLifestyleSpending: spending, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    accessibleInvestments: { openingBalance: balance, annualReturnRate: 0, annualFeesRate: 0 },
    passiveIncome: [{ id: 'distribution', type: 'dividends', owner: 'person1', annualCashIncome: cash, annualTaxableIncome: 60000 }],
    scenario: { minimumAccessibleBalance: reserve, minimumEstateBalanceAtEndAge: 0,
      surplusDestination: 'enjoyment', ...(pension ? { agePension: { enabled: true, excludeSapto: true } } : {}) } };
}
function run(p) {
  const before = JSON.stringify(p), result = ENGINE.projectRetirementScenario(p);
  assert.equal(result.validation.isValid, true, JSON.stringify(result.validation));
  assert.equal(JSON.stringify(p), before, 'Inputs must remain unchanged');
  for (const row of result.years) {
    assert.equal(row.household.accessibleReconciliation.difference, 0);
    for (const owner of row.people) assert.equal(owner.superReconciliation.difference, 0);
  }
  return result;
}
for (const [cash, withdrawal, closing, surplus] of [[0, 9620, 90380, 0], [5000, 4620, 95380, 0], [20000, 0, 100000, 10380]]) {
  test(`F08 settles tax once with $${cash} cash and zero return/spending`, () => {
    const r = run(input({ cash })), row = r.years[0], h = row.household;
    assert.equal(row.people[0].incomeTax + row.people[0].medicareLevy, TAX);
    assert.equal(row.people[0].netEmploymentIncome, cash - TAX);
    assert.equal(h.netHouseholdCashIncome, cash - TAX);
    assert.equal(h.totalAccessibleInvestmentWithdrawal, withdrawal);
    assert.equal(h.closingAccessibleInvestmentBalance, closing);
    assert.equal(h.surplusAvailableForEnjoyment, surplus);
    assert.equal(h.unmetRequiredLifestyleSpending, 0);
    assert.equal(h.openingAccessibleInvestmentBalance + cash - TAX - surplus, closing,
      'Independent household cash conservation, including the tax payment');
  });
}
test('F08 pools signed owner cash with a working spouse before deciding withdrawals', () => {
  const spouse = person({ id: 'person2', name: 'B', currentGrossEmploymentIncome: 100000,
    fullRetirementAge: 67, semiRetirementAge: 67 });
  const h = run(input({ people: [person(), spouse] })).years[0].household;
  assert.equal(h.netHouseholdCashIncome, 100000 - 22520 - TAX);
  assert.equal(h.totalAccessibleInvestmentWithdrawal, 0);
  assert.equal(h.surplusAvailableForEnjoyment, 67860);
});
test('F08 records the entire unpaid tax as unfunded when there are no assets', () => {
  const r = run(input({ balance: 0 })), h = r.years[0].household;
  assert.equal(h.netHouseholdCashIncome, -TAX);
  assert.equal(h.totalAccessibleInvestmentWithdrawal, 0);
  assert.equal(h.unmetRequiredLifestyleSpending, TAX);
  assert.equal(h.unmetSpending, TAX);
  assert.equal(r.summary.firstUnfundedSpending.calendarYear, 2026);
});
test('F08 draws accessible assets then eligible super for the same tax shortfall', () => {
  const r = run(input({ balance: 1000, people: [person({ openingSuperBalance: 20000 })] })), row = r.years[0];
  assert.equal(row.household.totalAccessibleInvestmentWithdrawal, 1000);
  assert.equal(row.household.requiredSuperWithdrawal, 8620);
  assert.equal(row.people[0].closingSuperBalance, 11380);
  assert.equal(row.household.unmetSpending, 0);
});
test('F08 respects restricted super and accessible reserves', () => {
  const owner = person({ currentAge: 59, fullRetirementAge: 59, semiRetirementAge: 59, openingSuperBalance: 20000 });
  const row = run(input({ balance: 10000, people: [owner], reserve: 9000 })).years[0];
  assert.equal(row.household.totalAccessibleInvestmentWithdrawal, 1000);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 9000);
  assert.equal(row.people[0].superWithdrawal, 0);
  assert.equal(row.people[0].closingSuperBalance, 20000);
  assert.equal(row.household.unmetSpending, 8620);
});
test('F08 combines tax and required spending in one withdrawal, not two taxes', () => {
  const h = run(input({ spending: 40000 })).years[0].household;
  assert.equal(h.totalAccessibleInvestmentWithdrawal, 49620);
  assert.equal(h.closingAccessibleInvestmentBalance, 50380);
});
test('F08 uses the existing midpoint convention for actual reinvested yield and fees', () => {
  const p = input({ balance: 2000000 });
  delete p.passiveIncome;
  p.accessibleInvestments.annualReturnRate = .07;
  p.accessibleInvestments.annualFeesRate = .01;
  p.accessibleInvestments.components = [{ id: 'shares', category: 'shares', owner: 'person1', value: 2000000,
    investmentReturnMode: 'totalReturn', expectedTotalReturnPct: 7, expectedIncomeYieldPct: 3, incomeTreatment: 'reinvest' }];
  const row = run(p).years[0], h = row.household;
  assert.equal(row.people[0].totalTaxableIncome, 60000);
  assert.equal(h.totalAccessibleInvestmentWithdrawal, TAX);
  assert.equal(h.accessibleInvestmentEarnings, 139663.30); // (2m - 9620/2) * 7%
  assert.equal(h.accessibleInvestmentFees, 19951.90); // same midpoint * 1%
  assert.equal(h.closingAccessibleInvestmentBalance, 2110091.40);
});
test('F08 handles pension recalculation without losing or charging owner tax twice', () => {
  const owner = person({ currentAge: 70, fullRetirementAge: 70, semiRetirementAge: 70 });
  const row = run(input({ balance: 2000000, people: [owner], pension: true })).years[0];
  assert.equal(row.household.estimatedAgePension, 0);
  assert.equal(row.people[0].incomeTax + row.people[0].medicareLevy, TAX);
  assert.equal(row.household.totalAccessibleInvestmentWithdrawal, TAX);
  assert.equal(row.household.closingAccessibleInvestmentBalance, 1990380);
});
test('F08 retains positive cash controls and repeats deterministically', () => {
  const p = input({ cash: 60000 });
  const a = run(p), b = run(p);
  assert.deepEqual(a, b);
  assert.equal(a.years[0].household.totalAccessibleInvestmentWithdrawal, 0);
  assert.equal(a.years[0].household.surplusAvailableForEnjoyment, 50380);
});
test('F08 spends offset cash once while preserving its loan-interest treatment', () => {
  const p = input({ balance: 20000 });
  p.accessibleInvestments.openingOffsetBalance = 20000;
  p.liabilities = [{ id: 'home-loan', type: 'homeLoan', openingBalance: 100000,
    openingOffsetBalance: 20000, interestRatePct: 0, repaymentAmount: 0,
    repaymentFrequency: 'annually', remainingTermYears: 30 }];
  const h = run(p).years[0].household;
  assert.equal(h.offsetWithdrawals, TAX);
  assert.equal(h.offsetClosingBalance, 10380);
  assert.equal(h.totalAccessibleInvestmentWithdrawal, TAX);
  assert.equal(h.closingAccessibleInvestmentBalance, 10380);
});
test('F08 reports tax-only insolvency with a required-cashflow warning', () => {
  const row = run(input({ balance: 0 })).years[0];
  assert.ok(row.warnings.includes('Required household cashflow, including tax, could not be fully funded.'));
});
test('F08 funds income tax, Medicare, MLS and HELP exactly once from zero cash receipts', () => {
  const p = input({ people: [person({ hasPrivateHealthCover: false, stslOpeningBalance: 20000 })] });
  p.passiveIncome[0].annualTaxableIncome = 120000;
  const row = run(p).years[0], h = row.household, owner = row.people[0];
  assert.equal(owner.incomeTax + owner.medicareLevy, 28920);
  assert.equal(owner.medicareLevySurcharge, 1200);
  assert.equal(owner.stslRepayment, 7570.80);
  assert.equal(h.netHouseholdCashIncome, -37690.80);
  assert.equal(h.totalAccessibleInvestmentWithdrawal, 37690.80);
  assert.equal(h.closingAccessibleInvestmentBalance, 62309.20);
});
test('F08 settles each annual tax once using the enacted next-year first-band rate', () => {
  const r = run(input());
  assert.equal(r.years[0].household.totalAccessibleInvestmentWithdrawal, 9620);
  assert.equal(r.years[1].financialYear, '2027-28');
  assert.equal(r.years[1].household.totalAccessibleInvestmentWithdrawal, 9352);
  assert.equal(r.years[1].household.closingAccessibleInvestmentBalance, 81028);
});
