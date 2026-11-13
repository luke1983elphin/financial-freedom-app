import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c={console};c.globalThis=c;
for(const file of ['calculator.js','agePensionEstimate.js','semiRetirementProjection.js','semiRetirementUi.js','dollar-basis.js','forecast-assumptions.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const A=c.FFSForecastAssumptions,C=c.FFSCalculator,U=c.FFSSemiRetirementUi,E=c.FFSSemiRetirementProjection;
const plain=value=>JSON.parse(JSON.stringify(value));
function plan(timing=false){
  const p=plain(C.emptyPlan());Object.assign(p.personal,{person1Name:'Alex',person1Age:43,person2Age:0,fullRetirementAge:65,targetAnnualSpending:40000});
  p.assetItems=[{id:'shares',name:'Portfolio',category:'shares',owner:'person1',value:500000,investmentReturnMode:'totalReturn',expectedTotalReturnPct:8,expectedIncomeYieldPct:3,incomeTreatment:'cash'},{id:'home',category:'home',value:800000},{id:'rental',category:'rentalInvestmentProperty',value:400000,propertyGrowthRatePct:4}];
  p.incomeItems=[{id:'salary',type:'salaryWages',owner:'person1',amount:100000,frequency:'annually'},{id:'dividend',type:'dividends',owner:'person1',amount:99999,linkedAssetId:'shares',frequency:'annually'}];
  p.expenseItems=[{id:'living',category:'living',amount:40000,frequency:'annually'}];
  p.assets.superPerson1=200000;
  if(timing)p.personal.retirementTiming={people:[{id:'person1',fullRetirementAge:65,hasSemiRetirement:false,alreadyRetired:false}]};
  return p;
}
const forecast=p=>U.applyRetirementForecast(p,C.calculatePlan(p),E);
for(const timing of [false,true])test(`unchanged saved plan retains exact full forecast and shape (retirement timing ${timing})`,()=>{
  const p=plan(timing),before=JSON.stringify(p),result=JSON.stringify(forecast(p));const applied=A.apply(p,A.draft(p));
  assert.equal(applied.ok,true);assert.deepEqual(plain(applied.plan),p);assert.equal(JSON.stringify(forecast(applied.plan)),result);assert.equal(JSON.stringify(p),before);assert.equal(applied.changed.length,0);
});
test('missing assumptions retain shape and use engine defaults without being written',()=>{
  const p={assetItems:[]};const rows=A.resolve(p);assert.deepEqual(plain(rows.map(f=>f.value)),[7,6.5,3,3,2.5,3,4]);
  assert.deepEqual(plain(A.apply(p,A.draft(p)).plan),p);
  const d=A.draft(p);d.values.inflationPct=0;assert.deepEqual(plain(A.apply(p,d).plan),{assetItems:[],investing:{inflationPct:0}});
});
test('explicit zeros, null and blank imported values keep their calculation semantics',()=>{
  const p=plan();Object.assign(p.investing,{expectedInvestmentReturnPct:0,expectedSuperReturnPct:null,inflationPct:0,wageGrowthPct:'',safeWithdrawalRatePct:0});
  const rows=A.resolve(p);assert.equal(rows.find(f=>f.id==='super').value,0);assert.equal(rows.find(f=>f.id==='withdrawal').effective,4);
  const d=A.draft(p);d.values.inflationPct=1;const next=A.apply(p,d).plan;assert.equal(next.investing.expectedSuperReturnPct,null);assert.equal(next.investing.wageGrowthPct,'');assert.equal(next.investing.safeWithdrawalRatePct,0);
});
test('imported property aliases retain units and unrelated settings',()=>{
  const p=plan();p.assumptions={homeGrowthRate:0,propertyGrowthRate:.043,unrelated:'keep'};
  assert.equal(A.resolve(p).find(f=>f.id==='home').value,0);assert.equal(A.resolve(p).find(f=>f.id==='property').value,4.3);
  const d=A.draft(p);d.values.principalResidenceGrowthRatePct=2;d.values.investmentPropertyGrowthRatePct=5;
  const next=A.apply(p,d).plan;assert.equal(next.assumptions.homeGrowthRate,.02);assert.equal(next.assumptions.propertyGrowthRate,.05);assert.equal(next.assumptions.unrelated,'keep');assert.equal(next.investing.principalResidenceGrowthRatePct,undefined);
});
test('property precedence matches existing resolvers and ignores invalid below-minus-100 aliases',()=>{
  const p=plan();p.investing.propertyGrowthRatePct=0;p.assumptions={investmentPropertyGrowthRatePct:9};
  assert.equal(A.resolve(p).find(f=>f.id==='property').value,0);p.investing.investmentPropertyGrowthRatePct=-101;
  const d=A.draft(p);d.values.investmentPropertyGrowthRatePct=2;const next=A.apply(p,d).plan;
  assert.equal(next.investing.investmentPropertyGrowthRatePct,-101);assert.equal(next.investing.propertyGrowthRatePct,2);assert.equal(C.propertyGrowthRateForAsset(next),.02);
});
test('global return change preserves explicit investment returns, yields, identities and linked income',()=>{
  const p=plan(),d=A.draft(p);d.values.expectedInvestmentReturnPct=9;const next=A.apply(p,d).plan;
  assert.deepEqual(plain(next.assetItems),p.assetItems);assert.deepEqual(plain(next.incomeItems),p.incomeItems);
  assert.equal(C.calculatePlan(next).annualPassiveIncome,15000);
});
test('asset cash and reinvested income reconcile without duplicated linked dividends',()=>{
  for(const treatment of ['cash','reinvest']){
    const p=plan(),d=A.draft(p);Object.assign(d.assets.shares,{expectedTotalReturnPct:9,expectedIncomeYieldPct:4,incomeTreatment:treatment});
    const next=A.apply(p,d).plan,amounts=C.investmentReturnAmounts(next.assetItems[0]),r=C.calculatePlan(next);
    assert.equal(amounts.totalReturn,45000);assert.equal(amounts.taxableIncome,20000);assert.equal(amounts.retainedReturn+amounts.cashIncome,45000);assert.equal(r.annualPassiveIncome,treatment==='cash'?20000:0);
    assert.equal(next.incomeItems[1].amount,99999);
  }
});
test('use-plan-return copies a rate without disabling or duplicating income settings',()=>{
  const p=plan(),d=A.draft(p);d.assets.shares.expectedTotalReturnPct=d.values.expectedInvestmentReturnPct;const next=A.apply(p,d).plan;
  assert.equal(next.assetItems[0].expectedTotalReturnPct,7);assert.equal(next.assetItems[0].expectedIncomeYieldPct,3);assert.equal(next.assetItems[0].incomeTreatment,'cash');assert.equal(C.calculatePlan(next).annualPassiveIncome,15000);
});
test('property overrides remain until explicitly reset; reset inherits plan growth only',()=>{
  const p=plan(true),d=A.draft(p);d.values.investmentPropertyGrowthRatePct=6;let next=A.apply(p,d).plan;
  assert.equal(C.propertyGrowthRateForAsset(next,next.assetItems[2]),.04);
  d.resetProperties=['rental'];next=A.apply(p,d).plan;assert.equal(C.propertyGrowthRateForAsset(next,next.assetItems[2]),.06);
  assert.equal(next.assetItems[2].value,400000);assert.equal(next.assetItems[2].propertyGrowthRatePct,undefined);
});
test('restore defaults previews only effective plan fields and leaves overrides untouched',()=>{
  const p=plan(),d=A.draft(p);d.values.expectedSuperReturnPct=9;const preview=A.defaultsPreview(p,d);
  assert.ok(!preview.some(f=>f.key==='wageGrowthPct'));for(const change of preview)d.values[change.key]=change.to;
  const next=A.apply(p,d).plan;assert.deepEqual(plain(next.assetItems),p.assetItems);assert.equal(next.investing.expectedSuperReturnPct,6.5);
});
test('wage growth is read-only for legacy forecasts and effective with saved retirement timing',()=>{
  const p=plan(),d=A.draft(p);d.values.wageGrowthPct=4;assert.equal(A.apply(p,d).ok,false);
  const q=plan(true),e=A.draft(q);e.values.wageGrowthPct=4;const next=A.apply(q,e).plan;
  assert.notEqual(forecast(q).retirementProjection.years[2].household.netHouseholdCashIncome,forecast(next).retirementProjection.years[2].household.netHouseholdCashIncome);
});
test('saved retirement snapshots remain independent after changes to global assumptions',()=>{
  const p=plan(true),saved=plain(U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft),before=JSON.stringify(saved),d=A.draft(p);
  d.values.expectedSuperReturnPct=8;d.values.inflationPct=4;const next=A.apply(p,d).plan;
  const fresh=U.buildSemiRetirementScenarioDefaults(next,C.calculatePlan(next)).draft;assert.equal(fresh.people[0].superReturnBeforeRetirementPct,8);assert.equal(fresh.people[0].superReturnAfterRetirementPct,7);assert.equal(fresh.assumptions.inflationRatePct,4);assert.equal(JSON.stringify(saved),before);
});
test('every essential plan assumption reaches its existing calculation dependency',()=>{
  const p=plan(true),original=forecast(p);
  const cases=[['expectedSuperReturnPct',8,r=>r.superProjection.at(-1).closingBalance],['principalResidenceGrowthRatePct',5,r=>r.netWorthProjection.at(-1).closingBalance],['investmentPropertyGrowthRatePct',5,r=>r.netWorthProjection.at(-1).closingBalance],['inflationPct',4,r=>r.retirementProjection.years[5].household.applicableLifestyleSpending],['safeWithdrawalRatePct',5,r=>r.targetCapital]];
  // Test fallback property growth rather than an explicitly overridden asset.
  delete p.assetItems[2].propertyGrowthRatePct;
  for(const [key,value,read] of cases){const base=forecast(p),d=A.draft(p);d.values[key]=value;const next=A.apply(p,d);assert.equal(next.ok,true);assert.notEqual(read(base),read(forecast(next.plan)),key);}
  const legacy=plan();delete legacy.assetItems[0].investmentReturnMode;const d=A.draft(legacy);d.values.expectedInvestmentReturnPct=8;assert.notEqual(C.calculatePlan(legacy).investmentProjection[5].closingBalance,C.calculatePlan(A.apply(legacy,d).plan).investmentProjection[5].closingBalance);
  assert.ok(original.retirementProjection);
});
test('validation rejects invalid numbers, denominators and inconsistent investment income without mutation',()=>{
  const p=plan(),before=JSON.stringify(p);
  for(const value of [NaN,Infinity,'',-100]){const d=A.draft(p);d.values.inflationPct=value;assert.equal(A.apply(p,d).ok,false);}
  const d=A.draft(p);d.assets.shares.expectedTotalReturnPct=2;assert.equal(A.apply(p,d).ok,false);
  d.assets.shares.expectedTotalReturnPct=8;d.assets.shares.incomeTreatment='other';assert.equal(A.apply(p,d).ok,false);assert.equal(JSON.stringify(p),before);
});
test('JSON backup round trip preserves assumption overrides and unchanged results',()=>{
  const p=plan(true),d=A.draft(p);d.values.inflationPct=0;d.assets.shares.incomeTreatment='reinvest';const next=A.apply(p,d).plan,restored=plain(next);
  assert.equal(JSON.stringify(forecast(next)),JSON.stringify(forecast(restored)));assert.deepEqual(plain(A.draft(next)),plain(A.draft(restored)));
});
test('dollar basis remains display-only with zero and positive inflation',()=>{
  for(const inflation of [0,2.5]){const p=plan(true),d=A.draft(p);d.values.inflationPct=inflation;const next=A.apply(p,d).plan,result=forecast(next),before=JSON.stringify({next,result});const row=result.retirementProjection.years[5];
    const nominal=row.household.closingAccessibleInvestmentBalance;assert.equal(c.FFSDollarBasis.displayedValue(nominal,row.yearIndex,inflation,'today'),nominal/(1+inflation/100)**row.yearIndex);assert.equal(c.FFSDollarBasis.displayedValue(nominal,row.yearIndex,inflation,'future'),nominal);assert.equal(JSON.stringify({next,result}),before);
  }
});

test('home overrides stay read-only until used by the saved retirement forecast',()=>{
  const p=plan();p.assetItems[1].propertyGrowthRatePct=8;const property=A.properties(p).find(a=>a.id==='home');
  assert.equal(property.value,3);assert.equal(property.canReset,false);assert.match(property.note,/retirement projections \(8%\)/);
  const q=plan(true);q.assetItems[1].propertyGrowthRatePct=8;assert.equal(A.properties(q).find(a=>a.id==='home').value,8);assert.equal(A.properties(q).find(a=>a.id==='home').canReset,true);
});
