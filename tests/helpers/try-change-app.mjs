import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
export function loadTryChangeApp() {
  // Reuse the existing isolated DOM/storage fixture without executing its tests.
  const fixture = read('tests/data-durability-r5.test.mjs');
  const setup = { console, vm, read };
  vm.createContext(setup);
  vm.runInContext(fixture.slice(fixture.indexOf('class MemoryStorage'), fixture.indexOf('const API ='))
    + fixture.slice(fixture.indexOf('function createDocumentStub'), fixture.indexOf('test("R5-A')), setup);
  const loaded = vm.runInContext('loadAppBackupHooks()', setup);
  for (const file of ['plan-schema.js', 'legacy-plan-adapter.js', 'semiRetirementProjection.js', 'v2-data.js', 'trust-readiness.js']) {
    vm.runInContext(read(file), loaded.context, { filename: file });
  }
  const hook = `window.tryChangeTest = {
    get: name => eval(name),
    setPlan(value) { plan = CALC.clonePlan(value); },
    getPlan() { return CALC.clonePlan(plan); },
    choice(id, custom, allocation = 'unallocated') { activeWhatIfId = id; if (custom) customWhatIf = custom; whatIfAllocation = allocation; },
    comparison(value) { decisionScenarioDraft = value; }
  };`;
  vm.runInContext(read('app.js').replace('  if (window.FFS_TEST_HOOKS_ENABLED === true) {', hook + '\n  if (window.FFS_TEST_HOOKS_ENABLED === true) {'), loaded.context);
  return { ...loaded, app: loaded.context.tryChangeTest };
}

export function controlledPlan(CALC) {
  const p = CALC.emptyPlan();
  Object.assign(p.personal, { person1Name: 'Audit', person1Age: 43, person2Name: '', person2Age: 0, fullRetirementAge: 65, targetAnnualSpending: 40000 });
  Object.assign(p.income, { person1HospitalCoverStatus: 'full-year', person2HospitalCoverStatus: 'full-year', dependantsHospitalCoverStatus: 'full-year' });
  Object.assign(p.investing, { inflationPct: 0, wageGrowthPct: 0, expectedInvestmentReturnPct: 0, expectedSuperReturnPct: 0, annualInvestingTarget: 0 });
  p.assetItems = [{ id: 'cash', category: 'cash', value: 100000 }, { id: 'shares', category: 'shares', value: 100000 }];
  p.incomeItems = [{ id: 'salary', type: 'salaryWages', owner: 'person1', amount: 100000, frequency: 'annually' }];
  p.expenseItems = [{ id: 'living', category: 'living', amount: 40000, frequency: 'annually' }];
  p.liabilityItems = [];
  return p;
}
