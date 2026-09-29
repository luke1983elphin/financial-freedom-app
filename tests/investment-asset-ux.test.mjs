import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {load,household} from '../scripts/fi-cashflow-fixture.mjs';
const {CALC}=load();
const plain=x=>JSON.parse(JSON.stringify(x));
const share={id:'shares',category:'shares',value:50000,investmentReturnMode:'totalReturn',expectedTotalReturnPct:7,expectedIncomeYieldPct:3,incomeTreatment:'cash'};
for(const category of ['home','otherProperty','rentalInvestmentProperty','offset','cash','super','vehicle','other']) {
 test(`${category}: split controls and stale split fields are inapplicable`,()=>{
  assert.equal(CALC.assetCapabilities(category).supportsFinancialInvestmentReturn,false);
  const p=household(CALC);p.assetItems=[{...share,category}];
  const before=plain(CALC.calculatePlan(p));
  for(const k of ['investmentReturnMode','expectedTotalReturnPct','expectedIncomeYieldPct','incomeTreatment'])delete p.assetItems[0][k];
  const after=plain(CALC.calculatePlan(p));delete before.plan;delete after.plan;
  assert.deepEqual(after,before);
 });
}
for(const category of ['shares','etf','managedFund'])test(`${category}: explicit type selection defaults to 7/0/reinvest`,()=>{
 const a=CALC.assetWithType({id:'new',category:'cash',value:50000},category);
 assert.equal(a.investmentReturnMode,'totalReturn');assert.equal(a.expectedTotalReturnPct,7);assert.equal(a.expectedIncomeYieldPct,0);assert.equal(a.incomeTreatment,'reinvest');
 assert.deepEqual(plain(CALC.investmentReturnAmounts(a)),{totalReturn:3500,incomeReturn:0,cashIncome:0,taxableIncome:0,capitalGrowth:3500,retainedReturn:3500});
});
for(const [from,to] of [['shares','home'],['home','shares'],['shares','cash'],['managedFund','other'],['crypto','shares'],['shares','rentalInvestmentProperty'],['super','shares']])test(`${from} to ${to}: compatible state and fields`,()=>{
 const a=CALC.assetWithType({...share,category:from},to);assert.equal(a.category,to);
 if(!CALC.assetCapabilities(to).supportsFinancialInvestmentReturn)assert.equal(a.investmentReturnMode,undefined);
 else assert.equal(a.investmentReturnMode,'totalReturn');
});
test('switching shares to crypto uses total return with no stale share income component',()=>{
 const p=household(CALC);p.assetItems=[CALC.assetWithType(share,'crypto')];
 const a=CALC.investmentReturnAssets(p)[0];assert.equal(a.expectedTotalReturnPct,7);assert.equal(a.expectedIncomeYieldPct,0);assert.equal(a.incomeTreatment,'reinvest');
 assert.equal(CALC.passiveIncomeBreakdown(p).total,20000); // existing rental cash only
 assert.equal(CALC.assetCapabilities('crypto').supportsInvestmentIncomeYield,false);
});
test('previously configured crypto income is preserved without inventing new defaults',()=>{
 const p=household(CALC);p.assetItems=[{...share,category:'crypto'}];
 assert.equal(CALC.investmentReturnAssets(p)[0].expectedIncomeYieldPct,3);
 assert.equal(CALC.assetCapabilities('crypto',p.assetItems[0]).supportsInvestmentIncomeYield,true);
 assert.equal(CALC.assetCapabilities('crypto').supportsInvestmentIncomeYield,false);
});
test('50k preview reconciles canonical capital, income and total return',()=>{
 const r=CALC.investmentReturnAmounts(share);assert.equal(r.capitalGrowth,2000);assert.equal(r.incomeReturn,1500);assert.equal(r.totalReturn,3500);
 assert.equal(CALC.investmentReturnAmounts({...share,expectedTotalReturnPct:8}).totalReturn,4000);
 assert.throws(()=>CALC.investmentReturnAmounts({...share,expectedIncomeYieldPct:8}),/cannot exceed/);
});
test('capabilities distinguish property, rental and super models',()=>{
 assert.equal(CALC.assetCapabilities('home').supportsPropertyGrowth,true);assert.equal(CALC.assetCapabilities('home').supportsRentalIncome,false);
 assert.equal(CALC.assetCapabilities('rentalInvestmentProperty').supportsRentalIncome,true);assert.equal(CALC.assetCapabilities('super').supportsSuperGrowth,true);
});
test('guided switching to Other clears incompatible persisted settings',()=>{
 const c={console,FFSCalculator:CALC};c.globalThis=c;vm.runInNewContext(readFileSync(new URL('../linked-setup.js',import.meta.url),'utf8'),c);
 const p=household(CALC);p.assetItems=[share];
 const r=c.FFSLinkedSetup.upsertInvestment(p,{...share,assetId:'shares',name:'Other asset',investmentType:'otherInvestment',owner:'person1',hasLoan:false});
 assert.equal(r.ok,true);assert.equal(r.plan.assetItems[0].investmentReturnMode,undefined);assert.equal(CALC.investmentReturnAssets(r.plan).length,0);
});
for(const fixture of JSON.parse(readFileSync(new URL('./fixtures/investment-ux-parity.json',import.meta.url),'utf8')))test(`PR16 configured ${fixture.name}: all outputs and saved scenario unchanged`,()=>{
 const c={console};c.globalThis=c;c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-29T00:00:00Z']));}static now(){return Date.parse('2026-09-29T00:00:00Z');}};
 for(const f of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js'])vm.runInNewContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
 const calc=c.FFSCalculator.calculatePlan(fixture.plan),{draft}=c.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(fixture.plan,calc);
 const records=JSON.parse(JSON.stringify({calc,draft,retirement:c.FFSSemiRetirementUi.runSemiRetirementProjection(c.FFSSemiRetirementProjection,draft)}));
 assert.equal(createHash('sha256').update(JSON.stringify(records)).digest('hex'),fixture.sha256);
});
