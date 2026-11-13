// Independent oracle audit. No production code, fixtures or protected hashes are modified.
// Run from repository root: node docs/audit-2026-11-13/household-audit.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import '../../calculator.js';
import '../../agePensionEstimate.js';
import '../../semiRetirementProjection.js';
import '../../semiRetirementUi.js';
import '../../dollar-basis.js';
const C = globalThis.FFSCalculator, E = globalThis.FFSSemiRetirementProjection;
const P = globalThis.FFSAgePension, U = globalThis.FFSSemiRetirementUi;
const results = [];
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
// Independently transcribed statutory piecewise equations, not app configuration.
function residentTax(x, year = 2026) {
  const first = year >= 2027 ? .14 : .15;
  const incomeTax = x <= 18200 ? 0 : x <= 45000 ? (x - 18200) * first
    : x <= 135000 ? 26800 * first + (x - 45000) * .30
      : x <= 190000 ? 26800 * first + 90000 * .30 + (x - 135000) * .37
        : 26800 * first + 90000 * .30 + 55000 * .37 + (x - 190000) * .45;
  const lito = x <= 37500 ? 700 : x <= 45000 ? 700 - (x - 37500) * .05
    : Math.max(0, 325 - (x - 45000) * .015);
  // Ordinary individual Medicare only; family and pensioner concessions excluded here.
  return money(Math.max(0, incomeTax - lito) + Math.min(.02 * x, Math.max(0, (x - 28011) * .1)));
}
function plan(age = 40) {
  const p = C.emptyPlan();
  p.personal.person1Age = age; p.personal.fullRetirementAge = 65;
  return p;
}
const wage = (amount, owner = 'person1') => ({ id: `w-${owner}`, type: 'salaryWages', owner, amount, frequency: 'annually' });
const dividend = (amount, extra = {}) => ({ id: 'div', type: 'dividends', owner: 'person1', amount, frequency: 'annually', ...extra });
const shares = (value, treatment = 'cash', extra = {}) => ({ id: 'shares', category: 'shares', owner: 'person1', value,
  investmentReturnMode: 'totalReturn', expectedTotalReturnPct: 7, expectedIncomeYieldPct: 3, incomeTreatment: treatment, ...extra });
function person(age = 65, extra = {}) {
  return { id: 'person1', name: 'A', currentAge: age, currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0, semiRetirementAge: age, semiRetirementGrossIncome: 0, fullRetirementAge: age,
    superAccessAge: 60, openingSuperBalance: 0, superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0, superAnnualFeesRate: 0, employerSuperRate: .12,
    existingAdditionalConcessionalContributions: 0, additionalContributionsStopAge: age,
    stslOpeningBalance: 0, hasPrivateHealthCover: true, ...extra };
}
function retirement({ age = 65, spending = 0, balance = 0, rate = 0, fees = 0, inflation = 0, people, ...extra } = {}) {
  return { projectionStartYear: 2026, projectionEndAge: age + 2, inflationRate: inflation,
    household: { currentLifestyleSpending: spending, semiRetirementLifestyleSpending: spending,
      fullRetirementLifestyleSpending: spending, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    accessibleInvestments: { openingBalance: balance, annualReturnRate: rate, annualFeesRate: fees, currentAnnualContributions: 0 },
    people: people || [person(age)], scenario: { fullRetirementAnnualSpending: spending, minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0, surplusDestination: 'enjoyment' }, ...extra };
}
function audit(id, household, input, run, knownFinding = null) {
  const checks = [];
  const check = (metric, actual, expected, tolerance = .02) => {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) throw Error(`${id}: nonfinite ${metric}`);
    checks.push({ metric, expected: money(expected), actual: money(actual), delta: money(actual - expected),
      tolerance, matches: Math.abs(actual - expected) <= tolerance });
  };
  const before = JSON.stringify(input);
  run(input, check);
  if (before !== JSON.stringify(input)) throw Error(`${id}: input mutated`);
  const matches = checks.every(c => c.matches);
  results.push({ id, household, input, checks, status: matches ? 'MATCH' : 'DISCREPANCY', finding: matches ? null : knownFinding });
}
// H01-H08: whole household current cash and tax, not merely tax helper calls.
for (const [index, salary] of [0, 18200, 30000, 45000, 80000, 135000, 190000, 250000].entries()) {
  const p = plan(); p.incomeItems = [wage(salary)];
  // Explicit full private cover prevents unrelated MLS from contaminating the tax oracle.
  p.income.person1HospitalCoverStatus = 'yes'; p.income.person1HospitalCoverDays = 365;
  audit(`H${String(index + 1).padStart(2, '0')}`, `Single resident age 40; salary $${salary}; no deductions, HELP or investment income; full hospital cover`, p, (p, check) => {
    const r = C.calculatePlan(p);
    check('ordinary income tax plus Medicare', r.taxEstimate.totalTaxAfter, residentTax(salary));
    check('gross salary', r.annualGrossIncome, salary);
    check('employer SG', r.employerSuperContributions.person1Amount, Math.min(salary, 270830) * .12);
  });
}
{
  const p = plan(); p.personal.person2Age = 38; p.incomeItems = [wage(80000), wage(60000, 'person2')];
  audit('H09', 'Dual earner couple 40/38; $80k/$60k; no loans', p, (p, check) => {
    const r = C.calculatePlan(p); check('household tax plus Medicare', r.taxEstimate.totalTaxAfter, residentTax(80000) + residentTax(60000));
    check('net household income', r.netIncomeAfterTaxHelp, 140000 - residentTax(80000) - residentTax(60000));
    check('net SG after 15% contribution tax', r.netEmployerSuperContributions, 140000 * .12 * .85);
  });
}
for (const [id, salary, debt] of [['H10', 86380, 40000], ['H11', 137064, 40000], ['H12', 254780, 1000]]) {
  const p = plan(30); p.incomeItems = [wage(salary)]; p.liabilities.person1StslBalance = debt; p.income.person1HasStslDebt = true;
  const expected = Math.min(debt, salary > 186050 ? salary * .1 : salary > 129717 ? 9028 + (salary - 129717) * .17 : (salary - 69528) * .15);
  audit(id, `Graduate age 30; repayment income $${salary}; HELP balance $${debt}`, p, (p, check) => {
    const r = C.calculatePlan(p); check('compulsory HELP repayment', r.helpRepaymentEstimate.annualRepayment, expected);
  });
}
{
  const p = plan(); p.incomeItems = [wage(100000)]; p.investing.extraSuperContributions = 10000;
  audit('H13', 'Single age 40; $100k salary; $10k deductible extra super', p, (p, check) => {
    const r = C.calculatePlan(p); check('income tax saving', r.taxEstimate.extraSuper.estimatedPersonalTaxSaving, residentTax(100000) - residentTax(90000));
    check('net extra super contribution', r.netExtraSuperContributions, 8500);
  });
}
{
  const p = plan(); p.incomeItems = [wage(300000)];
  audit('H14', 'High earner age 40; $300k salary; SG at maximum base; Division 293 applies', p, (p, check) => {
    const r = C.calculatePlan(p); const sg = 270830 * .12;
    // Total tax liability, regardless of whether paid from super or personal cash.
    check('total contribution tax including Division 293', r.superContributionsTaxPaid, sg * .30);
  }, 'F06');
}
{
  const p = plan(70); p.incomeItems = [dividend(7000, { cashDividend: 7000, frankingCredits: 3000 })];
  audit('H15', 'Retiree 70; only $7k fully franked cash dividend; $3k credits; refundable entitlement assumed', p, (p, check) => {
    const r = C.calculatePlan(p); check('grossed up taxable income', r.person1AnnualIncome, 10000);
    check('cash including refundable franking credit', r.netIncomeAfterTaxHelp, 10000);
  }, 'F05');
}
{
  const p = plan(); p.assets.sharesEtfs = 500000; p.incomeItems = [dividend(15000)];
  audit('H16', 'Legacy investor age 40; $500k shares; 7% total return includes $15k cash yield', p, (p, check) => {
    const r = C.calculatePlan(p); check('economic return: retained growth plus cash income', r.combinedWealthCreation, 35000);
  }, 'F03');
}
for (const [id, treatment] of [['H17', 'cash'], ['H18', 'reinvest']]) {
  const p = plan(); p.assetItems = [shares(500000, treatment)];
  p.incomeItems = [dividend(15000, { linkedAssetId: 'shares' })];
  audit(id, `Investor age 40; $500k; explicit 7% total/3% yield; ${treatment}; linked dividend reference`, p, (p, check) => {
    const r = C.calculatePlan(p), a = r.investmentReturnSummary.assets[0];
    check('nominal total return', a.totalReturn, 35000);
    check('retained growth', a.retainedReturn, treatment === 'cash' ? 20000 : 35000);
    check('cash income', r.annualPassiveIncome, treatment === 'cash' ? 15000 : 0);
    check('taxable income counted once', r.person1AnnualIncome, 15000);
    check('economic growth metric', r.combinedWealthCreation, 35000);
  });
}
{
  const p = plan(); p.assetItems = [shares(500000)]; p.incomeItems = [dividend(15000)];
  audit('H19', 'Same explicit investor but manually entered duplicate dividend is unlinked', p, (p, check) => {
    const r = C.calculatePlan(p); check('economic return without duplicate dividend', r.combinedWealthCreation, 35000);
  }, 'F03');
}
{
  const p = plan(); p.assets.sharesEtfs = 500000;
  audit('H20', 'No-contribution investor age 40; interprets 7% as effective annual return', p, (p, check) => {
    const r = C.calculatePlan(p); check('year-one effective annual closing investment balance', r.investmentProjection[0].closingBalance, 535000);
  }, 'F02');
}
{
  const p = plan(); p.assets.superPerson1 = 500000;
  audit('H21', 'No-contribution super saver age 40; interprets 6.5% as effective annual return', p, (p, check) => {
    const r = C.calculatePlan(p); check('year-one effective annual closing super', r.superProjection[0].closingBalance, 532500);
  }, 'F02');
}
{
  const p = plan(); p.assets.otherPropertyValue = 600000; p.investing.expectedInvestmentReturnPct = 0;
  p.liabilityItems = [{ id: 'rental-loan', type: 'rentalPropertyLoan', balance: 350000, interestRatePct: 0,
    repayment: 0, repaymentFrequency: 'monthly', repaymentType: 'interestOnly', termYears: 30 }];
  audit('H22', 'Property-only household 40; $600k rental; $350k unchanged interest-free debt; 3% growth', p, (p, check) => {
    const r = C.calculatePlan(p); check('current net worth', r.currentNetWorth, 250000);
    check('year-one net worth after property growth and debt', r.netWorthProjection[0].closingBalance, 600000 * 1.03 - 350000);
    check('property capital growth', r.projectedPropertyGrowth, 18000);
  }, 'F04');
}
for (const [id, treatment, income] of [['H23', 'beforeInterest', 22000], ['H24', 'afterInterest', 7000]]) {
  const p = plan(); p.incomeItems = [{ id: 'rent', type: 'rentalNetCashIncome', owner: 'person1', amount: income,
    rentalCashIncomeAnnual: income, frequency: 'annually', rentalCashflowTreatment: treatment, linkedLoanIds: ['loan'] }];
  p.liabilityItems = [{ id: 'loan', type: 'rentalPropertyLoan', balance: 300000, interestRatePct: 5,
    repayment: 1250, repaymentFrequency: 'monthly', repaymentType: 'interestOnly', additionalPrincipalRepayment: 6000,
    additionalPrincipalFrequency: 'annually', linkedRentalIncomeId: 'rent' }];
  audit(id, `Landlord age 40; rental ${treatment}; $15k interest/$6k additional principal`, p, (p, check) => {
    const r = C.calculatePlan(p).rentalPropertyCashflow; check('rental cash to household after principal', r.annualHouseholdCashflowContribution, 22000 - 15000 - 6000);
    check('passive rent before principal', r.annualRentalPassiveIncomeBeforePrincipal, 7000);
  });
}
{
  const input = { principal: 300000, annualInterestRate: .06, monthlyRepayment: 2000, termYears: 30, offsetBalance: 50000 };
  audit('H25', 'Mortgagor age 35; $300k mortgage/$50k offset; 6%; $2k monthly payment', input, (p, check) => {
    const r = C.amortiseLoan(p); const q = 1 + .06 / 12;
    check('first-month interest', r.schedule[0].interestCharged, 250000 * .06 / 12);
    check('12-month loan balance', r.schedule[11].closingBalance, 50000 + 250000 * q ** 12 - 2000 * (q ** 12 - 1) / (q - 1), .05);
  });
}
{
  const p = plan(62); p.personal.person2Age = 55; p.assets.superPerson1 = 300000; p.assets.superPerson2 = 400000;
  audit('H26', 'Mixed-age couple 62/55; $300k/$400k super; ordinary age-60 access assumed', p, (p, check) => {
    const r = C.calculatePlan(p); check('eligible super only', r.superAccessibleToday, 300000);
    check('current FI assets', r.currentNetFiAssets, 300000);
  });
}
{
  const p = plan(45); p.personal.fullRetirementAge = 55; p.personal.targetAnnualSpending = 80000;
  audit('H27', 'Household age 45; retirement 55; $80k today spending; CPI 2.5%', p, (p, check) => {
    const r = C.calculatePlan(p); const future = 80000 * 1.025 ** 10;
    check('nominal target spending', r.targetAnnualLifestyleSpendingAtFinancialFreedomAge, future);
    check('4% target capital', r.targetCapital, money(future) / .04, .2);
    check('today-dollar round trip', globalThis.FFSDollarBasis.valueInTodaysDollars(future, 10, 2.5), 80000);
  });
}
{
  const p = retirement({ spending: 40000, balance: 1000000, rate: .07, fees: .01 });
  audit('H28', 'Retiree 65; $1m investments; $40k spending; 7% return/1% explicit fee; midpoint timing', p, (p, check) => {
    const r = E.projectRetirementScenario(p); if (!r.validation.isValid) throw Error(JSON.stringify(r.validation));
    const h = r.years[0].household; check('investment earnings', h.accessibleInvestmentEarnings, 980000 * .07);
    check('investment fees', h.accessibleInvestmentFees, 980000 * .01);
    check('closing assets', h.closingAccessibleInvestmentBalance, 1000000 - 40000 + 980000 * .06);
  });
}
{
  const p = retirement({ age: 59, spending: 40000, balance: 10000, people: [person(59, { openingSuperBalance: 500000 })] });
  audit('H29', 'Early retiree 59; $10k liquid/$500k super; $40k required spending', p, (p, check) => {
    const r = E.projectRetirementScenario(p); const h = r.years[0].household;
    check('required unfunded spending before age 60', h.unmetRequiredLifestyleSpending, 30000);
    check('restricted super untouched', r.years[0].people[0].closingSuperBalance, 500000);
    check('age-60 access funds next year', r.years[1].household.unmetRequiredLifestyleSpending, 0);
  });
}
{
  const p = retirement({ age: 60, spending: 40000, balance: 10000, people: [person(60, { openingSuperBalance: 500000 })] });
  audit('H30', 'Retiree 60; $10k liquid/$500k eligible super; accessible-first spending', p, (p, check) => {
    const r = E.projectRetirementScenario(p); const h = r.years[0].household;
    check('super draw after liquid exhaustion', h.requiredSuperWithdrawal, 30000);
    check('closing super', r.years[0].people[0].closingSuperBalance, 470000);
    check('unfunded spending', h.unmetRequiredLifestyleSpending, 0);
  });
}
{
  const p = retirement({ age: 65, spending: 40000, balance: 200000, inflation: .025 });
  audit('H31', 'Retiree 65; $200k cash; $40k base spending; CPI 2.5%; zero returns', p, (p, check) => {
    const r = E.projectRetirementScenario(p); check('year-two closing assets', r.years[1].household.closingAccessibleInvestmentBalance, 200000 - 40000 - 40000 * 1.025);
  });
}
// Pension numerical checks independently use the dated schedule in docs/AGE-PENSION.md.
// Live schedule retrieval failed; these establish arithmetic, not current legal-rate assurance.
for (const [id, partnered, ages, assets, income, expected] of [
  ['H32', false, [70], 0, 0, 1237.7 * 26],
  ['H33', true, [70, 68], 499000, 0, 933 * 26 * 2],
  ['H34', true, [70, 62], 599000, 0, 933 * 26 - 100 * 39],
  ['H35', false, [70], 433000, 0, 1237.7 * 26 - 100 * 78],
  ['H36', false, [70], 0, 15876, 1237.7 * 26 - 10000 * .5],
]) {
  const p = { partnered, person1Age: ages[0], person2Age: ages[1], assessableAssets: assets, assessableAnnualIncome: income, homeowner: true };
  audit(id, `Pension household ${ages.join('/')}; homeowner; assessable assets $${assets}; assessed income $${income}`, p, (p, check) => {
    check('annual gross pension under dated schedule', P.estimateAnnualPension(p).annualPension, expected);
  });
}
{
  const p = { people: [{ age: 70, openingSuperBalance: 0, grossEmploymentIncome: 0 }, { age: 62, openingSuperBalance: 500000, grossEmploymentIncome: 0 }],
    assets: [{ type: 'home', openingValue: 1000000 }], liabilities: [], accessibleBalance: 100000, calendarYear: 2026, annualIndexationRate: 0 };
  audit('H37', 'Pension couple 70/62; $1m home/$100k liquid/$500k younger accumulation super', p, (p, check) => {
    const r = P.assessProjectionYear(p); check('assessable assets exclude home and younger super', r.assessableAssets, 100000);
    check('deeming lower tier', r.deemedAnnualIncome, 100000 * .0175);
    check('one partnered pension', r.annualPension, 933 * 26);
  });
}
{
  const p = retirement({ age: 40, people: [person(40, { fullRetirementAge: 42, semiRetirementAge: 42, openingSuperBalance: 500000,
    superReturnBeforeRetirement: .065, superAnnualFeesRate: .01 })] });
  audit('H38', 'Super saver 40; $500k; explicit 6.5% return/1% fee; user interprets return as gross before 15% earnings tax', p, (p, check) => {
    const r = E.projectRetirementScenario(p); check('closing super under gross-return interpretation', r.years[0].people[0].closingSuperBalance, 500000 + 32500 * .85 - 5000);
  }, 'F01');
}
{
  const p = retirement({ age: 65, balance: 500000, rate: .07 });
  audit('H39', 'Retiree 65; $500k; 7% effective annual return; no flows', p, (p, check) => {
    check('annual retirement closing investment balance', E.projectRetirementScenario(p).years[0].household.closingAccessibleInvestmentBalance, 535000);
  });
}
{
  const p = plan(65); p.assets.superPerson1 = 500000; p.personal.fullRetirementAge = 65;
  audit('H40', 'Retiree 65; only $500k super; zero lifestyle draw; simple sustainability illustration', p, (p, check) => {
    const r = C.calculatePlan(p), start = r.totalRetirementAssets;
    check('retirement starting assets when already retiring today', start, 500000);
    // Under the plan super assumption this pot must earn 6.5%, not the unrelated 7% investment assumption.
    check('simple retirement age-70 balance at entered super rate', r.retirementSustainability[1].balances[70], start * 1.065 ** 5, .1);
  }, 'F07');
}
{
  const p = plan(); p.assetItems = [shares(2000000, 'reinvest')];
  audit('H41', 'Investor 40; $2m reinvested shares; no wage/cash reserve; tax must be paid from portfolio at year end', p, (p, check) => {
    const r = C.calculatePlan(p), nominalClosing = 2000000 * (1 + .07 / 12) ** 12;
    const taxableYield = (nominalClosing - 2000000) * 3 / 7;
    check('portfolio closing after funding year-end income tax', r.investmentProjection[0].closingBalance, nominalClosing - residentTax(taxableYield), .5);
  }, 'F08');
}
{
  const p = retirement({ age: 70, spending: 25000 }); p.scenario.agePension = { enabled: true };
  audit('H42', 'Single 70; no assets or employment; $25k spending; opt-in pension and SAPTO', p, (p, check) => {
    const r = E.projectRetirementScenario(p); if (!r.validation.isValid) throw Error(JSON.stringify(r.validation));
    check('integrated gross pension under dated schedule', r.years[0].household.estimatedAgePension, 1237.7 * 26);
    check('pension funds required spending', r.years[0].household.unmetRequiredLifestyleSpending, 0);
  });
}
{
  const p = retirement({ age: 65, balance: 500000, spending: 40000, rate: -.20 });
  audit('H43', 'Retiree 65; legacy aggregate portfolio; -20% return stress; $40k spending', p, (p, check) => {
    const r = E.projectRetirementScenario(p); check('downside midpoint closing assets', r.years[0].household.closingAccessibleInvestmentBalance, 500000 - 40000 - 480000 * .20);
  });
}
{
  const p = shares(500000, 'cash', { expectedTotalReturnPct: -20, expectedIncomeYieldPct: 3 });
  audit('H44', 'Same downside household using explicit holding: -20% total return with positive 3% cash yield', p, (p, check) => {
    check('validation errors for economically possible downside return', C.investmentReturnValidation(p).length, 0);
  }, 'F10');
}
{
  const p = retirement({ age: 65, balance: 100000, spending: 40000, inflation: -.02 });
  audit('H45', 'Retiree 65; $100k cash; $40k spending; 2% annual deflation', p, (p, check) => {
    const r = E.projectRetirementScenario(p); check('deflation year-two closing cash', r.years[1].household.closingAccessibleInvestmentBalance, 100000 - 40000 - 40000 * .98);
  });
}
{
  const p = plan(55); p.assets.superPerson1 = 500000; p.personal.fullRetirementAge = 65;
  audit('H46', 'Near-retiree 55; $500k super; defaults mapped into new retirement scenario', p, (p, check) => {
    const draft = U.buildSemiRetirementScenarioDefaults(p, C.calculatePlan(p)).draft;
    check('before-retirement default super return percent', draft.people[0].superReturnBeforeRetirementPct, 6.5);
    check('after-retirement default super return percent', draft.people[0].superReturnAfterRetirementPct, 5.5);
    check('default explicit super fee percent', draft.people[0].superAnnualFeesRatePct, 0);
    check('default explicit investment fee percent', draft.accessibleInvestments.annualFeesRatePct, 0);
  });
}
{
  const p = retirement({ age: 65, balance: 2000000 });
  p.accessibleInvestments.components = [shares(2000000, 'reinvest')];
  audit('H47', 'Retiree 65; $2m explicit reinvested shares; $60k taxable yield; zero cash income/spending; no pension', p, (p, check) => {
    const r = E.projectRetirementScenario(p); if (!r.validation.isValid) throw Error(JSON.stringify(r.validation));
    const h = r.years[0].household, owner = r.years[0].people[0];
    check('income tax and Medicare computed on reinvested yield', owner.incomeTax + owner.medicareLevy, residentTax(60000));
    check('tax liability funded from portfolio', h.totalAccessibleInvestmentWithdrawal, residentTax(60000));
  }, 'F08');
}
{
  const p = { people: [{ taxableIncome: 30000, eligible: true }], financialYear: '2026-27' };
  audit('H48', 'Eligible single senior age 70; $30k taxable pension/other income; SAPTO under statutory formula', p, (p, check) => {
    const r = P.estimateSapto(p.people, p.financialYear)[0];
    check('SAPTO threshold from statutory $445 constant', r.rebateThreshold, Math.ceil(18200 + (445 + 2230) / .15));
    check('income tax after LITO and SAPTO', r.incomeTax, 0);
  });
}
const protectedFiles = ['calculator.js', 'semiRetirementProjection.js', 'agePensionEstimate.js', 'semiRetirementUi.js', 'dollar-basis.js'];
const evidence = { auditedMain: '6f3dbf83cc744e765eddf6244313635ea357bc9a', auditDate: '2026-11-13',
  methodology: 'Independent statutory piecewise equations, closed-form compound interest, loan annuity identity, cash/asset conservation, explicit dated pension schedule. No expected value read from existing tests or golden fixtures.',
  limitations: 'Annual effective-return interpretation and gross-super interpretation are explicit test assumptions, not declarations that the app promises those conventions. Pension arithmetic is conditional on the repository dated schedule, pending successful current-source revalidation.',
  sourceSha256: Object.fromEntries(protectedFiles.map(f => [f, createHash('sha256').update(readFileSync(new URL('../../' + f, import.meta.url))).digest('hex')])),
  householdCount: results.length, matchingHouseholds: results.filter(r => r.status === 'MATCH').length,
  discrepancyHouseholds: results.filter(r => r.status !== 'MATCH').length, results };
writeFileSync(new URL('./household-results.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
const rows = results.flatMap(r => r.checks.map(c => `| ${r.id} | ${c.metric} | ${c.expected.toFixed(2)} | ${c.actual.toFixed(2)} | ${c.delta.toFixed(2)} | ${c.matches ? 'MATCH' : r.finding || 'UNEXPECTED'} |`));
writeFileSync(new URL('./household-results.md', import.meta.url), `# Independent household checks\n\n${evidence.householdCount} households; ${evidence.matchingHouseholds} match all checks; ${evidence.discrepancyHouseholds} contain discrepancies. Monetary figures are AUD. Delta = app minus independent expectation. All full inputs are in household-results.json. A successful runner exit means evidence was generated and all mismatches have a finding ID; it does not mean the model passed.\n\n| Household | Metric | Expected | Actual | Delta | Outcome |\n| --- | --- | ---: | ---: | ---: | --- |\n${rows.join('\n')}\n`);
console.log(JSON.stringify({ households: results.length, checks: results.reduce((s, r) => s + r.checks.length, 0), matching: evidence.matchingHouseholds,
  discrepancies: results.filter(r => r.status !== 'MATCH').map(r => ({ id: r.id, finding: r.finding, checks: r.checks.filter(c => !c.matches) })) }, null, 2));
if (results.some(r => r.status !== 'MATCH' && !r.finding)) process.exitCode = 1;
