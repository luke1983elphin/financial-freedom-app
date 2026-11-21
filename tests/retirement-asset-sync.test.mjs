import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const c={console};c.globalThis=c;
for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js','dollar-basis.js']) vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const C=c.FFSCalculator,U=c.FFSSemiRetirementUi,E=c.FFSSemiRetirementProjection;
function plan(){const p=C.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:43,fullRetirementAge:65});p.assetItems=[{id:'property',name:'259 Bakers Beach Road',category:'otherProperty',value:300000,capitalGrowthRatePct:0,owner:'joint'}];return p;}
function defaults(p){return U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p),{newScenario:true});}
function extract(name){const a=source.indexOf('  function '+name+'(');assert.ok(a>=0,name);return source.slice(a,source.indexOf('\n  function ',a+5));}
function state(p){const base=defaults(p);const ctx={window:{FFSSemiRetirementUi:U,FFSSemiRetirementProjection:E},plan:p,
  semiRetirementScenarioDraft:clone(base.draft),semiRetirementScenarioInitialDraft:clone(base.draft),semiRetirementScenarioSourceKey:base.sourceKey,
  semiRetirementScenarioDirty:true,semiRetirementScenarioResult:{stale:true},semiRetirementScenarioInputs:{stale:true},semiRetirementScenarioResultDraft:{stale:true},
  semiRetirementComparisonScenarios:[],semiRetirementActiveComparisonId:'',cloneScenarioDraft:clone,clearSemiRetirementAdjustmentState(){}};
vm.runInNewContext(['ensureSemiRetirementScenarioDraft','runSemiRetirementComparisonForScenario','activeSemiRetirementComparisonScenario','syncLegacySemiRetirementComparisonState'].map(extract).join('\n'),ctx);return ctx;}
function project(d){const out=U.runSemiRetirementProjection(E,d);assert.equal(out.validation.isValid,true,JSON.stringify(out.validation));assert.equal(out.result.validation.isValid,true,JSON.stringify(out.result.validation));return out;}

for(const timing of [false,true])test(`dirty live draft refreshes assets and comparisons, preserving adjustments (timing=${timing})`,()=>{
 const p=plan();if(timing)U.saveRetirementTiming(p,defaults(p).draft.people);
 const s=state(p);s.semiRetirementScenarioDraft.scenario.agePension={enabled:false};
 s.semiRetirementScenarioDraft.household.fullRetirementLifestyleSpending=42000;
 s.semiRetirementScenarioDraft.scenario.oneOffIncomeEvents=[{id:'gift',description:'Gift',year:2030,amountTodayDollars:5000}];
 const saved={id:'saved',source:'saved',draft:clone(s.semiRetirementScenarioDraft)};
 const temp={id:'temp',source:'temporary',draft:clone(s.semiRetirementScenarioDraft)};
 s.semiRetirementComparisonScenarios=[saved,temp];const before=JSON.stringify(saved);
 Object.assign(p.assetItems[0],{name:'259 Eagle Point Road',capitalGrowthRatePct:3,owner:'person1',value:350000});
 p.liabilityItems=[{id:'loan',name:'Property loan',type:'rentalPropertyLoan',linkedAssetId:'property',balance:100000,interestRatePct:0,repayment:0,termYears:30,repaymentType:'interestOnly'}];
 s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));const d=s.semiRetirementScenarioDraft;
 assert.equal(d.assets[0].name,'259 Eagle Point Road');assert.equal(d.assets[0].openingValue,350000);assert.equal(d.assets[0].owner,'person1');assert.equal(d.assets[0].annualGrowthRatePct,3);
 assert.equal(d.liabilities[0].linkedAssetId,'property');assert.equal(d.household.fullRetirementLifestyleSpending,42000);assert.equal(d.scenario.agePension.enabled,false);assert.equal(d.scenario.oneOffIncomeEvents[0].id,'gift');
 assert.equal(s.semiRetirementScenarioResult,null);assert.equal(s.semiRetirementScenarioInputs,null);assert.equal(s.semiRetirementScenarioResultDraft,null);
 assert.equal(temp.draft.assets[0].name,'259 Eagle Point Road');assert.ok(temp.result);assert.equal(JSON.stringify(saved),before);
 const out=project(d),retained=E.retainedAssetsAtYear(out.result.years[0],false).assets[0];assert.equal(retained.linkedDebt,100000);assert.equal(retained.netEquity,260500);
 p.liabilityItems=[];s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));assert.equal(s.semiRetirementScenarioDraft.liabilities.length,0);
});

test('saved snapshots stay wholly historical, even if clean or an age is missing',()=>{
 const p=plan(),s=state(p);s.semiRetirementScenarioSourceKey='saved-scenario:historical';s.semiRetirementScenarioDirty=false;s.semiRetirementScenarioDraft.people[0].currentAge=0;
 const before=JSON.stringify(s.semiRetirementScenarioDraft);p.assetItems[0].name='New';p.personal.person1Age=60;
 s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));assert.equal(JSON.stringify(s.semiRetirementScenarioDraft),before);
 s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p),{force:true});assert.equal(s.semiRetirementScenarioDraft.assets[0].name,'New');assert.equal(s.semiRetirementScenarioDraft.people[0].currentAge,60);
});

test('2073 property valuation, retained equity, estate and saved report use refreshed inputs',()=>{
 const p=plan(),s=state(p);Object.assign(p.assetItems[0],{name:'259 Eagle Point Road',capitalGrowthRatePct:3});s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));
 const d=s.semiRetirementScenarioDraft;d.projectionStartYear=2026;d.projectionEndAge=90;d.scenario.agePension.enabled=false;
 const out=project(d),row=out.result.years.find(r=>r.calendarYear===2073);assert.ok(row);
 // Engine rows contain one completed year, including the 2026 row: 48 annual growth steps.
 let expected=300000;for(let n=0;n<48;n++)expected=Math.round(expected*1.03*100)/100;
 assert.ok(Math.abs(row.assets[0].closingValue-300000*1.03**48)<0.1);expected=row.assets[0].closingValue;
 const retained=E.retainedAssetsAtYear(row,false);assert.equal(retained.assets[0].name,'259 Eagle Point Road');assert.equal(retained.totalNetEquity,expected);assert.equal(retained.assets[0].status,'Owned outright');
 const view=U.buildSemiRetirementResultsViewModel(out.result,out.inputs,d),saved=U.buildSavedRetirementOutcome(view,out.result,out.inputs,d);
 assert.equal(saved.capital.assets[0].name,'259 Eagle Point Road');assert.equal(saved.capital.totalNetEquity,expected);
 const today=c.FFSDollarBasis.displayedValue(expected,47,2.5,'today');assert.ok(Math.abs(today-388406.38)<.02);
 assert.equal(Math.round(c.FFSDollarBasis.displayedValue(300000,47,2.5,'today')),93994);
 assert.equal(c.FFSDollarBasis.displayedValue(expected,47,2.5,'future'),expected);
 assert.equal(row.household.totalNetWorth,row.household.totalInvestableAssets+expected);
});

test('all supported property classes and explicit personal asset growth reach projection',()=>{
 for(const category of ['home','principalResidence','principal_residence','otherProperty','rentalInvestmentProperty','rentalProperty','investmentProperty','residentialInvestmentProperty','commercialInvestmentProperty','incomeProducingProperty','vehicle','personalUse']){
  const p=plan();p.assetItems=[{id:'asset',name:category,category,value:100000,capitalGrowthRatePct:category==='vehicle'?-10:3,owner:'joint'}];
  const d=defaults(p).draft;d.scenario.agePension.enabled=false;const out=project(d);
  assert.equal(d.assets[0].id,'asset',category);assert.equal(out.result.years[0].assets[0].closingValue,category==='vehicle'?90000:103000,category);
 }
});

test('rename, reordering, sale, removal and reclassification use IDs and never duplicate proceeds',()=>{
 const p=plan();p.assetItems=[{id:'car',name:'Same name',category:'vehicle',value:20000},{id:'boat',name:'Same name',category:'personalUse',value:15000}];
 const s=state(p),year=s.semiRetirementScenarioDraft.projectionStartYear+1;s.semiRetirementScenarioDraft.scenario.agePension.enabled=false;
 s.semiRetirementScenarioDraft.scenario.oneOffIncomeEvents=[{id:'sale',assetSaleId:'car',year,amountTodayDollars:18000}];
 p.assetItems.reverse();p.assetItems.find(a=>a.id==='car').name='Updated car';s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));
 const d=s.semiRetirementScenarioDraft,out=project(d),sale=out.result.years[1];assert.equal(sale.assets.some(a=>a.id==='car'),false);assert.equal(sale.assets.some(a=>a.id==='boat'),true);assert.equal(sale.household.oneOffIncomeEvents[0].description,'Sell Updated car');
 const incomeOnly=clone(d);delete incomeOnly.scenario.oneOffIncomeEvents[0].assetSaleId;incomeOnly.scenario.oneOffIncomeEvents[0].description='Income';
 const other=project(incomeOnly);assert.equal(sale.household.totalAccessibleAssets,other.result.years[1].household.totalAccessibleAssets);assert.equal(out.result.years[2].household.oneOffIncome,0);
 p.assetItems=p.assetItems.filter(a=>a.id!=='car');s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));assert.equal(s.semiRetirementScenarioDraft.assets.some(a=>a.id==='car'),false);
 const invalid=U.runSemiRetirementProjection(E,s.semiRetirementScenarioDraft);assert.equal(invalid.result.validation.isValid,false);
 p.assetItems[0].category='home';s.ensureSemiRetirementScenarioDraft(C.calculatePlan(p));assert.equal(s.semiRetirementScenarioDraft.assets[0].type,'home');
});
