import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load,household} from '../scripts/fi-cashflow-fixture.mjs';
import {fixture} from '../scripts/retirement-exhaustion-fixture.mjs';
const {CALC,ENGINE,UI}=load();
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function functions(names){return names.map(name=>{const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n  function ',start+5));}).join('\n');}
const ctx={window:{FFSSemiRetirementUi:UI},console,plan:household(CALC),calculatePlan:CALC.calculatePlan,
 money:n=>'$'+Number(n).toLocaleString('en-AU'),escapeHtml:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 savedScenarioComparisonAnchorId:'',savedScenarioComparisonTargetId:'',SCENARIO_OVERLAY:{isStale:()=>true},scenarioDisplayDate:()=> 'Today'};
vm.runInNewContext(functions(['semiRetirementMoney','semiRetirementAgeList','retirementOutcomeSections','retirementKeyResultSnapshot','savedRetirementOutcomeHtml','savedRetirementChangesHtml','scenarioChange','scenarioChangeText','changedInputsListHtml','keyResultRows','keyResultsListHtml','normaliseSavedScenarioType','savedScenarioTypeLabel','scenarioCardHtml','scenarioSnapshotRows','scenarioRowDisplayValue','scenarioComparisonRows']),ctx);
function outcome(change=()=>{}) {const input=fixture();change(input);const result=ENGINE.projectRetirementScenario(input);assert.equal(result.validation.isValid,true,JSON.stringify(result.validation));const view=UI.buildSemiRetirementResultsViewModel(result,input,{people:input.people});return {input,result,view,snapshot:ctx.retirementKeyResultSnapshot(view)};}
test('full retirement snapshot separates accessible, super and funding assets',()=>{
 const {snapshot,result}=outcome();const o=snapshot.retirementOutcome,h=result.years[0].household;
 assert.equal(o.accessibleAtRetirement,h.closingAccessibleInvestmentBalance);assert.equal(o.superAtRetirement,h.totalSuperBalance);assert.equal(o.fundingAssetsAtRetirement,o.accessibleAtRetirement+o.superAtRetirement);
});
test('accessible exhaustion uses canonical milestone',()=>{const {snapshot,result}=outcome();assert.equal(snapshot.retirementOutcome.accessibleExhaustion.calendarYear,result.summary.accessibleFundsExhaustedYear);});
test('super exhaustion reflects household super withdrawal and zero closing balance',()=>{assert.equal(outcome().snapshot.retirementOutcome.superExhaustion.calendarYear,2068);});
test('never exhausted values use actual horizon',()=>{
 const {snapshot}=outcome(i=>{i.people[0].openingSuperBalance=5e6;i.accessibleInvestments.openingBalance=5e6;i.projectionEndAge=87;});
 const html=ctx.savedRetirementOutcomeHtml(snapshot);assert.match(html,/Not exhausted by Example retiree age 87/);assert.doesNotMatch(html,/age 90/);
});
test('zero accessible at retirement is explicit instead of pretending it lasts',()=>{
 const {snapshot}=outcome(i=>{i.accessibleInvestments.openingBalance=0;i.accessibleInvestments.annualReturnRate=0;});
 assert.equal(snapshot.retirementOutcome.accessibleExhaustion.alreadyZero,true);assert.match(ctx.savedRetirementOutcomeHtml(snapshot),/Accessible investments already zero/);
});
test('inaccessible super is not reported exhausted merely because available funding exhausts',()=>{
 const {snapshot}=outcome(i=>{i.people[0].superAccessAge=95;i.accessibleInvestments.openingBalance=0;});
 assert.equal(snapshot.retirementOutcome.superExhaustion,null);assert.ok(snapshot.retirementOutcome.firstShortfall);assert.match(ctx.savedRetirementOutcomeHtml(snapshot),/subject to each person/);
});
test('capital equity is measured at horizon rather than earlier funding exhaustion',()=>{
 const {snapshot,result}=outcome();assert.equal(snapshot.retirementOutcome.capital.totalNetEquity,result.years.at(-1).assets[0].closingValue);assert.notEqual(snapshot.retirementOutcome.capital.totalNetEquity,result.summary.retainedAssets.totalNetEquity);
});
test('home equity never enters retirement funding assets',()=>{
 const a=outcome(),b=outcome(i=>i.assets[0].openingValue=9e9);assert.equal(a.snapshot.retirementOutcome.fundingAssetsAtRetirement,b.snapshot.retirementOutcome.fundingAssetsAtRetirement);
});
test('investment property retained without becoming accessible wealth',()=>{
 const a=outcome(),b=outcome(i=>i.assets[0].type='rentalInvestmentProperty');assert.equal(a.snapshot.retirementOutcome.accessibleAtRetirement,b.snapshot.retirementOutcome.accessibleAtRetirement);assert.equal(b.snapshot.retirementOutcome.capital.assets[0].type,'rentalInvestmentProperty');
});
test('canonical horizon calculation excludes zero-value rows',()=>{
 const {view}=outcome();view.annualRows.at(-1).assets.forEach(a=>a.closingValue=0);assert.equal(UI.buildSavedRetirementOutcome(view).capital.totalNetEquity,0);
});
test('downsizing horizon snapshot retains replacement home and separates released funding',()=>{
 const original=outcome();
 const {snapshot,result}=outcome(i=>{i.scenario.downsizeHomeEvent={enabled:true,year:2066,currentHomeSaleValueToday:1000000,replacementHomeValueToday:300000,saleCostRate:0,purchaseCostRate:0,allocation:'accessible-investments'};});
 const o=snapshot.retirementOutcome,expected=ENGINE.retainedAssetsAtYear(result.years.at(-1),false);
 assert.equal(o.capital.totalNetEquity,expected.totalNetEquity);assert.equal(o.capital.assets.length,1);assert.equal(o.capital.assets[0].name,'Replacement home');
 assert.ok(o.accessibleAtRetirement>original.snapshot.retirementOutcome.accessibleAtRetirement);
 assert.equal(o.fundingAssetsAtRetirement,o.accessibleAtRetirement+o.superAtRetirement);
});
test('zero ownership does not appear in horizon capital',()=>{
 const {snapshot}=outcome(i=>i.assets[0].ownershipPercent=0);assert.equal(snapshot.retirementOutcome.capital.assets.length,0);
});
test('unknown property debt is not falsely reported as equity',()=>{
 const {view}=outcome();view.annualRows.at(-1).liabilities=[{id:'x',type:'homeLoan',closingBalance:10000}];
 assert.equal(UI.buildSavedRetirementOutcome(view).capital.totalNetEquity,null);
});
test('shortfall and funded horizon labels are neutral and distinct',()=>{
 assert.match(ctx.savedRetirementOutcomeHtml(outcome().snapshot),/Retirement spending shortfall starts/);
 assert.match(ctx.savedRetirementOutcomeHtml(outcome(i=>i.people[0].openingSuperBalance=5e6).snapshot),/Retirement spending funded through/);
});
test('missing full-retirement row never uses ending balance as retirement balance',()=>{
 const {view}=outcome();view.keyResults.accessibleWhenBothFullyRetired.row=null;const snapshot=ctx.retirementKeyResultSnapshot(view);assert.equal(snapshot.retirementOutcome.fundingAssetsAtRetirement,null);assert.match(ctx.savedRetirementOutcomeHtml(snapshot),/Not reached within projection/);
});
test('one person semi retires and other remains employed is explicit',()=>{
 const {snapshot}=outcome();snapshot.retirementOutcome.people=[{name:'Luke',hasSemiRetirement:true,semiRetirementAge:50,fullRetirementAge:55},{name:'Lisa',hasSemiRetirement:false,fullRetirementAge:55}];
 const html=ctx.savedRetirementOutcomeHtml(snapshot);assert.match(html,/Luke age 50/);assert.match(html,/Lisa: Remains fully employed until age 55/);
});
test('different semi retirement ages are named separately',()=>{
 const {snapshot}=outcome();snapshot.retirementOutcome.people=[{name:'Luke',hasSemiRetirement:true,semiRetirementAge:50,fullRetirementAge:60},{name:'Lisa',hasSemiRetirement:true,semiRetirementAge:54,fullRetirementAge:60}];
 assert.match(ctx.savedRetirementOutcomeHtml(snapshot),/Luke age 50 \/ Lisa age 54/);
});
test('no semi-retirement event is invented',()=>{assert.doesNotMatch(ctx.savedRetirementOutcomeHtml(outcome().snapshot),/>Semi-retirement:/);});
test('new snapshot is compact JSON data without whole projection',()=>{const {snapshot}=outcome();assert.equal(snapshot.version,2);assert.ok(JSON.stringify(snapshot).length<15000);assert.equal(snapshot.retirementOutcome.years,undefined);});
test('saved outcomes remain identical after live plan changes',()=>{
 const {snapshot}=outcome();const before=ctx.savedRetirementOutcomeHtml(snapshot);ctx.plan.personal.fullRetirementAge=90;ctx.plan.assets.cash=9e9;assert.equal(ctx.savedRetirementOutcomeHtml(snapshot),before);
});
test('legacy snapshot keeps old rows and marks new information unavailable',()=>{
 const html=ctx.savedRetirementOutcomeHtml({rows:[{label:'Assets at full retirement',value:'$123'}]});assert.match(html,/\$123/);assert.match(html,/Older saved snapshot/);
});
test('missing legacy retirement outcome never falls back to financial plan calculations',()=>{
 const rows=ctx.scenarioSnapshotRows({scenarioType:'retirement',plan:ctx.plan});assert.equal(rows.length,0);
});
test('differences suppress unchanged and disabled semi settings',()=>{
 const a={people:[{id:'1',name:'Luke',hasSemiRetirement:false,semiRetirementAge:50,semiRetirementGrossIncome:20000,fullRetirementAge:52}]};
 const b=structuredClone(a);b.people[0].semiRetirementAge=55;assert.equal(UI.savedRetirementChanges(a,b).length,0);b.people[0].fullRetirementAge=60;const rows=UI.savedRetirementChanges(a,b);assert.equal(rows.length,1);assert.equal(rows[0].before,52);assert.equal(rows[0].after,60);
});
test('new semi retirement distinguishes unset from configured and preserves person identity',()=>{
 const a={people:[{id:'1',name:'Luke',hasSemiRetirement:false,semiRetirementAge:55}]};const b=structuredClone(a);b.people[0].hasSemiRetirement=true;
 const row=UI.savedRetirementChanges(a,b)[0];assert.equal(row.before,null);assert.equal(row.after,55);assert.match(row.label,/Luke semi-retirement/);
});
test('card ordering, arrows, escaping and shortened stale notice',()=>{
 const p=household(CALC);ctx.plan=p;const draft=UI.buildSemiRetirementScenarioDefaults(p,CALC.calculatePlan(p)).draft;draft.people[0].fullRetirementAge=70;
 const scenario={id:'s',scenarioType:'retirement',name:'<script>name</script>',scenarioInputSnapshot:draft,keyResultSnapshot:outcome().snapshot};
 const html=ctx.scenarioCardHtml(scenario);assert.ok(html.indexOf('Key outcome')<html.indexOf('What changed from your current plan'));assert.match(html,/→ Age 70/);assert.match(html,/Based on an earlier version/);assert.doesNotMatch(html,/<script>/);assert.match(html,/data-duplicate-scenario/);
});
test('retirement comparison contains expanded snapshot rows beyond old eight-row limit',()=>{
 const snapshot=outcome().snapshot,s={scenarioType:'retirement',keyResultSnapshot:snapshot};assert.match(ctx.scenarioComparisonRows(s,s),/Projection continues to/);
});
test('comparison preserves different horizons and funding statuses',()=>{
 const left={scenarioType:'retirement',keyResultSnapshot:outcome().snapshot};
 const right={scenarioType:'retirement',keyResultSnapshot:outcome(i=>{i.people[0].openingSuperBalance=5e6;i.projectionEndAge=87;}).snapshot};
 const html=ctx.scenarioComparisonRows(left,right);assert.match(html,/shortfall starts/);assert.match(html,/funded through/);assert.match(html,/age 87/);assert.match(html,/age 90/);
});
test('inactive additional super contribution stop ages do not clutter differences',()=>{
 const a={people:[{id:'1',hasSemiRetirement:false,existingAdditionalConcessionalContributions:0,additionalContributionsStopAge:60}]};
 const b=structuredClone(a);b.people[0].additionalContributionsStopAge=70;assert.equal(UI.savedRetirementChanges(a,b).length,0);
 b.people[0].existingAdditionalConcessionalContributions=1000;assert.ok(UI.savedRetirementChanges(a,b).some(row=>row.label.includes('stop age')));
});
test('new and legacy snapshots still compare their common saved balances',()=>{
 const legacy={scenarioType:'retirement',keyResultSnapshot:{rows:[{label:'Accessible investments at full retirement',value:'$123'},{label:'Super at full retirement',value:'$456'}]}};
 const fresh={scenarioType:'retirement',keyResultSnapshot:outcome().snapshot};
 for(const [a,b] of [[legacy,fresh],[fresh,legacy]]){const html=ctx.scenarioComparisonRows(a,b);assert.match(html,/\$123/);assert.match(html,/\$456/);assert.match(html,/Super at full retirement/);}
});
