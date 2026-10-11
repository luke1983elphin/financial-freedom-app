import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={console};context.globalThis=context;
for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js','plan-schema.js']) vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const C=context.FFSCalculator,U=context.FFSSemiRetirementUi,E=context.FFSSemiRetirementProjection;
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(age=58,partnerAge=56){
 const p=C.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:age,person2Name:partnerAge?'Sam':'',person2Age:partnerAge,fullRetirementAge:65,semiRetirementAge:60,targetAnnualSpending:50000});
 p.incomeItems=[{id:'a',type:'salaryWages',owner:'person1',amount:100000,frequency:'annually'},...(partnerAge?[{id:'b',type:'salaryWages',owner:'person2',amount:70000,frequency:'annually'}]:[])];
 p.expenseItems=[{id:'spend',amount:50000,frequency:'annually',category:'living'}];
 Object.assign(p.assets,{cash:100000,sharesEtfs:200000,superPerson1:300000,superPerson2:partnerAge?200000:0});
 p.investing.annualInvestingTarget=10000;
 return p;
}
function defaults(p){return U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft;}
function extract(name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n  function ',start+5));}
test('legacy plan and saved scenario defaults retain every age without writes',()=>{
 const p=fixture(),before=JSON.stringify(p),d=defaults(p);
 assert.deepEqual(Array.from(d.people,p=>p.fullRetirementAge),[65,65]);assert.ok(d.people.every(p=>!p.hasSemiRetirement));assert.equal(JSON.stringify(p),before);
 const r=C.calculatePlan(p);assert.equal(U.applyRetirementForecast(p,r),r);
});
test('retirement timing survives serialization and canonical migration',()=>{
 const p=fixture(),d=defaults(p);Object.assign(d.people[0],{hasSemiRetirement:true,semiRetirementAge:60,semiRetirementGrossIncome:35000,fullRetirementAge:64});d.people[1].fullRetirementAge=62;
 U.saveRetirementTiming(p,d.people,'individual');const loaded=context.FFSPlanSchema.migrate(clone(p)).plan;const restored=defaults(loaded);
 assert.equal(restored.people[0].semiRetirementAge,60);assert.equal(restored.people[0].semiRetirementGrossIncome,35000);assert.equal(restored.people[1].fullRetirementAge,62);
 assert.equal(p.personal.workOptionalAge,50);assert.equal(p.personal.semiRetirementAge,60);
});
test('65-year-old can retire today with super access age in the past',()=>{
 const p=fixture(65,63),d=defaults(p);d.people.forEach(person=>{person.alreadyRetired=true;person.fullRetirementAge=person.currentAge;person.semiRetirementAge=person.currentAge;});
 U.saveRetirementTiming(p,d.people);const draft=defaults(p),out=U.runSemiRetirementProjection(E,draft);
 assert.equal(out.validation.isValid,true);assert.ok(out.result.years[0].people.every(person=>person.employmentIncome===0));assert.ok(out.result.years[0].people.every(person=>person.employmentPhase==='fully-retired'));
});
test('each partner income stops on their own date and reduces only where elected',()=>{
 const p=fixture(),d=defaults(p);Object.assign(d.people[0],{hasSemiRetirement:true,semiRetirementAge:59,semiRetirementGrossIncome:30000,fullRetirementAge:61});d.people[1].fullRetirementAge=60;
 U.saveRetirementTiming(p,d.people,'individual');const r=U.applyRetirementForecast(p,C.calculatePlan(p));
 const firstReduced=r.retirementProjection.years.find(row=>row.person1Age===59);assert.equal(firstReduced.people[0].employmentPhase,'semi-retired');assert.equal(firstReduced.people[1].employmentPhase,'full-time');
 const firstRetired=r.retirementProjection.years.find(row=>row.person1Age===61);assert.equal(firstRetired.people[0].employmentIncome,0);assert.ok(firstRetired.people[1].employmentIncome>0);
 const both=r.retirementProjection.years.find(row=>row.person2Age===60);assert.ok(both.people.every(person=>person.employmentIncome===0));
});
test('main Future investment, super and net worth rows equal existing retirement engine rows',()=>{
 const p=fixture(),d=defaults(p);d.people[0].fullRetirementAge=60;d.people[1].fullRetirementAge=58;U.saveRetirementTiming(p,d.people,'shared');
 const original=C.calculatePlan(p),r=U.applyRetirementForecast(p,original);const expected=U.runSemiRetirementProjection(E,defaults(p)).result;
 for(const age of [59,60,70,80]){const engineRow=expected.years.find(row=>row.person1Age===age),i=r.investmentProjection.find(row=>row.age===age),s=r.superProjection.find(row=>row.age===age),n=r.netWorthProjection.find(row=>row.age===age);
 assert.equal(i.closingBalance,Math.max(0,engineRow.household.totalAccessibleAssets-engineRow.household.offsetClosingBalance));assert.equal(s.closingBalance,engineRow.household.totalSuperBalance);assert.equal(n.closingBalance,engineRow.household.totalNetWorth);}
 const before=JSON.stringify(p);U.applyRetirementForecast(p,original);assert.equal(JSON.stringify(p),before);
});
test('timing changes alter forecasts and invalidate forecast cache',()=>{
 const p=fixture(),d=defaults(p);U.saveRetirementTiming(p,d.people);const before=U.applyRetirementForecast(p,C.calculatePlan(p));
 d.people[0].fullRetirementAge=58;d.people[1].fullRetirementAge=56;U.saveRetirementTiming(p,d.people);
 const after=U.applyRetirementForecast(p,C.calculatePlan(p));assert.notEqual(before.investmentProjection[4].closingBalance,after.investmentProjection[4].closingBalance);
});
test('already-retired and phased journey events sort by calendar time rather than partner age',()=>{
 const events=U.retirementJourney([{name:'Alex',currentAge:65,fullRetirementAge:65,alreadyRetired:true},{name:'Sam',currentAge:59,hasSemiRetirement:true,semiRetirementAge:60,fullRetirementAge:62,semiRetirementGrossIncome:20000}]);
 assert.equal(events[0].offset,0);assert.match(events[0].label,/already retired/);assert.equal(events[1].offset,1);assert.equal(events[2].offset,3);
});
test('opening and editing a saved comparison cannot change main retirement timing',()=>{
 const p=fixture(),d=defaults(p),before=JSON.stringify(p);const ctx={window:{FFSSemiRetirementUi:U},plan:p,semiRetirementScenarioSourceKey:'saved-scenario:old',semiRetirementScenarioDraft:d};
 vm.runInNewContext(extract('commitRetirementTiming'),ctx);d.people[0].fullRetirementAge=58;assert.equal(ctx.commitRetirementTiming(),false);assert.equal(JSON.stringify(p),before);
});
test('invalid retirement ages do not overwrite persisted assumptions',()=>{
 const p=fixture(),d=defaults(p),before=JSON.stringify(p);const ctx={window:{FFSSemiRetirementUi:U},plan:p,semiRetirementScenarioSourceKey:'base',semiRetirementScenarioDraft:d};
 vm.runInNewContext(extract('commitRetirementTiming'),ctx);d.people[0].fullRetirementAge=57;assert.equal(ctx.commitRetirementTiming(),false);assert.equal(JSON.stringify(p),before);
});
test('Goals renders one main age and optional milestones for both normal and guided forms',()=>{
 const elements={};const p=fixture(35,0);const ctx={plan:p,document:{getElementById:id=>elements[id]||=( {innerHTML:''})},escapeHtml:String,field:f=>`<input data-path="${f.path}">`,optionList:()=>'',};
 vm.runInNewContext(extract('renderRetirementGoals'),ctx);ctx.renderRetirementGoals('personalForm',[{path:'personal.workOptionalAge'},{path:'personal.semiRetirementAge'},{path:'personal.fullRetirementAge'},{path:'personal.targetAnnualSpending'}]);
 const html=elements.personalForm.innerHTML;assert.equal((html.match(/data-retirement-goal-age/g)||[]).length,1);assert.match(html,/<details class="goal-optional-milestones">/);assert.doesNotMatch(html,/data-path="personal.fullRetirementAge"/);assert.match(html,/data-view="semiretirement"/);
});
