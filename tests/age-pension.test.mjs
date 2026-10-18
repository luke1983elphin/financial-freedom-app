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

test('official free-area and taper boundaries for every supported household/home category',()=>{
 for(const partnered of [false,true]) for(const homeowner of [false,true]) {
  const assets=partnered?(homeowner?499000:766000):(homeowner?333000:600000);
  const income=partnered?10296:5876;
  const options={partnered,homeowner,...(partnered?{person2Age:67}:{})};
  const maximum=partnered?48516:32180.2;
  assert.equal(estimate({...options,assessableAssets:assets,assessableAnnualIncome:income}).annualPension,maximum);
  assert.equal(estimate({...options,assessableAssets:assets+1000}).annualPension,Math.round((maximum-78)*100)/100);
  assert.equal(estimate({...options,assessableAnnualIncome:income+26}).annualPension,Math.round((maximum-13)*100)/100);
 }
 assert.equal(P.deemedIncome(66801,false),1169.04);
 assert.equal(P.deemedIncome(110601,true),1935.54);
 assert.equal(P.RATES.taxExemptAnnualSingle,1861.6);
 assert.equal(P.RATES.taxExemptAnnualCoupleEach,1346.8);
 assert.equal(P.RATES.workBonusAnnual,7800);
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
 assert.equal(Math.round(net*100),Math.round((a.household.estimatedAgePension-(a.people[0].medicareLevy-b.people[0].medicareLevy))*100));
 assert.equal(a.people[0].incomeTax,0);
 assert.ok(a.people[0].sapto.applied>0);
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
 assert.equal(shortfall.summary.firstUnfundedSpendingYear,null);
 const noSapto=E.projectRetirementScenario({...costly,scenario:{...costly.scenario,agePension:{enabled:true,excludeSapto:true}}});
 assert.equal(noSapto.summary.firstUnfundedSpendingYear,2049);
 assert.equal(shortfall.summary.firstUnfundedSpendingYear,shortfall.years.find(y=>y.household.unmetRequiredLifestyleSpending>0)?.calendarYear ?? null);
 assert.equal(shortfall.summary.withoutAgePension.firstUnfundedYear,2026);
 assert.match(on.assumptions.agePension,/not a legislative forecast/);
 assert.match(on.assumptions.agePension,/Pensioner Medicare concessions remain unmodelled/);
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

const senior=(income,extra={})=>({eligible:true,taxableIncome:income,...extra});
test('SAPTO thresholds follow enacted tax-year formulas, including 2027 lower bracket and second formula',()=>{
 assert.equal(P.saptoThreshold(1602,'2026-27'),31847);
 assert.equal(P.saptoThreshold(2230,'2026-27'),36034);
 assert.equal(P.saptoThreshold(1602,'2035-36'),32822);
 assert.equal(P.saptoThreshold(2230,'2035-36'),37137);
});
test('2035 couple regression: $25,258 taxable income has no income tax after SAPTO',()=>{
 const rows=P.estimateSapto([senior(25258),senior(25258)],'2035-36');
 for(const r of rows){assert.equal(r.incomeTaxBeforeSapto,288.12);assert.equal(r.applied,288.12);assert.equal(r.incomeTax,0);assert.equal(r.entitlement,1602);assert.equal(r.transferredBaseReceived,0);}
 assert.equal(25258+1613-rows[0].incomeTax,26871);
});
test('SAPTO taper, cutoff and non-refundable cap use rebate income not pension or taxable income alone',()=>{
 assert.equal(P.estimateSapto([senior(37034)],'2026-27')[0].entitlement,2105);
 assert.equal(P.estimateSapto([senior(53874)],'2026-27')[0].entitlement,0);
 assert.equal(P.estimateSapto([senior(10000)],'2026-27')[0].applied,0);
 const r=P.estimateSapto([senior(25000,{reportableSuperContributions:10000,netInvestmentLoss:5000,adjustedFringeBenefits:1000})],'2026-27')[0];
 assert.equal(r.rebateIncome,41000);assert.equal(r.entitlement,1609.25);
 const mixed=P.estimateSapto([senior(25000),senior(70000,{eligible:false})],'2026-27');
 assert.equal(mixed[0].eligible,false);assert.equal(mixed[0].applied,0);
});
test('spouse transfers use statutory $6000/15% formula and recalculate recipient threshold',()=>{
 const rows=P.estimateSapto([senior(10000),senior(40000)],'2026-27');
 assert.equal(rows[0].transferredBaseGiven,1002);assert.equal(rows[1].transferredBaseReceived,1002);
 assert.equal(rows[1].rebateThreshold,37727);assert.equal(rows[1].entitlement,2319.88);
 assert.equal(rows[0].incomeTax,0);
 const noTransfer=P.estimateSapto([senior(18000),senior(40000)],'2026-27');
 assert.equal(noTransfer[1].transferredBaseReceived,0);
 const younger=P.estimateSapto([senior(0,{eligible:false}),senior(40000)],'2026-27');
 assert.equal(younger[1].transferredBaseReceived,0);
 assert.equal(P.estimateSapto([senior(6000),senior(40000)],'2026-27')[1].transferredBaseReceived,1602);
 assert.equal(P.estimateSapto([senior(10000),senior(30000)],'2026-27')[1].transferredBaseReceived,0);
});
test('SAPTO improves funding exactly once without changing gross pension, taxable income, levy or loan repayment',()=>{
 const i=input(0);i.projectionStartYear=2035;i.people[0].currentAge=73;i.people[0].fullRetirementAge=73;i.people[0].semiRetirementAge=73;
 const on=E.projectRetirementScenario(i);const excluded=structuredClone(i);excluded.scenario.agePension.excludeSapto=true;
 const off=E.projectRetirementScenario(excluded);const a=on.years[0].people[0],b=off.years[0].people[0];
 assert.ok(a.sapto.applied>0);assert.equal(b.sapto.applied,0);
 for(const field of ['estimatedAgePension','totalTaxableIncome','totalCashIncomeBeforeTax','medicareLevy','medicareLevySurcharge','stslRepayment'])assert.equal(a[field],b[field],field);
 assert.equal(Math.round((a.netEmploymentIncome-b.netEmploymentIncome)*100),Math.round(a.sapto.applied*100));
 assert.equal(Math.round((off.years[0].household.unmetRequiredLifestyleSpending-on.years[0].household.unmetRequiredLifestyleSpending)*100),Math.round(a.sapto.applied*100));
});
