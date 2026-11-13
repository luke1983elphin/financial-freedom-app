// Stage-two diagnostics: production is imported read-only. No prior expected values imported.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import '../../../calculator.js';
import '../../../agePensionEstimate.js';
import '../../../semiRetirementProjection.js';
import '../../../semiRetirementUi.js';
import '../../../forecast-assumptions.js';
import '../../../growth-scenarios.js';
import '../../../dollar-basis.js';
import '../../../weekly-plan.js';
const C=globalThis.FFSCalculator,E=globalThis.FFSSemiRetirementProjection,U=globalThis.FFSSemiRetirementUi;
const G=globalThis.FFSGrowthScenarios,W=globalThis.FFSWeeklyPlan,D=globalThis.FFSDollarBasis,P=globalThis.FFSAgePension;
const clone=x=>structuredClone(x), round=x=>Math.round((x+Number.EPSILON)*100)/100;
const evidence=[];
// Positive-part equation independently expresses resident brackets and LITO, not app config.
function tax(x){const p=n=>Math.max(0,n);const before=.15*p(x-18200)+.15*p(x-45000)+.07*p(x-135000)+.08*p(x-190000);
 const lito=x<=37500?700:x<=45000?700-.05*(x-37500):Math.max(0,325-.015*(x-45000));
 return round(Math.max(0,before-lito)+Math.min(.02*x,.1*p(x-28011)));}
const asset=(value,mode='reinvest',extra={})=>({id:'portfolio',name:'Shares',category:'shares',owner:'person1',value,investmentReturnMode:'totalReturn',expectedTotalReturnPct:7,expectedIncomeYieldPct:3,incomeTreatment:mode,...extra});
function person(id='person1',extra={}){return {id,name:id,currentAge:65,currentGrossEmploymentIncome:0,annualIncomeGrowthRate:0,semiRetirementAge:65,semiRetirementGrossIncome:0,fullRetirementAge:65,superAccessAge:60,openingSuperBalance:0,superReturnBeforeRetirement:0,superReturnAfterRetirement:0,superAnnualFeesRate:0,employerSuperRate:.12,existingAdditionalConcessionalContributions:0,additionalContributionsStopAge:65,stslOpeningBalance:0,hasPrivateHealthCover:true,...extra};}
function input(extra={}){return {projectionStartYear:2026,projectionEndAge:67,inflationRate:0,household:{currentLifestyleSpending:0,semiRetirementLifestyleSpending:0,fullRetirementLifestyleSpending:0,otherAnnualIncome:0,annualLoanPrincipalRepayments:0},accessibleInvestments:{openingBalance:2000000,annualReturnRate:0,annualFeesRate:0,components:[asset(2000000)]},people:[person()],scenario:{minimumAccessibleBalance:0,minimumEstateBalanceAtEndAge:0,surplusDestination:'enjoyment'},...extra};}
function plan(age=40){const p=C.emptyPlan();p.personal.person1Age=age;p.personal.person1Name='A';p.personal.fullRetirementAge=65;return p;}
function timing(p){p.personal.retirementTiming={version:1,mode:'individual',people:[{id:'person1',alreadyRetired:p.personal.person1Age>=65,hasSemiRetirement:false,semiRetirementAge:65,fullRetirementAge:65}]};return p;}
function project(x){const r=E.projectRetirementScenario(x);if(!r.validation.isValid)throw Error(JSON.stringify(r.validation));return r;}
function check(id,finding,description,input,actual,expected,tolerance=.03){if(!Number.isFinite(actual)||!Number.isFinite(expected))throw Error(id+' nonfinite');evidence.push({id,finding,description,input,actual:round(actual),independentExpected:round(expected),delta:round(actual-expected),tolerance,matches:Math.abs(actual-expected)<=tolerance});}
function value(id,finding,description,input,actual){evidence.push({id,finding,description,input,observed:actual});}

// F08: tax-cash deficit, not just a low spending balance.
for(const [tag,cash,yieldAmt] of [['zero',0,60000],['partial',5000,60000],['covered',20000,60000]]){
 const p=input({accessibleInvestments:{openingBalance:100000,annualReturnRate:0,annualFeesRate:0},passiveIncome:[{id:'income',type:'dividends',owner:'person1',annualCashIncome:cash,annualTaxableIncome:yieldAmt}]});
 const r=project(p),h=r.years[0].household,expectedTax=tax(yieldAmt);
 check('TAX-'+tag,'F08','Signed household cash after personal tax',p,h.netHouseholdCashIncome,cash-expectedTax);
 check('DRAW-'+tag,'F08','Tax deficit must be funded by accessible withdrawal with zero lifestyle spending',p,h.totalAccessibleInvestmentWithdrawal,Math.max(0,expectedTax-cash));
 check('CLOSE-'+tag,'F08','Zero-return closing assets after tax deficit settlement',p,h.closingAccessibleInvestmentBalance,100000-Math.max(0,expectedTax-cash));
}
{
 const p=input(),r=project(p),h=r.years[0].household;
 check('REINVEST-TAX','F08','Explicit $2m reinvested 3% yield computes ordinary tax',p,r.years[0].people[0].incomeTax+r.years[0].people[0].medicareLevy,tax(60000));
 check('REINVEST-DRAW','F08','Computed tax must reach withdrawal waterfall',p,h.totalAccessibleInvestmentWithdrawal,tax(60000));
 const spouse=clone(p);spouse.people.push(person('person2',{currentGrossEmploymentIncome:100000,semiRetirementAge:67,fullRetirementAge:67}));
 const s=project(spouse);check('SPOUSE-CASH','F08','Spouse income can fund owner tax; cannot clamp before aggregation',spouse,s.years[0].household.netHouseholdCashIncome,100000-tax(100000)-tax(60000));
 const noAssets=input({accessibleInvestments:{openingBalance:0,annualReturnRate:0,annualFeesRate:0},passiveIncome:[{id:'taxable',type:'dividends',owner:'person1',annualCashIncome:0,annualTaxableIncome:60000}]});
 check('UNFUNDED-TAX','F08','No assets means tax liability must remain explicit, not disappear',noAssets,project(noAssets).years[0].household.unmetRequiredLifestyleSpending,tax(60000));
 const on=clone(p);on.people[0].currentAge=70;on.people[0].semiRetirementAge=70;on.people[0].fullRetirementAge=70;on.projectionEndAge=72;on.scenario.agePension={enabled:true,excludeSapto:true};
 check('PENSION-PATH','F08','Pension enabled but means-tested to zero still must fund tax',on,project(on).years[0].household.totalAccessibleInvestmentWithdrawal,tax(60000));
}
// Same realistic landlord through both forecast paths and growth overlays.
const landlord=plan();landlord.assets.otherPropertyValue=600000;landlord.investing.expectedInvestmentReturnPct=0;
landlord.assetItems=[{id:'rental',name:'Rental',category:'investmentProperty',value:600000}];
landlord.liabilityItems=[{id:'debt',name:'Rental loan',type:'rentalPropertyLoan',balance:350000,interestRatePct:6,repayment:1750,repaymentFrequency:'monthly',repaymentType:'interestOnly',termYears:30,linkedAssetId:'rental'}];
landlord.incomeItems=[{id:'rent',type:'rentalNetCashIncome',owner:'person1',amount:9000,frequency:'annually',rentalCashIncomeAnnual:30000,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'rental',linkedLoanIds:['debt']}];
const forecast=p=>U.applyRetirementForecast(p,C.calculatePlan(p));
for(const [name,p] of [['legacy',landlord],['linked',timing(clone(landlord))]]){
 const finding=name==='legacy'?'F04':'F11';
 const r=forecast(p);check('PROPERTY-'+name,finding,'Year-one net worth is grown property less unchanged IO debt',p,r.netWorthProjection[0].closingBalance,600000*1.03-350000);
 const opts=G.suggested(p);for(const k of ['Lower','Base','Higher']){const g=G.calculate(p,opts[k],forecast);if(!g.ok)throw Error(JSON.stringify(g.errors));
 const rate=opts[k].values.investmentPropertyGrowthRatePct/100;
 check('GROWTH-'+name+'-'+k,finding,'Growth overlay must retain property debt without duplicate assets',opts[k],g.rows[0].netWorth,600000*(1+rate)-350000);}
 check('REAL-'+name,finding,'Display conversion preserves economic error rather than correcting it',p,D.displayedValue(r.netWorthProjection[0].closingBalance,1,2.5,'today'),(600000*1.03-350000)/1.025);
}
{
 const p=timing(clone(landlord));p.assetItems[0].category='otherProperty';
 check('PROPERTY-generic-zero','SYSTEM','Generic otherProperty has documented detailed zero growth without an override',p,forecast(p).netWorthProjection[0].closingBalance,250000);
 p.assetItems[0].propertyGrowthRatePct=3;
 check('PROPERTY-linked-otherProperty','F04','Detailed debt subtraction is correct when adapter has no duplicate',p,forecast(p).netWorthProjection[0].closingBalance,268000);
 const d=U.buildSemiRetirementScenarioDefaults(timing(clone(landlord)),C.calculatePlan(landlord)).draft;
 check('PROPERTY-COUNT','F11','Canonical investmentProperty plus its legacy mirror must represent one property',landlord,d.assets.length,1);
 value('PROPERTY-DUPLICATES','F11','Exact duplicate entries emitted by adapter',landlord,d.assets);
}
// F07: isolate both wrong start and wrong return; linked adapter must be checked too.
for(const [name,p] of [['legacy',plan(65)],['linked',timing(plan(65))]]){
 p.assets.superPerson1=500000;p.assetItems=[{id:'asset-super-1',category:'super',value:500000,owner:'person1'}];
 const r=forecast(p);check('START-'+name,'F07','Already retiring at opening has $500k, not a future closing balance',p,r.totalRetirementAssets,500000);
 const chosenRate=name==='linked'?.055:.065;
 check('RETIRE-70-'+name,'F07','Five annual no-flow years from the true opening at account return',p,r.retirementSustainability[1].balances[70],500000*(1+chosenRate)**5,.15);
 value('SUPER-PATH-'+name,'F07','Detailed/main first closing super and sustainability input',p,{superFirst:r.superProjection[0].closingBalance,retirementStart:r.totalRetirementAssets});
}
// Explicit split is correct; unlinked overlap is conditional on economic identity.
for(const [tag,mode,link,separate] of [['linked-cash','cash',true,false],['linked-reinvest','reinvest',true,false],['unlinked-overlap','cash',false,false],['genuine-separate','cash',false,true]]){
 const p=plan();p.assetItems=[asset(500000,mode)];p.incomeItems=[{id:'dividend',type:'dividends',owner:'person1',amount:15000,frequency:'annually',...(link?{linkedAssetId:'portfolio'}:{}),...(separate?{confirmedSeparateInvestmentIncome:true}:{})}];
 const r=C.calculatePlan(p);check('INCOME-'+tag,'F03','Economic growth plus cash yield, with identity stated in case',p,r.combinedWealthCreation,separate?50000:35000);
 value('REVIEW-'+tag,'F03','Overlap review warnings are metadata, not cash suppression',p,r.investmentIncomeReview||C.investmentIncomeReviewItems(p));
}
// Annual versus monthly is a convention mismatch, not proof of incorrect monthly arithmetic.
for(const [tag,rate,key,projection] of [['invest',.07,'sharesEtfs','investmentProjection'],['super',.065,'superPerson1','superProjection']]){
 const p=plan();p.assets[key]=500000;const r=C.calculatePlan(p),actual=r[projection][0].closingBalance;
 check('APR-'+tag,'F02','Monthly nominal APR identity',p,actual,500000*Math.exp(12*Math.log1p(rate/12)),.04);
 check('EAR-'+tag,'F02','Effective annual alternative for same displayed input',p,actual,500000*(1+rate));
}
{
 const p=input({accessibleInvestments:{openingBalance:500000,annualReturnRate:.07,annualFeesRate:.01},people:[person('person1',{openingSuperBalance:500000,superReturnAfterRetirement:.065,superAnnualFeesRate:.01})]});
 const r=project(p);check('FEE-INV','F01','Explicit investment fee deducted once; no blanket return tax',p,r.years[0].household.closingAccessibleInvestmentBalance,500000*(1+.07-.01));
 check('FEE-SUPER','F01','Explicit super fee, entered return fully credited',p,r.years[0].people[0].closingSuperBalance,500000*(1+.065-.01));
 check('GROSS-SUPER','F01','Hypothetical fully taxable gross super earnings alternative, not universal rule',p,r.years[0].people[0].closingSuperBalance,500000+32500*.85-5000);
}
for(const [tag,wage] of [['low',0],['working',100000]]){
 const p=plan(65);p.incomeItems=[{id:'div',type:'dividends',owner:'person1',amount:7000,cashDividend:7000,frankingCredits:3000,frequency:'annually'},...(wage?[{id:'wage',type:'salaryWages',owner:'person1',amount:wage,frequency:'annually'}]:[])];
 p.income.person1HospitalCoverStatus='full-year';p.income.person1HospitalCoverDays=365;
 const r=C.calculatePlan(p);check('FRANKING-'+tag,'F05','Eligible resident cash after gross-up tax and refundable offset',p,r.netIncomeAfterTaxHelp,wage+7000-tax(wage+10000)+3000);
}
for(const wage of [230000,245000,300000]){
 const p=plan();p.incomeItems=[{id:'w',type:'salaryWages',owner:'person1',amount:wage,frequency:'annually'}];const sg=Math.min(wage,270830)*.12;
 check('DIV293-'+wage,'F06','Total ordinary plus additional contributions tax with threshold excess',p,C.calculatePlan(p).superContributionsTaxPaid,.15*sg+.15*Math.min(sg,Math.max(0,wage+sg-250000)));
}
{
 const p={partnered:false,person1Age:70,homeowner:true,assessableAssets:433000,assessableAnnualIncome:0};
 check('PENSION-ASSET','F09','Current schedule asset taper independently recomputed',p,P.estimateAnnualPension(p).annualPension,1237.7*26-(433000-333000)*.078);
 check('SENIOR-LEVY','F09','Ordinary levy charged where eligible SAPTO senior concession would exempt this income',p,C.calculateMedicareLevy(32180.2-71.6*26),0);
 const n=asset(500000,'cash',{expectedTotalReturnPct:-20});value('NEGATIVE-SPLIT','F10','Economically possible -20% total plus 3% cash yield rejected',n,C.investmentReturnValidation(n));
 const down=input({accessibleInvestments:{openingBalance:500000,annualReturnRate:-.2,annualFeesRate:0},household:{currentLifestyleSpending:40000,semiRetirementLifestyleSpending:40000,fullRetirementLifestyleSpending:40000,otherAnnualIncome:0,annualLoanPrincipalRepayments:0}});
 check('NEGATIVE-AGG','F10','Aggregate midpoint loss is supported',down,project(down).years[0].household.closingAccessibleInvestmentBalance,500000-40000-.2*(500000-20000));
}
// Weekly planning is a cash calendar, not an after-tax investment funding ledger.
{
 const p=plan();p.assetItems=[asset(2000000)];const r=C.calculatePlan(p);
 const w=W.createFromPlan(p,r,{startDate:'2026-11-16',periodWeeks:52,startingBalance:0});
 value('WEEKLY-NOCASH','SYSTEM','Weekly money-in/out and source tax deficit',p,{netHousehold:r.netIncomeAfterTaxHelp,timing:w.settings?.timingItems||w.timingItems,weeks:w.weeks.slice(0,2),totals:w.weeks.reduce((s,w)=>({income:s.income+w.planned.income,essential:s.essential+w.planned.essentialCosts}),{income:0,essential:0})});
}
const original=JSON.parse(readFileSync(new URL('../household-results.json',import.meta.url)));
const originalChecks=original.results.flatMap(r=>r.checks.map(c=>({household:r.id,metric:c.metric,previousExpected:c.expected,actualAfterRerun:c.actual,previousFinding:r.finding,status:r.status})));
const protectedPaths=['calculator.js','semiRetirementProjection.js','semiRetirementUi.js','agePensionEstimate.js','weekly-plan.js','forecast-assumptions.js','growth-scenarios.js','dollar-basis.js','app.js','plan-schema.js','legacy-plan-adapter.js'];
const out={reviewedPR:61,startingCommit:'065de0410698bb82edb66a4f192ed765e0dd102c',date:'2026-11-13',methods:'Fresh production calls; independently derived expected equations; fixtures supply no expected values to new checks. Original 48/99 replayed separately and reviewed by recheck-original.py.',protectedSha256:Object.fromEntries(protectedPaths.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../../'+p,import.meta.url))).digest('hex')])),originalInventory:{households:original.results.length,checks:originalChecks.length},diagnostics:evidence};
writeFileSync(new URL('./diagnostics.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({original:out.originalInventory,newDiagnostics:evidence.length,numerical:evidence.filter(x=>'matches'in x).length,discrepancies:evidence.filter(x=>x.matches===false).map(x=>({id:x.id,actual:x.actual,expected:x.independentExpected,delta:x.delta}))},null,2));
