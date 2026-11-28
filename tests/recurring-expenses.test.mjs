import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c={console};c.globalThis=c;
for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const E=c.FFSSemiRetirementProjection,U=c.FFSSemiRetirementUi,plain=x=>JSON.parse(JSON.stringify(x));
const event=(changes={})=>({id:'holiday',description:'Overseas holiday',amountTodayDollars:10000,year:2027,...changes});
function input(events=[],inflationRate=.03){return {projectionStartYear:2026,projectionEndAge:55,inflationRate,
 people:[{id:'person1',name:'Alex',currentAge:40,currentGrossEmploymentIncome:0,annualIncomeGrowthRate:0,semiRetirementAge:40,fullRetirementAge:40,superAccessAge:60,openingSuperBalance:0,superReturnBeforeRetirement:0,superReturnAfterRetirement:0,superAnnualFeesRate:0,employerSuperRate:0,existingAdditionalConcessionalContributions:0,stslOpeningBalance:0,hasPrivateHealthCover:true}],
 household:{currentLifestyleSpending:0,semiRetirementLifestyleSpending:0,fullRetirementLifestyleSpending:0,otherAnnualIncome:0,annualLoanPrincipalRepayments:0},accessibleInvestments:{openingBalance:1000000,openingOffsetBalance:0,annualReturnRate:0,annualFeesRate:0,externalAnnualAccessibleContribution:0},scenario:{oneOffLifestyleEvents:events,plannedConcessionalContributions:[],workingPhaseSurplusDestination:'accessible-investments',surplusDestination:'enjoyment',fullRetirementAnnualSpending:0,minimumAccessibleBalance:0,minimumEstateBalanceAtEndAge:0,withdrawalOrder:'accessible-first'},assets:[],liabilities:[],passiveIncome:[],propertyIncome:[]};}
function project(events,rate=.03){const args=input(events,rate),before=JSON.stringify(args),r=E.projectRetirementScenario(args);assert.equal(r.validation.isValid,true,JSON.stringify(r.validation));assert.equal(JSON.stringify(args),before,'projection does not mutate saved inputs');return r;}
for(const [frequency,intervalYears,expected] of [
 ['annual',undefined,[2027,2028,2029,2030,2031,2032,2033,2034,2035,2036,2037,2038,2039,2040]],
 ['every-2-years',undefined,[2027,2029,2031,2033,2035,2037,2039]],
 ['every-3-years',undefined,[2027,2030,2033,2036,2039]],
 ['every-5-years',undefined,[2027,2032,2037]],
 ['every-10-years',undefined,[2027,2037]],
 ['custom',4,[2027,2031,2035,2039]],
])test('expense schedule, inflation and funding: '+frequency,()=>{
 const r=project([event({frequency,intervalYears,endYear:2040})]);
 assert.deepEqual(plain(r.years.filter(y=>y.household.oneOffLifestyleSpending>0).map(y=>y.calendarYear)),expected);
 let total=0;
 for(const row of r.years){const amount=expected.includes(row.calendarYear)?Math.round(10000*1.03**(row.calendarYear-2026)*100)/100:0;
  assert.equal(row.household.oneOffLifestyleSpending,amount);assert.equal(row.household.totalProjectedLifestyleSpending,amount);
  assert.equal(row.household.oneOffLifestyleEvents.length,amount>0?1:0);total=Math.round((total+amount)*100)/100;
  assert.ok(Math.abs(row.household.closingAccessibleInvestmentBalance-(1000000-total))<.02,'expense funded exactly once');
 }
 assert.equal(r.summary.totalOneOffLifestyleSpending,total);assert.equal(r.summary.totalOneOffLifestyleSpendingTodayDollars,10000*expected.length);
 assert.equal(JSON.stringify(E.projectRetirementScenario(JSON.parse(JSON.stringify(input([event({frequency,intervalYears,endYear:2040})]))))),JSON.stringify(r),'saved/backup JSON round trip retains the schedule');
});
test('final year is inclusive only when it falls on the schedule',()=>{
 for(const [endYear,expected]of [[2039,[2027,2029,2031,2033,2035,2037,2039]],[2038,[2027,2029,2031,2033,2035,2037]],[2027,[2027]]]){
  const r=project([event({frequency:'every-2-years',endYear})],0);assert.deepEqual(plain(r.years.filter(y=>y.household.oneOffLifestyleSpending).map(y=>y.calendarYear)),expected);
 }
});
test('legacy expenses remain one-off with identical normalized representation',()=>{
 const old=event();assert.deepEqual(plain(U.normaliseOneOffLifestyleEvents([old])),[old]);
 const r=project([old]);assert.equal(r.years.filter(y=>y.household.oneOffLifestyleSpending).length,1);
 assert.deepEqual(plain(U.normaliseOneOffLifestyleEvents([{...old,frequency:'one-off',endYear:2040}])),[old]);
});
test('concurrent arrangements combine once and duplicate IDs are rejected',()=>{
 const r=project([event({frequency:'annual',endYear:2029}),event({id:'car',amountTodayDollars:20000,year:2027})],0);
 assert.equal(r.years[1].household.oneOffLifestyleSpending,30000);assert.equal(r.summary.totalOneOffLifestyleSpending,50000);
 assert.equal(E.projectRetirementScenario(input([event(),event()])).validation.isValid,false);
});
test('custom intervals and final years are validated without rounding invalid entries into valid schedules',()=>{
 for(const changes of [{frequency:'custom',intervalYears:0,endYear:2040},{frequency:'custom',intervalYears:2.5,endYear:2040},{frequency:'custom',intervalYears:-1,endYear:2040},{frequency:'unknown',endYear:2040},{frequency:'annual',endYear:2026},{frequency:'annual',endYear:2042},{frequency:'annual'},{frequency:'annual',endYear:2030.5}])assert.equal(E.projectRetirementScenario(input([event(changes)])).validation.isValid,false,JSON.stringify(changes));
});
test('normalization is idempotent and report timing describes recurrence',()=>{
 const e=event({frequency:'custom',intervalYears:4,endYear:2040});const once=U.normaliseOneOffLifestyleEvents([e]);assert.deepEqual(plain(U.normaliseOneOffLifestyleEvents(once)),plain(once));assert.equal(U.expenseTimingLabel(e),'every 4 years, 2027–2040');
 const r=project(plain(once));assert.equal(r.years[5].household.oneOffLifestyleEvents[0].year,2031);
});
