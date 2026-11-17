import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture} from '../scripts/retirement-exhaustion-fixture.mjs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=name=>{const a=source.indexOf('  function '+name+'(');assert.ok(a>=0,name);return source.slice(a,source.indexOf('\n  function ',a+5));};
function context(basis='future'){
 const c={console};c.window=c;c.globalThis=c;
 for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js','dollar-basis.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
 Object.assign(c,{forecastDollarBasis:basis,semiRetirementScenarioInputs:{},semiRetirementMoney:n=>n==null?'Not available':`$${Math.round(n)}`,money:n=>`$${Math.round(n)}`,escapeHtml:s=>String(s??''),
 semiRetirementMilestoneAgesFromRow:()=>[],semiRetirementAgeList:()=>'',milestoneAgesFromObject:()=>[],comparisonHouseholdMilestone:()=>'',
 loadRetirementScenarioSnapshot:()=>{},currentRetirementComparisonScenario:()=>({}),semiRetirementScenarioSourceKey:'current',renderSemiRetirementComparisonHtml:()=>'',
 semiRetirementComparisonBreakdownRows:()=>['Available super continues funding spending where required.'],semiRetirementComparisonDifferences:()=>[],
 renderSemiRetirementComparisonControls:()=>'<p>1 planned extra concessional contribution event are included in this comparison. planned extra concessional contribution events are included in this comparison. Edit schedules.</p>',
 renderSemiRetirementComparisonPrintReport:()=>'',reportPresentationHtml:()=>'<h1>Financial Freedom Report</h1>',semiRetirementBreakdownRow:(a,b,n)=>`${a}: ${b}. ${n}`,usePortraitRetirementReport:()=>false});
 vm.runInNewContext(['semiRetirementComparisonSummary','semiRetirementComparisonDelta','semiRetirementComparisonMetricDefinitions','retirementScenarioSummary','retirementComparisonContext','installReportingPresentation'].map(extract).join('\n'),c);c.installReportingPresentation();return c;
}
function project(c,mutate=()=>{}){const inputs=fixture();mutate(inputs);const result=c.FFSSemiRetirementProjection.projectRetirementScenario(inputs);assert.equal(result.validation.isValid,true);const view=c.FFSSemiRetirementUi.buildSemiRetirementResultsViewModel(result,inputs,{});return {inputs,result,view};}
test('canonical non-super depletion, total asset exhaustion and required-cashflow shortfall stay separate',()=>{
 const c=context(),{inputs,result,view}=project(c,i=>{i.accessibleInvestments.annualReturnRate=0;i.people[0].superReturnAfterRetirement=0;});const before=JSON.stringify(result),s=c.semiRetirementComparisonSummary(view,inputs);
 assert.equal(s.accessibleExhaustionYear,result.summary.accessibleFundsExhausted.calendarYear);
 assert.equal(s.allFundsExhaustionYear,result.summary.allRetirementFundsExhausted.calendarYear);
 assert.equal(s.firstShortfallYear,result.summary.firstUnfundedSpending.calendarYear);
 assert.ok(s.accessibleExhaustionYear<s.firstShortfallYear);
 assert.ok(result.years.some(r=>r.calendarYear>=s.accessibleExhaustionYear&&r.household.totalSuperWithdrawal>0&&r.household.unmetSpending===0));
 assert.ok(s.projectionEndPropertyEquity>0);assert.match(s.retirementFundingStatus,/First funding shortfall/);assert.equal(JSON.stringify(result),before);
});
test('later income replenishment does not erase or imply permanent first depletion',()=>{
 const c=context(),{inputs,result,view}=project(c,i=>{i.scenario.oneOffIncomeEvents=[{id:'later',year:2070,amountTodayDollars:300000,description:'Fictional inflow'}];i.scenario.surplusDestination='accessible-investments';});
 const s=c.semiRetirementComparisonSummary(view,inputs);assert.equal(s.accessibleExhaustionYear,result.summary.accessibleFundsExhausted.calendarYear);
 assert.ok(result.years.some(r=>r.calendarYear>s.accessibleExhaustionYear&&r.household.closingAccessibleInvestmentBalance>0));
 assert.match(c.semiRetirementComparisonBreakdownRows('accessibleLast',{viewModel:view,summary:s}).join(''),/Later inflows may replenish/);
 assert.equal(c.semiRetirementComparisonMetricDefinitions().find(m=>m.key==='accessibleLast').label,'First non-super investment depletion');
});
test('end balances use canonical end year and scenario inflation in both dollar bases',()=>{
 for(const basis of ['future','today']){const c=context(basis),{inputs,view}=project(c,i=>{i.inflationRate=.05;i.people[0].openingSuperBalance=3000000;});const s=c.semiRetirementComparisonSummary(view,inputs);const end=view.annualRows.at(-1);const expected=c.FFSDollarBasis.displayedValue(end.household.totalPropertyEquity,end.yearIndex??end.calendarYear-inputs.projectionStartYear,5,basis);
 assert.equal(s.projectionEndPropertyEquity,expected);assert.match(s.retirementFundingStatus,new RegExp(`Funded through forecast end \\(${end.calendarYear}\\)`));assert.equal(s.firstShortfallYear,null);}
});
test('pathways handle individual years, no phase, retired and missing legacy timing',()=>{
 const c=context();const scenario={draft:{people:[{id:'a',name:'Alex',hasSemiRetirement:true,semiRetirementAge:60,fullRetirementAge:65},{id:'b',name:'Jordan',hasSemiRetirement:false,fullRetirementAge:65}]},viewModel:{annualRows:[{calendarYear:2043,people:[{id:'a',age:60}]},{calendarYear:2048,people:[{id:'a',age:65}]},{calendarYear:2050,people:[{id:'b',age:65}]}]}};
 assert.match(c.retirementScenarioSummary(scenario),/Alex reduces work at 60 \(2043\) and retires at 65 \(2048\).*Jordan retires at 65 \(2050\)/);
 assert.match(c.retirementScenarioSummary({draft:{people:[{name:'Lee',alreadyRetired:true}]}}),/Lee is already retired/);
 assert.match(c.retirementScenarioSummary({scenarioInputSnapshot:{people:[{name:'Legacy',hasSemiRetirement:true}]}}),/timing unavailable/);
 assert.doesNotMatch(c.retirementScenarioSummary({draft:{people:[{name:'Legacy'}]}}),/undefined|null|at 0/);
});
test('current-plan report scope and contribution inclusion are explicit without duplication',()=>{
 const c=context();assert.match(c.reportPresentationHtml({investmentProjection:[{year:30}]},'Date'),/Current Financial Plan Report/);assert.match(c.reportPresentationHtml({investmentProjection:[{year:30}]},'Date'),/30 years/);
 const html=c.renderSemiRetirementComparisonControls();assert.equal((html.match(/included in this comparison/g)||[]).length,1);assert.match(html,/Eligibility and contribution limits still apply/);
});
