import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {gzipSync, gunzipSync} from 'node:zlib';
import {investmentReturnFixture} from './investment-return-fixture.mjs';

export function capture() {
  const c={console, structuredClone}; c.globalThis=c; c.window=c;
  c.Date=class extends Date {constructor(...args){super(...(args.length?args:['2026-10-06T00:00:00Z']));} static now(){return Date.parse('2026-10-06T00:00:00Z');}};
  for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js','v2-data.js']) vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
  const plans=[...c.FFS_DATA.samplePlans.map(s=>({name:s.id,plan:s.plan})), ...[true,false].map(single=>({name:single?'single':'couple-property-offset',plan:investmentReturnFixture(single)}))];
  return plans.map(({name,plan})=>{
    const calculation=c.FFSCalculator.calculatePlan(plan);
    const {draft}=c.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(plan,calculation);
    const retirement=c.FFSSemiRetirementUi.runSemiRetirementProjection(c.FFSSemiRetirementProjection,draft);
    const changed=structuredClone(draft);
    changed.people.forEach(p=>{p.fullRetirementAge=Math.max(p.currentAge+1,p.fullRetirementAge-2);});
    const scenario=c.FFSSemiRetirementUi.runSemiRetirementProjection(c.FFSSemiRetirementProjection,changed);
    const records=JSON.parse(JSON.stringify({calculation,draft,retirement,scenario}));
    return {name,records};
  });
}
export function verify() {
  const before=JSON.parse(gunzipSync(readFileSync(new URL('../tests/fixtures/ux-stage1-before.json.gz',import.meta.url))).toString());
  const after=capture();
  assert.deepEqual(after,before,'Every output must match exactly, with no numerical tolerance');
  return {fixtures:after.length,numericalDifferences:0,sha256:createHash('sha256').update(JSON.stringify(after)).digest('hex')};
}
if(process.argv.includes('--capture')) {
  writeFileSync(new URL('../tests/fixtures/ux-stage1-before.json.gz',import.meta.url),gzipSync(JSON.stringify(capture())));
  console.log('Captured complete calculator, retirement and earlier-retirement scenario outputs before UI edits.');
} else if(process.argv[1]?.endsWith('ux-stage1-parity.mjs')) console.log(JSON.stringify(verify()));
