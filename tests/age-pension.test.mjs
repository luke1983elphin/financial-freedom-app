import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const context={console}; context.globalThis=context;
for(const file of ['calculator.js','agePensionEstimate.js','semiRetirementProjection.js','semiRetirementUi.js']) vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const P=context.FFSAgePension, E=context.FFSSemiRetirementProjection;
const estimate=overrides=>P.estimateAnnualPension({person1Age:67,homeowner:true,assessableAssets:0,assessableAnnualIncome:0,...overrides});
const baseline=JSON.parse(readFileSync(new URL('./fixtures/age-pension-off-baseline.json',import.meta.url),'utf8'));
test('strict complete output parity against unmodified PR base: 30 households, omitted and disabled',()=>{
 for(const {input,sha256} of baseline.cases) for(const explicit of [false,true]) {
 const copy=structuredClone(input); if(explicit) copy.scenario.agePension={enabled:false,incomeStreamSuper:true,unsupported:true};
 const result=E.projectRetirementScenario(copy);
 assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'),sha256);
 }
});
test('age boundary and single full rate',()=>{assert.equal(estimate({person1Age:66}).annualPension,0);assert.equal(estimate({}).annualPension,32180.2);});
test('couples and mixed-age use joint thresholds and per-eligible-person tapers',()=>{
 const one=estimate({partnered:true,person2Age:66,assessableAssets:599000});
 const two=estimate({partnered:true,person2Age:67,assessableAssets:599000});
 assert.equal(one.annualPension,20358); assert.equal(two.annualPension,40716);
 assert.equal(estimate({partnered:true,person2Age:67}).annualPension,48516);
 assert.equal(estimate({partnered:true,person2Age:66,assessableAnnualIncome:20296}).annualPension,21758);
});
test('asset and income tests select lower, zero entitlement and non-homeowner',()=>{
 assert.equal(estimate({assessableAssets:433000}).annualPension,24380.2);
 assert.equal(estimate({assessableAnnualIncome:15876}).annualPension,27180.2);
 assert.equal(estimate({assessableAssets:433000,assessableAnnualIncome:15876}).annualPension,24380.2);
 assert.equal(estimate({assessableAssets:2000000}).annualPension,0);
 assert.equal(estimate({assessableAnnualIncome:100000}).annualPension,0);
 assert.equal(estimate({homeowner:false,assessableAssets:600000}).annualPension,32180.2);
});
test('deeming uses verified tiers not investment return',()=>{
 assert.equal(P.deemedIncome(66800,false),1169); assert.equal(P.deemedIncome(166800,false),4919);
 assert.equal(P.deemedIncome(110600,true),1935.5); assert.equal(P.deemedIncome(210600,true),5685.5);
});

test('annual CPI compounds monetary rates and thresholds, leaving fixed policy parameters unchanged',()=>{
 const base=JSON.stringify(P.RATES), future=P.ratesForProjectionYear(2036,0.025);
 const cents=n=>Math.round(n*100)/100;
 for(const key of P.INDEXED_THRESHOLDS) assert.equal(future[key],cents(P.RATES[key]*1.025**10),key);
 for(const suffix of ['Single','CoupleEach']) for(const prefix of ['maximumAnnual','taxExemptAnnual']) {
   const energy=P.RATES['energyAnnual'+suffix];
   assert.equal(future[prefix+suffix],cents((P.RATES[prefix+suffix]-energy)*1.025**10+energy));
 }
 for(const key of ['deemingLowerRate','deemingUpperRate','incomeTaperSingle','incomeTaperCoupleEach','annualAssetTaperPerThousandSingle','annualAssetTaperPerThousandCoupleEach','energyAnnualSingle','energyAnnualCoupleEach','workBonusAnnual','pensionAge']) assert.equal(future[key],P.RATES[key],key);
 for(const [year,cpi] of [[2026,0.025],[2040,0],[2040,-0.02]]) for(const [key,value] of Object.entries(P.RATES)) assert.equal(P.ratesForProjectionYear(year,cpi)[key],value,key);
 assert.equal(JSON.stringify(P.RATES),base);
 assert.ok(Object.isFrozen(future));
 assert.throws(()=>P.ratesForProjectionYear(2030,NaN));
});

test('future means tests are recalculated, including new eligibility; pension is not merely multiplied',()=>{
 const future=P.ratesForProjectionYear(2027,0.10);
 // A $760,000 homeowner has no pension in 2026 but qualifies in 2027.
 const assets={person1Age:68,homeowner:true,assessableAssets:760000,assessableAnnualIncome:0};
 assert.equal(P.estimateAnnualPension(assets).annualPension,0);
 assert.equal(future.maximumAnnualSingle,35361.56);
 assert.equal(future.assetFreeAreaSingleHomeowner,366300);
 assert.equal(P.estimateAnnualPension(assets,future).annualPension,4652.96);
 const income={...assets,assessableAssets:0,assessableAnnualIncome:20000};
 assert.equal(future.incomeFreeAreaSingleAnnual,6463.60);
 assert.equal(P.estimateAnnualPension(income,future).annualPension,28593.36);
 assert.notEqual(P.estimateAnnualPension(income,future).annualPension,Math.round(P.estimateAnnualPension(income).annualPension*1.1*100)/100);
 assert.equal(P.deemedIncome(173480,false,future),5035.9);
});
const assessment=overrides=>P.assessProjectionYear({people:[{age:67,openingSuperBalance:100000,grossEmploymentIncome:0},{age:63,openingSuperBalance:800000,grossEmploymentIncome:0}],assets:[{id:'home',type:'home',openingValue:2000000}],liabilities:[],accessibleBalance:50000,...overrides});
test('younger accumulation super exempt; income stream and age 67 assessed',()=>{
 assert.equal(assessment({}).financialAssets,150000);
 assert.equal(assessment({incomeStreamSuper:true}).financialAssets,950000);
 assert.equal(assessment({people:[{age:67,openingSuperBalance:100000},{age:67,openingSuperBalance:800000}]}).financialAssets,950000);
});
test('home and mortgage excluded, offset still assessable, non-home property security deducted',()=>{
 assert.equal(assessment({liabilities:[{linkedAssetId:'home',openingBalance:400000}]}).assessableAssets,150000);
 assert.equal(assessment({assets:[{id:'rental',type:'investmentProperty',openingValue:500000}],liabilities:[{linkedAssetId:'rental',openingBalance:200000}]}).assessableAssets,450000);
});
test('missing inputs and complex circumstances do not fabricate entitlement',()=>{
 assert.equal(estimate({person1Age:undefined}).annualPension,null);
 assert.equal(estimate({hasComplexCentrelinkAssets:true}).unsupported,true);
 assert.equal(assessment({assets:[{type:'trust',openingValue:1000}]}).unsupported,true);
});
function input(balance=500000) {const i=structuredClone(baseline.cases.find(c=>c.input.people.length===1&&c.input.people[0].currentAge===67).input);i.inflationRate=0;i.accessibleInvestments={openingBalance:balance,annualReturnRate:0,annualFeesRate:0};i.people[0].openingSuperBalance=0;i.scenario.agePension={enabled:true};return i;}
test('pension enters cashflow once and reduces withdrawals after tax',()=>{
 const i=input(100000), on=E.projectRetirementScenario(i), off=E.projectRetirementScenario({...i,scenario:{...i.scenario,agePension:{enabled:false}}});
 assert.equal(on.validation.isValid,true);
 const a=on.years[0],b=off.years[0];
 assert.equal(a.people[0].totalCashIncomeBeforeTax-b.people[0].totalCashIncomeBeforeTax,a.household.estimatedAgePension);
 const net=a.household.netHouseholdCashIncome-b.household.netHouseholdCashIncome;
 assert.ok(net>0&&net<a.household.estimatedAgePension);
 assert.equal(Math.round((b.household.requiredTotalPortfolioWithdrawal-a.household.requiredTotalPortfolioWithdrawal)*100),Math.round(net*100));
 assert.ok(on.summary.totalInvestableAssetsAtEndAge>=off.summary.totalInvestableAssetsAtEndAge);
 assert.equal(on.summary.withoutAgePension.totalInvestableAssetsAtEndAge,off.summary.totalInvestableAssetsAtEndAge);
});
test('depletion reassessed annually and pension continues after private assets exhausted',()=>{
 const result=E.projectRetirementScenario(input(800000));
 assert.equal(result.years[0].household.estimatedAgePension,0);
 assert.ok(result.years.some(row=>row.household.estimatedAgePension>0));
 const empty=E.projectRetirementScenario(input(0));
 assert.ok(empty.years[0].household.estimatedAgePension>0);
 assert.ok(empty.years[0].household.unmetRequiredLifestyleSpending>0);
});

test('projection CPI drives future pension cash once, and spending shortfall milestones remain consistent',()=>{
 const i=input(0);i.inflationRate=0.025;
 i.household.fullRetirementLifestyleSpending=25000;
 const on=E.projectRetirementScenario(i),off=E.projectRetirementScenario({...i,scenario:{...i.scenario,agePension:{enabled:false}}});
 assert.equal(on.validation.isValid,true);
 assert.equal(off.summary.firstUnfundedSpendingYear,2026);
 assert.equal(on.summary.firstUnfundedSpendingYear,null);
 for(const [index,row] of on.years.entries()) {
   const pension=row.household.estimatedAgePension;
   assert.equal(row.household.agePension.rates.projectionYear,row.calendarYear);
   assert.equal(row.household.agePension.rates.annualIndexationRate,0.025);
   assert.equal(pension,Math.round(((32180.2-366.6)*1.025**index+366.6)*100)/100);
   assert.equal(Math.round((row.people[0].totalCashIncomeBeforeTax-off.years[index].people[0].totalCashIncomeBeforeTax)*100),Math.round(pension*100));
   assert.equal(row.household.unmetRequiredLifestyleSpending,0);
 }
 const costly=input(0);costly.inflationRate=0.025;costly.household.fullRetirementLifestyleSpending=28000;
 const shortfall=E.projectRetirementScenario(costly);
 assert.equal(shortfall.summary.firstUnfundedSpendingYear,2049);
 assert.equal(shortfall.summary.firstUnfundedSpendingYear,shortfall.years.find(y=>y.household.unmetRequiredLifestyleSpending>0).calendarYear);
 assert.equal(shortfall.summary.withoutAgePension.firstUnfundedYear,2026);
 assert.match(on.assumptions.agePension,/not a legislative forecast/);
 assert.match(on.assumptions.agePension,/SAPTO and pensioner Medicare concessions not modelled/);
});
test('downsizing released cash assessed in same year, replacement home exempt',()=>{
 const i=input(100000);i.scenario.downsizeHomeEvent={enabled:true,year:2026,currentHomeSaleValueToday:900000,replacementHomeValueToday:400000,saleCostRate:0,purchaseCostRate:0,allocation:'accessible-investments'};
 const result=E.projectRetirementScenario(i);assert.equal(result.validation.isValid,true);
 assert.equal(result.years[0].household.agePension.financialAssets,600000);
 assert.ok(result.years[0].household.estimatedAgePension<E.projectRetirementScenario(input(100000)).years[0].household.estimatedAgePension);
});
test('unsupported forecasts warn and add no cash',()=>{const i=input();i.scenario.agePension.unsupported=true;const r=E.projectRetirementScenario(i);assert.equal(r.years[0].household.estimatedAgePension,null);assert.ok(r.warnings.some(w=>w.includes('Age Pension not included')));});
test('panel placement, default off, native checkbox and annual output',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const down=app.indexOf('${semiRetirementDownsizeHomeEventHtml(draft)}');
 const panel=app.indexOf('<summary>Age Pension</summary>',down);
 assert.ok(panel>down&&panel<app.indexOf('<h4>Projection settings</h4>',down));
 assert.ok(app.includes('draft.scenario?.agePension?.enabled === true ? " checked" : ""'));
 assert.ok(app.includes('type === "checkbox" ? target.checked'));
 assert.ok(app.includes('Estimated Age Pension (before tax)'));
});
