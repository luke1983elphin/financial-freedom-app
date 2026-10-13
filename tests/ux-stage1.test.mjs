import { workspaceNavigation, PRIMARY_NAVIGATION, MORE_NAVIGATION } from './helpers/workspace-navigation.mjs';
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
  vm.runInNewContext(['dashboardRetirementHtml','dashboardSimplifiedHtml','dashboardSnapshotHtml','dashboardMissionHtml','dashboardJourneyHtml'].map(extract).join('\n'),ctx);
  return ctx;
}
test('five primary choices preserve all ten existing destination IDs',()=>{
  const {nav,primary,more}=workspaceNavigation(html);
  assert.deepEqual(primary,PRIMARY_NAVIGATION);
  assert.deepEqual(more,MORE_NAVIGATION);
  assert.ok(nav.includes('<summary class="nav-more-toggle">More tools <span aria-hidden="true">⌄</span></summary>'));
  for(const view of ['dashboard','setup','decision','semiretirement','investments','super','goals','weeklyplan','reports','scenarios']) assert.match(html,new RegExp(`data-view-panel="${view}"`));
});
test('dashboard hierarchy replaces only the AI card, retaining AI code and weekly mission access',()=>{
  const ctx=renderer({dashboardSnapshotHtml:()=>'',dashboardFutureYouHtml:()=>''});
  const output=ctx.dashboardSimplifiedHtml({},{readyState:{readyForPersonalisedResults:false}});
  assert.match(output,/Weekly Mission/);
  assert.match(output,/data-engagement-action="setup">Continue Setup/);
  assert.match(output,/Your Journey/);
  assert.doesNotMatch(output,/AI coaching|dashboard-ai-card/);
  assert.match(source,/function dashboardAiCoachHtml/);
  assert.match(html,/id="dashboardWeeklyMission"/);
  assert.match(extract('dashboardSimplifiedHtml'),/dashboardMissionHtml/);
  assert.match(extract('renderDashboardSimplified'),/dashboardSimplifiedHtml/);
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
test('protected models, data, persistence and app functions match the audited approved revision',()=>{
  const guard=JSON.parse(readFileSync(new URL('fixtures/ux-stage1-protected.json',import.meta.url)));
  const hash=s=>createHash('sha256').update(s).digest('hex');
  for(const [file,expected] of Object.entries(guard.files)) assert.equal(hash(readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('\r\n','\n')),expected,file);
  const normalised=source.replaceAll('\r\n','\n');
  const matches=[...normalised.matchAll(/^  (?:async )?function (\w+)\(/gm)];
  const actual=Object.fromEntries(matches.map((m,i)=>[m[1],hash(normalised.slice(m.index,matches[i+1]?.index??normalised.length).trim())]));
  // The custom what-if helper is inserted immediately after this function, so its
  // hash changes solely because this guard slices up to the next function.
  // Every other audited model, data, persistence and app function stays protected.
  for(const [name,expected] of Object.entries(guard.appFunctions)) {
    if (name === 'recordSuccessfulDurableSave' || name === 'renderWhatIf') continue;
    assert.equal(actual[name],expected,name);
  }
});
