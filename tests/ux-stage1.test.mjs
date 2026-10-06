import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {verify} from '../scripts/ux-stage1-parity.mjs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const extract=name=>{const start=source.indexOf('  function '+name+'(');assert.ok(start>=0);return source.slice(start,source.indexOf('\n  function ',start+5));};
const summaryTile=(label,value)=>`<dt>${label}</dt><dd>${value}</dd>`;
function renderer(values={}) {
  const ctx={summaryTile,semiRetirementScenarioResult:null,semiRetirementScenarioDraft:{},semiRetirementScenarioResultDraft:null,semiRetirementScenarioInputs:{},window:{},money:n=>`$${n}`,plainPercent:n=>`${n}%`,...values};
  vm.runInNewContext(['dashboardRetirementHtml','dashboardSimplifiedHtml','dashboardSnapshotHtml'].map(extract).join('\n'),ctx);
  return ctx;
}
test('five primary choices preserve all ten existing destination IDs',()=>{
  const nav=html.slice(html.indexOf('id="sideNav"'),html.indexOf('</nav>',html.indexOf('id="sideNav"')));
  assert.deepEqual([...nav.slice(0,nav.indexOf('<details')).matchAll(/data-view="(.*?)"/g)].map(m=>m[1]),['dashboard','setup','decision','semiretirement']);
  assert.match(nav,/<summary class="nav-more-toggle">More<\/summary>/);
  assert.deepEqual([...nav.slice(nav.indexOf('<details')).matchAll(/data-view="(.*?)"/g)].map(m=>m[1]),['investments','super','goals','weeklyplan','reports','scenarios']);
  for(const view of ['dashboard','setup','decision','semiretirement','investments','super','goals','weeklyplan','reports','scenarios']) assert.match(html,new RegExp(`data-view-panel="${view}"`));
});
test('dashboard hierarchy replaces only the AI card, retaining AI code and weekly mission access',()=>{
  const ctx=renderer({dashboardSnapshotHtml:()=>'',dashboardFutureYouHtml:()=>''});
  const output=ctx.dashboardSimplifiedHtml({},{readyState:{readyForPersonalisedResults:false}});
  assert.match(output,/data-view="decision">Try a change/);
  assert.match(output,/data-view="semiretirement">Explore retirement plan/);
  assert.doesNotMatch(output,/AI coaching|dashboard-ai-card/);
  assert.match(source,/function dashboardAiCoachHtml/);
  assert.match(html,/id="dashboardWeeklyMission"/);
  assert.match(extract('renderDashboardSimplified'),/dashboardMissionHtml/);
});
test('snapshot displays only supplied current values and offers financial details',()=>{
  const output=renderer().dashboardSnapshotHtml({currentNetWorth:123,accessibleFiAssets:45},{readyForPersonalisedResults:true},67,89,999);
  for(const value of ['$123','$45','67%','$89']) assert.ok(output.includes(value));
  assert.doesNotMatch(output,/999|Weekly Surplus/);
  assert.match(output,/data-dashboard-detail-open/);
});
test('retirement card omits unavailable ages instead of projecting new values',()=>{
  const output=renderer().dashboardRetirementHtml();
  assert.doesNotMatch(output,/<dt>|undefined|NaN/);
  assert.match(output,/Explore retirement plan/);
});
test('retirement card uses validated existing timing labels and respects elected work reduction',()=>{
  const timing={fullRetirementValue:'Alex: age 65',personalSemiRetirementValue:'Alex: age 55',hasElectedPersonalSemiRetirement:true};
  const ctx=renderer({semiRetirementScenarioResult:{},window:{FFSSemiRetirementUi:{buildSemiRetirementResultsViewModel:()=>({isAvailable:true,retirementTiming:timing})}}});
  assert.match(ctx.dashboardRetirementHtml(),/Alex: age 65/);assert.match(ctx.dashboardRetirementHtml(),/Alex: age 55/);
  timing.hasElectedPersonalSemiRetirement=false;assert.doesNotMatch(ctx.dashboardRetirementHtml(),/Alex: age 55/);
  assert.doesNotMatch(extract('dashboardRetirementHtml'),/calculatePlan|runSemiRetirementProjection|projectRetirementScenario|saveDraft/);
});
test('Future You keeps its age input and every existing output',()=>{
  for(const field of ['accessibleFiAssets','investmentPropertyEquity','totalFiWealth','principalResidenceEquity','netWorth','passiveIncome','progress']) assert.ok(extract('dashboardFutureMetricsHtml').includes('future.'+field));
  assert.match(extract('dashboardFutureYouHtml'),/data-dashboard-future-age/);
  assert.match(html,/id="customScenarioDetails"/);
});
test('exact parity for full results across nine deterministic financial fixtures',()=>{
  assert.equal(verify().numericalDifferences,0);
});
test('protected models, data, persistence and non-presentation app functions remain unchanged',()=>{
  const guard=JSON.parse(readFileSync(new URL('fixtures/ux-stage1-protected.json',import.meta.url)));
  const hash=s=>createHash('sha256').update(s).digest('hex');
  for(const [file,expected] of Object.entries(guard.files)) assert.equal(hash(readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('\r\n','\n')),expected,file);
  const normalised=source.replaceAll('\r\n','\n');
  const matches=[...normalised.matchAll(/^  (?:async )?function (\w+)\(/gm)];
  const actual=Object.fromEntries(matches.map((m,i)=>[m[1],hash(normalised.slice(m.index,matches[i+1]?.index??normalised.length).trim())]));
  for(const [name,expected] of Object.entries(guard.appFunctions)) assert.equal(actual[name],expected,name);
});
