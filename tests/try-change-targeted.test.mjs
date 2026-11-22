import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTryChangeApp, controlledPlan } from './helpers/try-change-app.mjs';
const { app, CALC, context, document } = loadTryChangeApp();
const apply = (...args) => app.get('applyScenarioAdjustments')(...args);
const calc = p => app.get('calculatePlan')(p);
const close = (actual, expected, tolerance = .51) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const forecast = r => JSON.stringify({ cash: r.finalProjectedCashSurplus, worth: r.netWorthProjection, investments: r.investmentProjection, super: r.superProjection });

test('F7 zero and negative forecasts survive; only missing/non-finite values fall back', () => {
  for (const value of [0, -500, 200, undefined, null, NaN, Infinity]) {
    const r = { netWorthProjection: [{ closingBalance: value }], superProjection: [{ closingBalance: value }], investmentProjection: [{ closingBalance: value }], currentNetWorth: 100000, superannuationBalance: 50000 };
    assert.equal(app.get('netWorthAtYear')(r, 1), Number.isFinite(value) ? value : 100000);
    assert.equal(app.get('longTermNetWorth')(r), Number.isFinite(value) ? value : 100000);
    assert.equal(app.get('superAtYear')(r, 1), Number.isFinite(value) ? value : 50000);
    assert.equal(app.get('investmentAtYear')(r, 1), Number.isFinite(value) ? value : 0);
  }
});
const mortgage = (id, frequency, divisor) => ({ id, name: id, type: 'homeLoan', balance: 200000, repayment: 12000 / divisor, repaymentFrequency: frequency, interestRatePct: 0, termYears: 30 });

test('F8 expense reductions cannot exceed the active recurring spending base', () => {
  const p = controlledPlan(CALC), original = JSON.stringify(p);
  assert.throws(() => apply(p, { expenseChange: -50000 }), /40,000/);
  assert.throws(() => apply(p, { expenseChange: -30000, otherExpenseAnnualChange: -20000 }), /40,000/);
  p.expenseItems.push({ id: 'inactive', amount: 20000, frequency: 'annually', active: false });
  assert.throws(() => apply(p, { expenseChange: -50000 }), /40,000/);
  p.expenseItems.pop();
  const r = calc(apply(p, { expenseChange: -40000 }));
  close(r.annualLivingExpenses, 0);
  close(r.finalProjectedCashSurplus - calc(p).finalProjectedCashSurplus, 40000);
  assert.equal(JSON.stringify(p), original);
});

test('F6 retirement-backed projections label one, five and ten completed periods consistently', () => {
  const p = controlledPlan(CALC);
  p.personal.retirementTiming = { version: 1, people: [{ id: 'person1', fullRetirementAge: 65, hasSemiRetirement: false }] };
  const b = calc(p), r = calc(apply(p, { investmentContributionChange: 5200 }));
  assert.ok(r.retirementProjection);
  for (const years of [1, 5, 10]) {
    close(r.investmentProjection[years - 1].closingBalance - b.investmentProjection[years - 1].closingBalance, 5200 * years);
    const raw = r.retirementProjection.years[years - 1];
    for (const key of ['investmentProjection', 'superProjection', 'netWorthProjection', 'accumulationCashflowProjection', 'financialFreedomProgressProjection']) {
      assert.equal(r[key][years - 1].year, years);
      assert.equal(r[key][years - 1].age, 43 + years);
    }
    close(r.netWorthProjection[years - 1].closingBalance, raw.household.totalNetWorth);
    close(r.superProjection[years - 1].closingBalance, raw.household.totalSuperBalance);
    assert.equal(raw.person1Age, 43 + years - 1, 'engine retains start-of-period ages');
  }
});

test('F6/F7 already-retired withdrawals reach a genuine zero after ten completed years', () => {
  const p = controlledPlan(CALC);
  Object.assign(p.personal, { person1Age: 70, fullRetirementAge: 70, targetAnnualSpending: 10000 });
  p.personal.retirementTiming = { version: 1, people: [{ id: 'person1', alreadyRetired: true, fullRetirementAge: 70, hasSemiRetirement: false }] };
  p.incomeItems = [];
  p.assetItems = [{ id: 'cash', category: 'cash', value: 100000 }];
  p.expenseItems[0].amount = 10000;
  const r = calc(p);
  for (const year of [1, 5, 10]) {
    close(app.get('netWorthAtYear')(r, year), Math.max(0, 100000 - 10000 * year));
    close(r.netWorthProjection[year - 1].closingBalance, r.retirementProjection.years[year - 1].household.totalNetWorth);
  }
});

test('F6 annual retirement ledgers reconcile across sample households and supported changes', t => {
  let checks = 0;
  const check = (actual, expected) => { close(actual, expected, .05); checks++; };
  for (const sample of context.FFS_DATA.samplePlans) {
    const p = CALC.clonePlan(sample.plan), ui = context.FFSSemiRetirementUi;
    const draft = ui.buildSemiRetirementScenarioDefaults(app.get('legacyCalculationProjection')(p), calc(p)).draft;
    ui.saveRetirementTiming(p, draft.people);
    for (const action of app.get('whatIfActions')) {
      const adjustments = action.adjustments(calc(p));
      const income = app.get('eligibleScenarioIncomes')(p, adjustments.incomeEmploymentOnly)[0];
      const loan = app.get('eligibleScenarioLoans')(p)[0];
      if (income) adjustments.incomeItemId = income.id;
      if (loan) adjustments.loanId = loan.id;
      let r;
      try { r = calc(apply(p, adjustments)); }
      catch (error) { assert.equal(error.code, 'scenario-input'); continue; }
      for (const row of r.retirementProjection.years) {
        const h = row.household;
        check(h.totalNetWorth, h.totalAccessibleAssets + h.totalSuperBalance + row.assets.filter(a => a.includeInNetWorth && !a.isAccessibleAsset).reduce((s, a) => s + a.closingValue, 0) - h.totalDebt);
        for (const person of row.people) {
          check(person.closingSuperBalance, person.openingSuperBalance + person.employerSuperContribution + person.additionalSuperContribution + person.downsizerSuperContribution - person.superContributionsTax + person.superInvestmentEarnings - person.superFees - person.superWithdrawal);
          check(person.netEmploymentIncome, person.totalCashIncomeBeforeTax - person.incomeTax - person.medicareLevy - person.medicareLevySurcharge - person.stslRepayment);
        }
        for (const debt of row.liabilities) check(debt.closingBalance, debt.openingBalance + debt.interestCharged - debt.totalRepayment);
        const a = h.accessibleReconciliation;
        check(a.closingBalance, a.openingBalance + a.householdSurplusContribution + a.externalAnnualAccessibleContribution + a.oneOffIncomeAccessibleContribution + a.downsizeAccessibleInvestmentContribution + a.investmentEarnings - a.totalAccessibleInvestmentWithdrawal - a.fees);
      }
    }
  }
  assert.ok(checks > 10000, `${checks} reconciled identities`);
  t.diagnostic(`${checks} annual ledger identities reconciled`);
});

test('F5 unsaved detailed adjustments and preview leave persisted plan bytes unchanged', () => {
  const isolated = loadTryChangeApp(), a = isolated.app;
  a.setPlan(controlledPlan(isolated.CALC));
  a.get('saveDraft')();
  const before = JSON.stringify([...isolated.context.localStorage.map.entries()]);
  const planBefore = JSON.stringify(a.getPlan());
  a.comparison({ expenseChange: -5200, investmentContributionChange: 5200 });
  a.get('buildComparisonPlan')();
  a.get('buildDecisionScenarioSaveContext')('custom');
  assert.equal(JSON.stringify([...isolated.context.localStorage.map.entries()]), before);
  assert.equal(JSON.stringify(a.getPlan()), planBefore);
});

for (const [frequency, divisor] of [['weekly', 52], ['fortnightly', 26], ['monthly', 12], ['annually', 1]]) {
  test(`F1 $500/month is $6000/year for ${frequency} mortgage`, () => {
    const p = controlledPlan(CALC); p.liabilityItems = [mortgage('home', frequency, divisor)];
    const original = JSON.stringify(p), before = calc(p), after = calc(apply(p, { loanRepaymentChangeMonthly: 500 }));
    close(after.annualLoanRepayments - before.annualLoanRepayments, 6000);
    for (const years of [1, 5, 10]) close(after.netWorthProjection[years - 1].closingBalance - before.netWorthProjection[years - 1].closingBalance, 6000 * years);
    assert.equal(JSON.stringify(p), original);
  });
}
test('F1 multiple loans require a target and apply the household increase once', () => {
  const p = controlledPlan(CALC); p.liabilityItems = [mortgage('a', 'monthly', 12), mortgage('b', 'weekly', 52)];
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500 }), /Choose.*home loan/);
  const q = apply(p, { loanRepaymentChangeMonthly: 500, loanId: 'b' });
  assert.equal(q.liabilityItems[0].repayment, 1000);
  close(calc(q).annualLoanRepayments - calc(p).annualLoanRepayments, 6000);
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500, loanId: 'missing' }), /Choose.*home loan/);
});
test('F1 paid-off and inactive loans cannot receive a fictitious repayment', () => {
  const p = controlledPlan(CALC); p.liabilityItems = [{ ...mortgage('a', 'monthly', 12), balance: 0 }];
  assert.throws(() => apply(p, { loanRepaymentChangeMonthly: 500 }), /eligible home loan/);
});

test('F2 single earner increases salary by $5200 with $1664 tax/levy and no second earner', () => {
  const p = controlledPlan(CALC), b = calc(p), q = apply(p, { incomeChange: 5200 }), r = calc(q);
  close(r.finalProjectedCashSurplus - b.finalProjectedCashSurplus, 3536);
  close(r.taxEstimate.totalTax - b.taxEstimate.totalTax, 1664);
  close(r.netConcessionalSuperContributions - b.netConcessionalSuperContributions, 530.4);
  assert.equal(q.incomeItems.length, 1); assert.equal(q.incomeItems[0].owner, 'person1');
});
test('F2 four days reduces the selected salary, tax and employer super', () => {
  const p = controlledPlan(CALC), b = calc(p), r = calc(apply(p, { incomeRateChange: -.2, incomeEmploymentOnly: true }));
  close(r.finalProjectedCashSurplus - b.finalProjectedCashSurplus, -13600);
  close(r.netConcessionalSuperContributions - b.netConcessionalSuperContributions, -2040);
});
test('F2 couples must select an existing income owner; frequency and joint tax-free type survive', () => {
  const p = controlledPlan(CALC);
  p.personal.person2Name = 'Partner'; p.personal.person2Age = 41;
  p.incomeItems.push({ id: 'partner', type: 'salaryWages', owner: 'person2', amount: 2000, frequency: 'fortnightly' });
  assert.throws(() => apply(p, { incomeChange: 5200 }), /Choose.*income/);
  const q = apply(p, { incomeChange: 5200, incomeItemId: 'partner' });
  assert.equal(q.incomeItems[0].amount, 100000); assert.equal(q.incomeItems[1].amount, 2200);
  p.incomeItems.push({ id: 'free', type: 'taxFree', owner: 'joint', amount: 1000, frequency: 'annually', person1AllocationPercentage: 25, person2AllocationPercentage: 75 });
  const t = apply(p, { incomeChange: 5200, incomeItemId: 'free' });
  assert.equal(t.incomeItems[2].type, 'taxFree'); assert.equal(t.incomeItems[2].person1AllocationPercentage, 25);
  close(calc(t).taxEstimate.totalTax, calc(p).taxEstimate.totalTax);
  assert.throws(() => apply(p, { incomeChange: -60000, incomeItemId: 'partner' }), /exceeds/);
});

for (const cash of [10000, 0]) test(`F3 $50000 cost with $${cash} cash reports the full shortfall`, () => {
  const p = controlledPlan(CALC); p.assetItems[0].value = cash;
  assert.throws(() => apply(p, { oneOffCosts: 50000 }), new RegExp((50000 - cash).toLocaleString('en-AU')));
  assert.equal(p.assetItems[0].value, cash);
});
test('F3 missing cash cannot hide a cost; funded costs consume only cash once', () => {
  const p = controlledPlan(CALC); p.assetItems = p.assetItems.filter(item => item.category !== 'cash');
  assert.throws(() => apply(p, { oneOffCosts: 50000 }), /unfunded/);
  p.assetItems.push({ id: 'a', category: 'cash', value: 20000 }, { id: 'b', category: 'cash', value: 40000 });
  const q = apply(p, { oneOffCosts: 50000 });
  close(calc(q).currentNetWorth - calc(p).currentNetWorth, -50000);
  assert.equal(q.assetItems[0].value, 100000);
  close(q.assetItems.filter(a => a.category === 'cash').reduce((s, a) => s + a.value, 0), 10000);
});

test('F4 unsupported employer-super override is explicitly blocked, not silently ignored', () => {
  assert.throws(() => apply(controlledPlan(CALC), { superContributionChange: 5200 }), /Employer super.*not supported/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-comparison="superContributionChange"[^>]*disabled/);
  assert.match(html, /Employer super changes are not supported in this scenario/);
});

test('F5 custom expense preview and saved plan have identical inputs and results', () => {
  const p = controlledPlan(CALC); app.setPlan(p); app.choice('custom', { kind: 'expenses', amount: '5200', frequency: 'annually' });
  const saved = app.get('buildDecisionScenarioSaveContext')('what-if');
  assert.equal(saved.scenarioInputSnapshot.adjustments.expenseChange, -5200);
  assert.equal(saved.scenarioInputSnapshot.quick.custom.frequency, 'annually');
  close(calc(saved.planSnapshot).finalProjectedCashSurplus - calc(p).finalProjectedCashSurplus, 5200);
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(p));
});
test('F5 expense saving allocated to investments is preserved once and reopens against its saved base', () => {
  const p = controlledPlan(CALC); app.setPlan(p); app.choice('expenses-500', null, 'investments');
  const resolved = app.get('resolveWhatIfScenario')(), saved = app.get('buildDecisionScenarioSaveContext')('what-if');
  assert.equal(saved.scenarioInputSnapshot.adjustments.investmentContributionChange, 6000);
  assert.equal(forecast(calc(saved.planSnapshot)), forecast(resolved.adjustedResult));
  const changed = controlledPlan(CALC); changed.assetItems[0].value = 500000; app.setPlan(changed);
  // Avoid DOM navigation only; use the real snapshot restoration before its navigation call.
  app.get('restoreDecisionScenarioInputs')({ ...saved, plan: saved.planSnapshot });
  const reopened = app.get('resolveWhatIfScenario')();
  assert.equal(forecast(reopened.adjustedResult), forecast(resolved.adjustedResult));
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(changed));
});
test('F5 detailed combined scenario persists and reopens without applying surplus twice', () => {
  const p = controlledPlan(CALC); app.setPlan(p);
  app.comparison({ expenseChange: -5200, surplusAllocationTarget: 'investments', surplusAllocationAmount: 5200, surplusAllocationFrequency: 'annually' });
  const saved = app.get('buildDecisionScenarioSaveContext')('custom');
  assert.equal(saved.scenarioInputSnapshot.adjustments.investmentContributionChange, 5200);
  const scenario = { ...saved, id: 'targeted-save', name: 'Audit', plan: saved.planSnapshot, scenarioType: 'decision', source: 'user' };
  assert.equal(app.get('saveScenarios')([scenario]), true);
  const restored = app.get('loadScenarios')().find(s => s.id === 'targeted-save');
  assert.ok(restored);
  app.get('restoreDecisionScenarioInputs')(restored);
  assert.equal(forecast(calc(app.get('buildComparisonPlan')())), forecast(calc(saved.planSnapshot)));
  assert.equal(JSON.stringify(app.getPlan()), JSON.stringify(p));
});

function weeklyInvestmentPlan(returnPct, inflationPct = 0) {
  const p = controlledPlan(CALC);
  p.personal.retirementTiming = { version: 1, people: [{ id: 'person1', fullRetirementAge: 65, hasSemiRetirement: false }] };
  Object.assign(p.investing, { expectedInvestmentReturnPct: returnPct, inflationPct, annualInvestingTarget: 6000 });
  p.expenseItems[0].amount = 16912;
  p.liabilityItems = [{ ...mortgage('loan', 'monthly', 12), balance: 50000, repayment: 500, interestRatePct: 3 }];
  return p;
}

function previewWeeklyInvestment(p) {
  app.setPlan(p);
  // A prior allocation choice must not invest the $100 a second time.
  app.choice('invest-100', null, 'investments');
  return app.get('resolveWhatIfScenario')();
}

const horizons = [1, 5, 10];
const taxPaid = row => row.people.reduce((sum, person) => sum + person.incomeTax + person.medicareLevy
  + person.medicareLevySurcharge + person.stslRepayment + person.superContributionsTax, 0);

for (const [rate, expected] of [
  [0, [5200, 26000, 52000]],
  [2, [5252, 27331.62, 57507.93]],
  [6.5, [5369, 30569.16, 72451.55]],
  [8, [5408, 31726.58, 78343.33]],
]) {
  test(`extra $100/week compounds at ${rate}% over 1, 5 and 10 years without replacing planned investments`, () => {
    const p = weeklyInvestmentPlan(rate);
    const { result, adjustedResult, allocationAdjustments, selection } = previewWeeklyInvestment(p);
    assert.equal(result.finalProjectedCashSurplus, 934 * 52);
    assert.equal(adjustedResult.finalProjectedCashSurplus, 834 * 52);
    assert.equal(adjustedResult.currentNetWorth, result.currentNetWorth);
    assert.equal(allocationAdjustments.investmentContributionChange, 5200);
    assert.equal(selection, 'unallocated');
    assert.equal(p.investing.annualInvestingTarget, 6000);
    assert.equal(adjustedResult.plan.investing.annualInvestingTarget, 11200);
    assert.equal(adjustedResult.plan.investing.expectedInvestmentReturnPct, rate);
    for (const [index, year] of horizons.entries()) {
      const before = result.retirementProjection.years[year - 1];
      const after = adjustedResult.retirementProjection.years[year - 1];
      const b = before.household;
      const a = after.household;
      assert.equal(b.plannedAccessibleInvestmentContributionApplied, 6000);
      assert.equal(a.plannedAccessibleInvestmentContributionApplied, 11200);
      assert.equal(a.cashSurplusBeforeAllocation - b.cashSurplusBeforeAllocation, -5200);
      assert.equal(a.unallocatedSurplusClosingBalance, b.unallocatedSurplusClosingBalance);
      assert.equal(a.offsetClosingBalance, b.offsetClosingBalance);
      assert.equal(a.totalDebt, b.totalDebt);
      assert.equal(a.totalSuperBalance, b.totalSuperBalance);
      assert.equal(a.accessibleInvestmentFees, 0);
      assert.equal(taxPaid(after), taxPaid(before));
      close(adjustedResult.investmentProjection[year - 1].closingBalance - result.investmentProjection[year - 1].closingBalance, expected[index], .05);
      close(a.totalNetWorth - b.totalNetWorth, expected[index], .05);
    }
  });
}

test('reported gains reconcile to a 7% nominal return and 2.5% inflation', () => {
  const { result, adjustedResult } = previewWeeklyInvestment(weeklyInvestmentPlan(7, 2.5));
  const nominal = horizons.map(year => adjustedResult.netWorthProjection[year - 1].closingBalance - result.netWorthProjection[year - 1].closingBalance);
  assert.deepEqual(nominal.map(Math.round), [5382, 30950, 74360]);
  assert.deepEqual(nominal.map((amount, index) => Math.round(amount / 1.025 ** horizons[index])), [5251, 27356, 58090]);
});

test('retained surplus stays in net worth as cash and is excluded from the investment balance', () => {
  const p = weeklyInvestmentPlan(0);
  p.projectionSettings = { workingPhaseSurplusDestination: 'unallocated' };
  const { result, adjustedResult } = previewWeeklyInvestment(p);
  for (const year of horizons) {
    const a = adjustedResult.retirementProjection.years[year - 1].household;
    const b = result.retirementProjection.years[year - 1].household;
    assert.equal(a.unallocatedSurplusClosingBalance - b.unallocatedSurplusClosingBalance, -5200 * year);
    assert.equal(adjustedResult.investmentProjection[year - 1].closingBalance - result.investmentProjection[year - 1].closingBalance, 5200 * year);
    assert.equal(a.totalNetWorth, b.totalNetWorth);
  }
});

test('already-invested surplus is rerouted once with no change in total investment contributions', () => {
  const p = weeklyInvestmentPlan(8);
  p.projectionSettings = { workingPhaseSurplusDestination: 'accessible-investments' };
  const { result, adjustedResult } = previewWeeklyInvestment(p);
  for (const year of horizons) {
    const a = adjustedResult.retirementProjection.years[year - 1].household;
    const b = result.retirementProjection.years[year - 1].household;
    assert.equal(a.surplusToAccessibleInvestments - b.surplusToAccessibleInvestments, -5200);
    assert.equal(a.accessibleInvestmentContribution, b.accessibleInvestmentContribution);
    assert.equal(a.totalNetWorth, b.totalNetWorth);
  }
});

test('a temporary affordability cap does not erase future contributions after a loan is repaid', () => {
  const p = weeklyInvestmentPlan(0);
  p.expenseItems[0].amount = 66500;
  p.liabilityItems[0].balance = 5000;
  const { result, adjustedResult } = previewWeeklyInvestment(p);
  const first = adjustedResult.retirementProjection.years[0].household;
  assert.equal(first.plannedAccessibleInvestmentContributionRequested, 11200);
  assert.ok(first.plannedAccessibleInvestmentContributionApplied < 11200);
  assert.equal(adjustedResult.retirementProjection.years[4].household.plannedAccessibleInvestmentContributionApplied, 11200);
  assert.equal(result.retirementProjection.years[4].household.plannedAccessibleInvestmentContributionApplied, 6000);
});

test('an expense saving in a plan with a deficit can only allocate cash above zero', () => {
  const p = controlledPlan(CALC);
  p.expenseItems[0].amount = 82480;
  app.setPlan(p);
  app.choice('expenses-500', null, 'investments');
  const resolved = app.get('resolveWhatIfScenario')();
  assert.equal(resolved.annualDifference, 6000);
  assert.equal(resolved.allocatable, 1000);
  assert.equal(resolved.adjustedResult.finalProjectedCashSurplus, 0);
});

for (const treatment of ['cash', 'reinvest']) {
  test(`asset-specific return and taxable yield survive an extra contribution with income set to ${treatment}`, () => {
    const p = weeklyInvestmentPlan(7);
    p.assetItems[0].value = 0;
    Object.assign(p.assetItems[1], { investmentReturnMode: 'totalReturn', expectedTotalReturnPct: 8,
      expectedIncomeYieldPct: 2, incomeTreatment: treatment, owner: 'person1' });
    const { result, adjustedResult } = previewWeeklyInvestment(p);
    const firstBefore = result.retirementProjection.years[0];
    const firstAfter = adjustedResult.retirementProjection.years[0];
    const retainedRate = treatment === 'cash' ? .06 : .08;
    close(firstAfter.household.accessibleInvestmentEarnings - firstBefore.household.accessibleInvestmentEarnings, 2600 * retainedRate, .01);
    const nextBefore = result.retirementProjection.years[1];
    const nextAfter = adjustedResult.retirementProjection.years[1];
    const extraYield = (firstAfter.household.closingAccessibleInvestmentBalance - firstBefore.household.closingAccessibleInvestmentBalance) * .02;
    close(nextAfter.household.totalPassiveTaxableIncome - nextBefore.household.totalPassiveTaxableIncome, extraYield, .01);
    close(nextAfter.household.totalPassiveCashIncome - nextBefore.household.totalPassiveCashIncome, treatment === 'cash' ? extraYield : 0, .01);
    close(taxPaid(nextAfter) - taxPaid(nextBefore), extraYield * .32, .02);
  });
}

test('retirement draft fees compound against the same balance basis for both plans', () => {
  const ui = context.FFSSemiRetirementUi;
  const p = weeklyInvestmentPlan(8);
  const { result, adjustedResult } = previewWeeklyInvestment(p);
  const withFees = r => {
    const draft = ui.buildSemiRetirementScenarioDefaults(r.plan, r).draft;
    draft.accessibleInvestments.annualFeesRatePct = 1;
    return ui.runSemiRetirementProjection(context.FFSSemiRetirementProjection, draft).result.years;
  };
  const before = withFees(result);
  const after = withFees(adjustedResult);
  for (const [index, year] of horizons.entries()) {
    const a = after[year - 1].household;
    const b = before[year - 1].household;
    close(a.accessibleInvestmentFees - b.accessibleInvestmentFees, (a.accessibleEarningsBasis - b.accessibleEarningsBasis) * .01, .01);
    close(a.totalNetWorth - b.totalNetWorth, [5382, 30950.48, 74360.12][index], .03);
  }
});

test('contribution-only changes preserve an existing negative investment return', () => {
  const { adjustedResult } = previewWeeklyInvestment(weeklyInvestmentPlan(-2));
  assert.equal(adjustedResult.plan.investing.expectedInvestmentReturnPct, -2);
});
