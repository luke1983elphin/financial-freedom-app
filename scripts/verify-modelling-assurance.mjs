import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {load,mortgagePlan,couplePlan,debtPlans} from './modelling-assurance-fixture.mjs';
const baseline=load(pathToFileURL(path.resolve(process.argv[2])+'/'));
const current=load();
const output=process.argv[3]||'evidence';mkdirSync(output,{recursive:true});
function capture({CALC:C,UI}) {
  const mortgageInput=mortgagePlan(C), m=C.calculatePlan(mortgageInput);
  const mortgage=m.investmentProjection.slice(0,6).map((r,i)=>{
    const months=m.loan.schedule.slice(i*12,(i+1)*12);
    return {year:r.year,...(m.accumulationCashflowProjection?.[i]||{
      openingMortgageBalance:months[0]?.openingBalance??0,
      requiredMortgageRepayment:months.reduce((s,m)=>s+m.repayment,0),
      mortgageCashflowDeduction:null,netHouseholdCashIncome:m.netIncomeAfterTaxHelp,
      livingExpenses:m.annualLivingExpenses,requiredDebtRepayments:null,
      configuredInvesting:m.configuredInvestmentContribution,
      affordableInvesting:null,actualInvesting:r.annualContribution,remainingSurplus:null,
      note:'Baseline has no future affordability/cashflow row; null fields were not calculated.'}),
      projectionContribution:r.annualContribution,closingInvestmentBalance:r.closingBalance};
  });
  const s=C.calculatePlan(couplePlan(C));
  const superRows=s.fiWealthProjection.slice(0,7).map((r,i)=>({year:i,person1Age:58+i,person2Age:55+i,
    person1Super:300000,person2Super:250000,
    person1Eligible:r.superPeople?.[0].accessible??(58+i>=60?300000:0),
    person2Eligible:r.superPeople?.[1].accessible??(58+i>=60?250000:0),
    accessibleFiAssets:r.accessibleFiAssets,inaccessibleSuper:r.inaccessibleSuper,totalFiWealth:r.totalFiWealth,
    financialFreedomPercent:r.progress??s.financialFreedomProgress}));
  const debt=Object.fromEntries(Object.entries(debtPlans(C)).map(([key,p])=>[key,UI.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft.liabilities]));
  return {mortgage,super:superRows,debt};
}
const before=capture(baseline),after=capture(current);
for(const [name,data] of Object.entries({before,after})) writeFileSync(path.join(output,`assurance-${name}.json`),JSON.stringify(data,null,2));
// Compare every existing scalar/array/object output, excluding additive audit
// metadata only. Eligibility affected scenarios are deliberately outside parity.
function strip(value) {
  if(Array.isArray(value)) return value.map(strip);
  if(!value||typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k])=>!['superPeople','accumulationCashflowProjection'].includes(k)).map(([k,v])=>[k,strip(v)]));
}
const parity=[];
for(const kind of ['single-no-debt','couple-same-age','no-super-no-debt','mortgage-not-paid-off']) {
  const p=kind==='mortgage-not-paid-off'?mortgagePlan(current.CALC):couplePlan(current.CALC);p.personal.person1Age=65;p.personal.person2Age=65;
  if(kind==='mortgage-not-paid-off'){p.liabilities.homeLoanBalance=1000000;p.liabilities.remainingLoanTermYears=40;}
  if(kind==='single-no-debt'){p.assets.superPerson2=0;p.personal.person2Age=0;p.personal.person2Name='';}
  if(kind==='no-super-no-debt'){p.assets.superPerson1=0;p.assets.superPerson2=0;}
  const actual=strip(JSON.parse(JSON.stringify(current.CALC.calculatePlan(p))));
  const expected=strip(JSON.parse(JSON.stringify(baseline.CALC.calculatePlan(p))));
  assert.deepEqual(actual,expected,kind);
  parity.push({scenario:kind,pass:true,scope:'Every pre-existing calculatePlan output; additive audit fields excluded'});
}
writeFileSync(path.join(output,'assurance-parity.json'),JSON.stringify(parity,null,2));
console.log(JSON.stringify({before,after,parity},null,2));
