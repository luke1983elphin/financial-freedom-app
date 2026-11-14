import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const c={console,structuredClone};c.globalThis=c;
for(const file of ['calculator.js','agePensionEstimate.js','semiRetirementProjection.js','semiRetirementUi.js','forecast-assumptions.js','growth-scenarios.js','dollar-basis.js']) vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const C=c.FFSCalculator,U=c.FFSSemiRetirementUi;
const round=n=>Math.round(n*100)/100;
function fixture({balance=350000,payment=21000,rate=6,growth=3,type='interestOnly',linked=false}={}){
 const p=C.emptyPlan();Object.assign(p.personal,{person1Name:'Landlord',person1Age:45,fullRetirementAge:65});
 Object.assign(p.investing,{annualInvestingTarget:0,expectedInvestmentReturnPct:0,expectedSuperReturnPct:0,inflationPct:2.5});
 p.assets.otherPropertyValue=600000;
 p.assetItems=[{id:'rental',category:linked?'otherProperty':'investmentProperty',value:600000,propertyGrowthRatePct:growth}];
 p.liabilityItems=[{id:'loan',type:'rentalPropertyLoan',linkedAssetId:'rental',balance,repayment:payment,repaymentFrequency:'annually',interestRatePct:rate,termYears:30,repaymentType:type}];
 // Cash receipts are sufficient for the IO interest; surplus remains enjoyed.
 p.incomeItems=[{id:'rent',type:'rentalNetCashIncome',owner:'person1',amount:30000,rentalCashIncomeAnnual:30000,taxableRentalIncomeAnnual:0,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'rental',linkedLoanIds:['loan']}];
 if(linked)p.personal.retirementTiming={version:1,mode:'individual',people:[{id:'person1',hasSemiRetirement:false,alreadyRetired:false,fullRetirementAge:65}]};
 return p;
}
function calculate(p){const before=JSON.stringify(p),r=C.calculatePlan(p);assert.equal(JSON.stringify(p),before);return r;}
// Independent monthly ledger: no production amortisation helper is used.
function debt({balance,payment,rate,years,offset=0}){
 let b=balance;for(let m=0;m<years*12&&b>0;m++){const interest=round(Math.max(0,b-offset)*rate/1200);b=round(Math.max(0,b+interest-Math.min(payment/12,b+interest)));}return b;
}
test('F04 IO property debt remains in year-one net worth and report debt',()=>{
 const r=calculate(fixture());assert.equal(r.currentNetWorth,250000);assert.equal(r.netWorthProjection[0].closingBalance,268000);
 assert.equal(C.projectedDebtAtYear(r,0),350000);assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(C.projectedDebtAtYear(r,10),350000);
});
for(const growth of [1,3,5])test(`F04 ${growth}% property growth subtracts the loan once`,()=>{
 const r=calculate(fixture({growth}));assert.equal(r.netWorthProjection[0].closingBalance,600000*(1+growth/100)-350000);
 assert.equal(r.financialFreedomProgressProjection[0].investmentPropertyEquity,r.netWorthProjection[0].closingBalance);
});
test('F04 P&I uses independently amortised outstanding principal',()=>{
 const r=calculate(fixture({type:'principalAndInterest',payment:30000}));for(const year of [1,2,5,10,20,30]){
 const expected=debt({balance:350000,payment:30000,rate:6,years:year});assert.equal(C.projectedDebtAtYear(r,year),expected);
 assert.equal(r.netWorthProjection[year-1].closingBalance,round(600000*1.03**year-expected));}
});
test('F04 zero-interest principal and final partial payment are counted once',()=>{
 const r=calculate(fixture({balance:10000,payment:6000,rate:0,type:'principalAndInterest',growth:0}));
 assert.equal(C.projectedDebtAtYear(r,1),4000);assert.equal(C.projectedDebtAtYear(r,2),0);assert.equal(r.netWorthProjection[0].closingBalance,596000);assert.equal(r.netWorthProjection[1].closingBalance,600000);
});
test('F04 IO additional principal reduces only the remaining debt',()=>{
 const p=fixture();p.liabilityItems[0].additionalPrincipalRepayment=10000;p.liabilityItems[0].additionalPrincipalFrequency='annually';const r=calculate(p);
 assert.equal(C.projectedDebtAtYear(r,1),340000);assert.equal(C.projectedDebtAtYear(r,2),330000);assert.equal(r.netWorthProjection[0].closingBalance,278000);
});
test('F04 multiple rental loans are scheduled independently',()=>{
 const p=fixture();p.liabilityItems.push({...p.liabilityItems[0],id:'second',balance:100000,repayment:12000,interestRatePct:0,repaymentType:'principalAndInterest'});const r=calculate(p);
 assert.equal(C.projectedDebtAtYear(r,1),438000);assert.equal(r.netWorthProjection[0].closingBalance,180000);
});
test('F04 inactive, deleted and duplicate IDs are not additional property debt',()=>{
 const p=fixture();p.liabilityItems.push({...p.liabilityItems[0]},{...p.liabilityItems[0],id:'inactive',active:false},{...p.liabilityItems[0],id:'deleted',deleted:true});
 const r=calculate(p);assert.equal(r.rentalPropertyLoanBalance,350000);assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(r.currentNetWorth,250000);
});
test('F04 liability aliases retain their canonical balance',()=>{
 const p=fixture();p.liabilityItems=[{id:'alias',category:'rentalPropertyLoan',linkedAssetId:'rental',currentBalance:350000,repaymentAmount:21000,repaymentFrequency:'annually',interestRate:6,remainingTermYears:30,repaymentType:'interestOnly'}];
 const r=calculate(p);assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(r.netWorthProjection[0].closingBalance,268000);
});
for(const type of ['investmentLoan','shareInvestmentLoan','managedFundLoan'])test(`F04 ${type} explicitly linked to property is counted once`,()=>{
 const p=fixture();p.liabilityItems[0].type=type;const r=calculate(p);
 assert.equal(r.currentNetWorth,250000);assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(r.netWorthProjection[0].closingBalance,268000);
 assert.equal(r.investmentPropertyDebt,350000);assert.equal(r.otherInvestmentDebt,0);
});
test('F04 zero-balance rental loan cannot reappear from repayment inputs',()=>{
 const r=calculate(fixture({balance:0}));assert.equal(C.projectedDebtAtYear(r,1),0);assert.equal(r.netWorthProjection[0].closingBalance,618000);
});
test('F04 an offset remains an asset and does not reduce loan principal twice',()=>{
 const p=fixture();Object.assign(p.assets,{homeValue:800000,offsetBalance:50000});Object.assign(p.liabilities,{homeLoanBalance:200000,homeLoanInterestRatePct:6,monthlyRepayment:2000,remainingLoanTermYears:30});
 const r=calculate(p),home=debt({balance:200000,payment:24000,rate:6,years:1,offset:50000});
 assert.equal(C.projectedDebtAtYear(r,1),home+350000);assert.equal(r.netWorthProjection[0].closingBalance,824000+618000+50000-home-350000);
});
test('F04 property shortfall can produce negative net worth without clipping',()=>{
 const r=calculate(fixture({balance:800000,payment:48000}));assert.equal(r.netWorthProjection[0].closingBalance,-182000);assert.equal(C.projectedDebtAtYear(r,1),800000);
});
test('F04 Today dollars discount corrected nominal debt and equity once',()=>{
 const r=calculate(fixture());assert.equal(round(r.netWorthProjection[0].closingBalance/1.025),261463.41);assert.equal(round(C.projectedDebtAtYear(r,1)/1.025),341463.41);
});
test('F04 linked report debt comes from its actual detailed ledger',()=>{
 const p=fixture({linked:true}),r=U.applyRetirementForecast(p,calculate(p));assert.ok(r.retirementProjection);
 for(const year of [1,5,10]){const row=r.retirementProjection.years[year-1];assert.equal(C.projectedDebtAtYear(r,year),row.household.totalDebt+row.people.reduce((n,p)=>n+p.stslClosingBalance,0));}
 assert.equal(r.netWorthProjection[0].closingBalance,268000);
});
test('F04 linked term expiry and balloon do not use stale legacy balances',()=>{
 const p=fixture({linked:true});p.liabilityItems[0].termYears=2;const r=U.applyRetirementForecast(p,calculate(p));assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(C.projectedDebtAtYear(r,2),0);
});
test('F04 no-property debt control retains home, HELP and other debt conventions',()=>{
 const p=C.emptyPlan();p.personal.person1Age=45;p.liabilities.homeLoanBalance=100000;p.liabilities.homeLoanInterestRatePct=0;p.liabilities.monthlyRepayment=1000;p.liabilities.remainingLoanTermYears=30;p.liabilities.otherDebts=5000;p.liabilities.creditCardBalance=2000;p.liabilities.hecsHelpDebt=10000;
 const r=calculate(p);assert.equal(C.projectedDebtAtYear(r,0),117000);assert.equal(C.projectedDebtAtYear(r,1),105000);
});
test('F04 report and chart helper delegates to the common financial result selector',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=source.indexOf('  function projectedDebtAtYear('),end=source.indexOf('\n  function ',start+5);
 const ctx={CALC:C};vm.runInNewContext(source.slice(start,end),ctx);assert.equal(ctx.projectedDebtAtYear(calculate(fixture()),1),350000);
});
test('F04 invalid elapsed years are rejected explicitly',()=>{
 const r=calculate(fixture());for(const y of [-1,NaN,Infinity,1.5])assert.throws(()=>C.projectedDebtAtYear(r,y));
});
test('F04 an absent detailed year is unavailable rather than a legacy fallback or zero',()=>{
 const p=fixture({linked:true}),r=U.applyRetirementForecast(p,calculate(p));
 assert.equal(C.projectedDebtAtYear(r,100),null);
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8'),names=['projectedDebtAtYear','projectedDebtMoney'];
 const code=names.map(n=>{const a=source.indexOf('  function '+n+'(');return source.slice(a,source.indexOf('\n  function ',a+5));}).join('\n');
 const ctx={CALC:C,money:x=>'$'+x};vm.runInNewContext(code,ctx);assert.equal(ctx.projectedDebtMoney(r,100),'Outside projection');assert.equal(ctx.projectedDebtMoney(r,1),'$350000');
});
test('F04 repeated calculations remain deterministic and do not mutate inputs',()=>{
 const p=fixture();assert.deepEqual(calculate(p),calculate(p));
});
test('F04 does not conceal or change the separate F11 duplicate-property defect',()=>{
 const p=fixture({linked:true});p.assetItems[0].category='investmentProperty';
 const r=U.applyRetirementForecast(p,calculate(p));assert.equal(r.netWorthProjection[0].closingBalance,868000);
 assert.equal(C.projectedDebtAtYear(r,1),350000);assert.equal(r.retirementProjection.years[0].liabilities.length,1);
});
