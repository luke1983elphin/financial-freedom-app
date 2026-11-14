// Independently review F04 deltas; --apply updates only verified expectations.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import vm from 'node:vm';
import {capture} from './ux-stage1-parity.mjs';
const baseline='0e9a6a4c007e47dc83f2ece7832b986755cb597d';
const read=f=>readFileSync(new URL('../'+f,import.meta.url));
const old=f=>execFileSync('git',['show',baseline+':'+f],{maxBuffer:20e6});
const hash=x=>createHash('sha256').update(x).digest('hex');
const round=x=>Math.round(x*100)/100;
const plain=x=>JSON.parse(JSON.stringify(x));
function load(previous=false,date='2026-09-29T00:00:00Z'){
 const c={console,structuredClone};c.globalThis=c;c.Date=class extends Date{constructor(...a){super(...(a.length?a:[date]));}static now(){return Date.parse(date);}};
 for(const f of ['calculator.js','agePensionEstimate.js','semiRetirementProjection.js','semiRetirementUi.js','dollar-basis.js']) vm.runInNewContext((previous?old(f):read(f)).toString(),c);return c;
}
const previous=load(true),next=load();
// Independently interpret active, first-ID-wins rental liabilities. Ordinary
// monthly P&I uses an explicit cents ledger; IO uses its declared annual extra
// principal convention. No production amortisation/projection helper is called.
function rentalDebt(plan,years){
 const seen=new Set();let sum=0;
 const propertyIds=new Set((plan.assetItems||[]).filter(a=>a.active!==false&&a.deleted!==true&&['otherProperty','rentalInvestmentProperty','rentalProperty','investmentProperty','residentialInvestmentProperty','commercialInvestmentProperty','incomeProducingProperty'].includes(a.category||a.type)).map(a=>a.id));
 for(const [i,item] of (plan.liabilityItems||[]).entries()){
  if(item.active===false||item.isActive===false||item.deleted===true||item.isDeleted===true||item.deletedAt||['inactive','deleted'].includes(item.status))continue;
  const id=String(item.id||`legacy-loan-${i}`);if(seen.has(id))continue;seen.add(id);
  const type=item.type||item.category;
  if(type!=='rentalPropertyLoan'&&!(propertyIds.has(item.linkedAssetId||item.investmentLink?.linkedAssetId)&&['investmentLoan','shareInvestmentLoan','managedFundLoan'].includes(type)))continue;
  let b=Number(item.balance??item.currentBalance)||0;
  const factors={weekly:52,fortnightly:26,monthly:12,quarterly:4,annually:1,yearly:1};
  const annual=(Number(item.repayment??item.repaymentAmount)||0)*(factors[item.repaymentFrequency||'monthly']||1);
  const extra=(Number(item.additionalPrincipalRepayment)||0)*(factors[item.additionalPrincipalFrequency||'annually']||1);
  const rate=(Number(item.interestRatePct??item.interestRate)||0)/1200,offset=Number(item.offsetBalance)||0;
  for(let y=0;y<years&&b>0;y++){
   if(item.repaymentType!=='interestOnly')for(let m=0;m<12&&b>0;m++){
    const interest=round(Math.max(0,b-offset)*rate),payment=round(annual/12);b=round(Math.max(0,b+interest-Math.min(payment,b+interest)));
   }
   b=round(Math.max(0,b-Math.min(b,extra)));
  }
  sum+=b;
 }
 return round(sum);
}
function diff(a,b,path='',out=[]){if(Object.is(a,b))return out;if(a&&b&&typeof a==='object'&&typeof b==='object')for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path+'/'+k,out);else out.push({path,before:a,after:b});return out;}
function proveCalculation(before,after){
 const expected=structuredClone(before);for(const row of expected.netWorthProjection)row.closingBalance=round(row.closingBalance-rentalDebt(before.plan,row.year));
 assert.deepEqual(after,expected,'Only independently scheduled property debt may change the sampled legacy calculation');
 for(const row of after.netWorthProjection){const debt=next.FFSCalculator.projectedDebtAtYear(after,row.year);assert.ok(Number.isFinite(debt));}
}
// Preserve the exact F08 baseline and independently validate all changed full rows.
const beforeBytes=read('tests/fixtures/ux-stage1-before.pre-f04.json.gz');assert.equal(hash(beforeBytes),hash(old('tests/fixtures/ux-stage1-before.json.gz')));
const before=JSON.parse(gunzipSync(beforeBytes)),after=capture(),golden=[];
for(let i=0;i<before.length;i++){
 assert.equal(before[i].name,after[i].name);proveCalculation(before[i].records.calculation,after[i].records.calculation);
 for(const key of ['draft','retirement','scenario'])assert.deepEqual(after[i].records[key],before[i].records[key],`F04 must preserve F08 ${key}`);
 const differences=diff(before[i],after[i]);golden.push({name:before[i].name,changedFields:differences.length,differences});
}
if(process.argv.includes('--apply'))writeFileSync(new URL('../tests/fixtures/ux-stage1-before.json.gz',import.meta.url),gzipSync(JSON.stringify(after)));
// The two configured-investment hashes also contain the legacy net-worth rows.
const investmentDeltas=[];
function investmentCapture(c,plan){const calc=c.FFSCalculator.calculatePlan(plan),{draft}=c.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(plan,calc);draft.scenario.workingPhaseSurplusDestination='accessible-investments';return plain({calc,draft,retirement:c.FFSSemiRetirementUi.runSemiRetirementProjection(c.FFSSemiRetirementProjection,draft)});}
for(const fixtureFile of ['investment-ux-parity','investment-return-legacy']){
 const bytes=read(`tests/fixtures/${fixtureFile}.pre-f04.json`);assert.equal(hash(bytes),hash(old(`tests/fixtures/${fixtureFile}.json`)));
 const updated=[];
 for(const f of JSON.parse(bytes)){const a=investmentCapture(previous,f.plan),b=investmentCapture(next,f.plan);assert.equal(hash(JSON.stringify(a)),f.sha256);proveCalculation(a.calc,b.calc);assert.deepEqual(a.draft,b.draft);assert.deepEqual(a.retirement,b.retirement);
  const sha256=hash(JSON.stringify(b));updated.push({...f,sha256});investmentDeltas.push({fixtureFile,name:f.name,previousSha256:f.sha256,correctedSha256:sha256,differences:diff(a,b)});}
 if(process.argv.includes('--apply'))writeFileSync(new URL(`../tests/fixtures/${fixtureFile}.json`,import.meta.url),JSON.stringify(updated,null,2)+'\n');
}
// Original 48 synthetic audit inputs stay at their existing immutable revision.
const audit=JSON.parse(execFileSync('git',['show','56a3eb336f4cde204f158c4d471a849e814bbfe8:docs/audit-2026-11-13/household-results.json'],{encoding:'utf8',maxBuffer:20e6}));
function run(c,{id,input:p}){if(id==='H25')return c.FFSCalculator.amortiseLoan(p);if(id==='H37')return c.FFSAgePension.assessProjectionYear(p);if(id==='H44')return c.FFSCalculator.investmentReturnValidation(p);if(id==='H48')return c.FFSAgePension.estimateSapto(p.people,p.financialYear);if(Object.hasOwn(p,'partnered'))return c.FFSAgePension.estimateAnnualPension(p);if(p.people)return c.FFSSemiRetirementProjection.projectRetirementScenario(p);return c.FFSCalculator.calculatePlan(p);}
const households=audit.results.map(f=>{const a=plain(run(previous,f)),b=plain(run(next,f));if(a.netWorthProjection)proveCalculation(a,b);else assert.deepEqual(a,b);return {id:f.id,changedFields:diff(a,b).length,differences:diff(a,b)};});
// Reconcile raw baseline source as well as prior recorded guard expectations.
function functionHashes(source){const text=source.toString().replaceAll('\r\n','\n'),m=[...text.matchAll(/^  (?:async )?function (\w+)\(/gm)];return Object.fromEntries(m.map((x,i)=>[x[1],hash(text.slice(x.index,m[i+1]?.index??text.length).trim())]));}
const oldGuard=JSON.parse(old('tests/fixtures/ux-stage1-protected.json')),guard=structuredClone(oldGuard),oldFunctions=functionHashes(old('app.js')),newFunctions=functionHashes(read('app.js'));
const changedFunctions=Object.keys(oldFunctions).filter(key=>oldFunctions[key]!==newFunctions[key]);
assert.deepEqual(changedFunctions.slice().sort(),['projectedDebtAtYear','reportPresentationHtml','reportPresentationHtmlDollarBasis','financialPlanKeyResultSnapshot','decisionKeyResultSnapshot','renderReportCharts','comparisonSurplusImpactTiles','comparisonSurplusImpactTilesDollarBasis','reportScenarioComparisonHtml'].sort());
const guardChanges=[{group:'files',key:'calculator.js',baselineHash:hash(old('calculator.js')),correctedHash:hash(read('calculator.js'))}];
assert.equal(guard.files['calculator.js'],guardChanges[0].baselineHash);guard.files['calculator.js']=guardChanges[0].correctedHash;
for(const key of [...changedFunctions,'projectedDebtMoney']){guardChanges.push({group:'appFunctions',key,baselineHash:oldFunctions[key]??null,previousRecordedGuardHash:oldGuard.appFunctions[key]??null,correctedHash:newFunctions[key],newlyGuarded:!Object.hasOwn(oldGuard.appFunctions,key)});guard.appFunctions[key]=newFunctions[key];}
guard.f04PropertyDebtCorrection={baseline,debtProjectionVersion:next.FFSCalculator.DEBT_PROJECTION_VERSION,
 authorization:'User instructed: Please commence F04 correction. Necessary protected/golden changes are independently checked against scheduled property debt. F07 and F11 are not implemented.',
 hashConvention:'LF-normalized full files or function boundaries and trim matching tests/ux-stage1.test.mjs. Baseline source hashes are distinct from historical recorded expectations.',
 changes:guardChanges,fixtures:'Pre-F04 full outputs and investment SHA fixtures retained as *.pre-f04.*; independent deltas in docs/f04-property-debt/deltas.json.'};
if(process.argv.includes('--apply'))writeFileSync(new URL('../tests/fixtures/ux-stage1-protected.json',import.meta.url),JSON.stringify(guard,null,2)+'\n');
else assert.deepEqual(JSON.parse(read('tests/fixtures/ux-stage1-protected.json')),guard,'Only approved independently reviewed guards may change');
const result={baseline,debtProjectionVersion:next.FFSCalculator.DEBT_PROJECTION_VERSION,preservedGoldenSha256:hash(beforeBytes),golden,investmentDeltas,auditHouseholds:households,guardChanges};
writeFileSync(new URL('../docs/f04-property-debt/deltas.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({golden:golden.map(({name,changedFields})=>({name,changedFields})),investment:investmentDeltas.map(({name,previousSha256,correctedSha256})=>({name,previousSha256,correctedSha256})),auditHouseholds:households.map(({id,changedFields})=>({id,changedFields}))},null,2));
