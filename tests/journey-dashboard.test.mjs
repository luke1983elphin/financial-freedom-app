import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load} from '../scripts/fi-cashflow-fixture.mjs';
import {investmentReturnFixture} from '../scripts/investment-return-fixture.mjs';
const {CALC}=load();
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../journey-dashboard.js',import.meta.url),'utf8');
const functions=['freedomPercent','lifestyleTarget','estimatedCashflow','renderJourneyDashboard'].map(name=>{
 const start=source.indexOf('  function '+name+'(');assert.ok(start>=0);
 return source.slice(start,source.indexOf('\n  function ',start+5));
}).join('\n');
function setup(simple=false,ready=true){
 const p=investmentReturnFixture(simple),r=CALC.calculatePlan(p),nodes={};
 const document={body:{classList:{add(){}}},head:{append(){}},createElement:()=>({}),getElementById:id=>nodes[id],querySelector:()=>({classList:{add(){}},prepend:n=>nodes[n.id]=n})};
 const ctx={plan:p,document,URLSearchParams,semiRetirementScenarioDraft:{people:[]},journeyDashboardResult:null,
  personalisedResultsReadiness:()=>({readyForPersonalisedResults:ready}),
  escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money:n=>`$${n}`,plainPercent:n=>`${n}%`};
 ctx.window=ctx;ctx.location={search:'?dashboard=journey'};
 vm.runInNewContext(renderer+'\n'+functions,ctx);return {ctx,p,r,nodes};
}
test('query gate selects only explicit journey, preserving the default Dashboard',()=>{
 const {ctx}=setup();for(const value of ['', '?dashboard=other','?journey=true'])assert.equal(ctx.FFSJourneyDashboard.enabled(value),false);
 assert.equal(ctx.FFSJourneyDashboard.enabled('?x=1&dashboard=journey'),true);
 ctx.location.search='';ctx.renderJourneyDashboard({});assert.equal(ctx.journeyDashboardResult,null);
});
for(const single of [true,false])test(`${single?'single':'couple'} uses canonical results without mutating plan or any financial output`,()=>{
 const {ctx,p,r,nodes}=setup(single),before=JSON.stringify({p,r});ctx.renderJourneyDashboard(r);
 const html=nodes.journeyDashboard.innerHTML;
 for(const n of [r.currentNetWorth,r.accessibleFiAssets,r.finalProjectedCashSurplus,r.superProjection.find(row=>row.age===60).closingBalance])assert.ok(html.includes(`$${n}`),String(n));
 assert.ok(html.includes(`${ctx.freedomPercent(r)}%`));assert.ok(html.includes(`$${ctx.lifestyleTarget(r)}`));
 assert.ok(html.includes(`Age ${r.financialFreedomProgressProjection.at(-1).age}`));
 assert.match(html,single?/Super at age 60/:/Super when Person 1 is 60/);
 assert.equal(JSON.stringify({p,r}),before);
});
test('semi-retirement requires explicit enablement and uses existing scenario age, never legacy FI target age',()=>{
 const {ctx,r,nodes}=setup();ctx.semiRetirementScenarioDraft.people=[{name:'Alex',hasSemiRetirement:false,semiRetirementAge:55,fullRetirementAge:65}];
 ctx.renderJourneyDashboard(r);assert.doesNotMatch(nodes.journeyDashboard.innerHTML,/<h3>Semi-retirement/);
 ctx.semiRetirementScenarioDraft.people[0].hasSemiRetirement=true;ctx.renderJourneyDashboard(r);
 assert.match(nodes.journeyDashboard.innerHTML,/<h3>Semi-retirement[\s\S]*Alex: age 55/);
 assert.match(nodes.journeyDashboard.innerHTML,/Retirement Planning scenario setting/);
});
test('limited data shows setup state and never invented financial values',()=>{
 const {ctx,nodes}=setup(true,false);ctx.plan={personal:{}};ctx.renderJourneyDashboard({});
 assert.match(nodes.journeyDashboard.innerHTML,/Continue Setup/);assert.doesNotMatch(nodes.journeyDashboard.innerHTML,/NaN|undefined|Infinity|\$0/);
});
test('current super fallback applies when exact age 60 projection is unavailable',()=>{
 const {ctx,r,nodes}=setup();r.superProjection=[];ctx.renderJourneyDashboard(r);
 assert.match(nodes.journeyDashboard.innerHTML,/Current super/);assert.ok(nodes.journeyDashboard.innerHTML.includes(`$${r.superannuationBalance}`));
});
test('user names are escaped in milestone markup',()=>{
 const {ctx,r,nodes}=setup();ctx.plan.personal.person1Name='<img src=x onerror=alert(1)>';ctx.renderJourneyDashboard(r);
 assert.doesNotMatch(nodes.journeyDashboard.innerHTML,/<img/);assert.match(nodes.journeyDashboard.innerHTML,/&lt;img/);
});
test('experiment contains no calculation engine or persistence writes',()=>{
 assert.doesNotMatch(renderer,/calculatePlan|projectRetirementScenario|localStorage|sessionStorage|setItem/);
 const adapter=functions.slice(functions.indexOf('function renderJourneyDashboard'));
 assert.doesNotMatch(adapter,/calculatePlan|projectRetirementScenario|localStorage|setItem/);
});
