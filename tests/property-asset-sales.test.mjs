import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c={console};c.globalThis=c;
for(const file of ['calculator.js','agePensionEstimate.js','semiRetirementProjection.js','semiRetirementUi.js','dollar-basis.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const C=c.FFSCalculator,E=c.FFSSemiRetirementProjection,U=c.FFSSemiRetirementUi,clone=x=>JSON.parse(JSON.stringify(x));
function draft({rental=false,debt=0,joint=false}={}){
 const p=C.emptyPlan();Object.assign(p.personal,{person1Name:'Alex',person1Age:68,person2Name:joint?'Sam':'',person2Age:joint?68:0,fullRetirementAge:68});
 p.assetItems=[{id:'land',name:rental?'Rental property':'Vacant land',category:rental?'investmentProperty':'otherProperty',value:300000,capitalGrowthRatePct:3,owner:joint?'joint':'person1'}];
 p.liabilityItems=debt?[{id:'loan',name:'Land loan',type:'rentalPropertyLoan',linkedAssetId:'land',balance:debt,interestRatePct:0,repayment:0,termYears:30,repaymentType:'interestOnly'}]:[];
 p.incomeItems=rental?[{id:'rent',name:'Rent net of expenses',type:'rentalNetCashIncome',owner:joint?'joint':'person1',amount:9000,rentalCashIncomeAnnual:12000,taxableRentalIncomeAnnual:9000,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'land',linkedLoanIds:debt?['loan']:[]}]:[];
 const d=U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft;
 d.projectionStartYear=2026;d.projectionEndAge=80;d.assumptions.inflationRatePct=0;
 d.accessibleInvestments.openingBalance=100000;d.accessibleInvestments.annualReturnRatePct=0;d.household.currentLifestyleSpending=0;d.household.semiRetirementLifestyleSpending=0;d.household.fullRetirementLifestyleSpending=0;d.scenario.agePension={enabled:false};
 d.scenario.oneOffIncomeEvents=[{id:'sale',assetSaleId:'land',saleProceedsBasis:'gross',amountTodayDollars:300000,year:2027,sellingCostPct:2,taxTreatment:'net-capital-gain',taxableCapitalGainPerson1:50000,...(joint?{taxableCapitalGainPerson2:30000}:{})}];
 return d;
}
function project(d){const out=U.runSemiRetirementProjection(E,d);assert.equal(out.validation.isValid,true,JSON.stringify(out.validation));assert.equal(out.result.validation.isValid,true,JSON.stringify(out.result.validation));return out;}
function invalid(d){const out=U.runSemiRetirementProjection(E,d);assert.equal(out.result?.validation.isValid??out.validation.isValid,false);return out.result?.validation.errors||out.validation.errors;}

test('vacant land sale deducts costs, funds CGT through existing tax once, and removes equity/estate capital',()=>{
 const d=draft(),before=JSON.stringify(d),out=project(d),[opening,sale,next]=out.result.years;
 assert.equal(JSON.stringify(d),before);assert.ok(opening.assets.some(a=>a.id==='land'));assert.ok(!sale.assets.some(a=>a.id==='land'));assert.ok(!next.assets.some(a=>a.id==='land'));
 const transaction=sale.household.assetSales[0];assert.equal(transaction.grossProceeds,300000);assert.equal(transaction.sellingCosts,6000);assert.equal(transaction.netBeforeTax,294000);assert.equal(sale.household.oneOffIncome,294000);assert.equal(next.household.oneOffIncome,0);
 const tax=C.individualTaxBreakdown(50000,{financialYear:C.financialYearForCalendarYear(2027)});
 assert.equal(sale.people[0].totalTaxableIncome,50000);assert.equal(sale.people[0].incomeTax,tax.incomeTax);assert.equal(sale.people[0].medicareLevy,tax.medicareLevy);
 assert.equal(sale.people[0].totalCashIncomeBeforeTax,0,'CGT gain is taxable but never extra cash');
 assert.equal(sale.household.totalAccessibleAssets,opening.household.totalAccessibleAssets+294000-tax.incomeTax-tax.medicareLevy-sale.people[0].medicareLevySurcharge);
 assert.equal(sale.household.totalNetWorth,sale.household.totalInvestableAssets);assert.equal(E.retainedAssetsAtYear(sale,false).assets.length,0);
 const view=U.buildSemiRetirementResultsViewModel(out.result,out.inputs,d),saved=U.buildSavedRetirementOutcome(view);
 assert.equal(saved.capital.assets.length,0);assert.equal(saved.assetSales[0].assetSaleId,'land');assert.match(view.assumptions.rows.find(r=>r.label.startsWith('Asset sale:')).value,/linked loans repaid/);
});

test('rental sale settles opening linked debt and stops cash rent, taxable rent and loan schedules',()=>{
 const d=draft({rental:true,debt:100000,joint:true}),out=project(d),[opening,sale,next]=out.result.years;
 assert.equal(opening.propertyIncome[0].rentalCashIncome,12000);assert.equal(sale.propertyIncome.length,0);assert.equal(sale.passiveIncome.filter(r=>r.type==='rentalTaxableIncome').length,0);
 assert.equal(sale.household.assetSales[0].linkedDebtRepaid,100000);assert.equal(sale.household.oneOffIncome,194000);
 for(const row of [sale,next]){assert.equal(row.liabilities[0].closingBalance,0);assert.equal(row.liabilities[0].interestCharged,0);assert.equal(row.liabilities[0].totalRepayment,0);assert.equal(row.household.totalPropertyDebt,0);assert.equal(row.household.totalPropertyValue,0);}
 assert.equal(sale.people[0].totalTaxableIncome,50000);assert.equal(sale.people[1].totalTaxableIncome,30000);assert.equal(next.people[0].totalTaxableIncome,0);
 assert.equal(out.result.summary.debtPayoffMilestones.filter(m=>m.liabilityId==='loan').length,1);
});

test('indirect stable loan/rental links settle; unrelated loans and similarly named assets stay',()=>{
 const d=draft({rental:true,debt:100000});d.liabilities[0].linkedAssetId='';d.liabilities[0].linkedRentalIncomeId='rent';d.assets.push({...d.assets[0],id:'other',name:d.assets[0].name});
 d.liabilities.push({...d.liabilities[0],id:'other-loan',linkedAssetId:'other',linkedRentalIncomeId:'',openingBalance:50000});
 const sale=project(d).result.years[1];assert.equal(sale.household.assetSales[0].linkedDebtRepaid,100000);assert.deepEqual(Array.from(sale.assets,a=>a.id),['other']);assert.equal(sale.liabilities.find(d=>d.id==='other-loan').closingBalance,50000);
});

test('negative equity settlement draws the shortfall once instead of manufacturing proceeds',()=>{
 const d=draft({debt:400000});d.scenario.oneOffIncomeEvents[0].taxTreatment='exempt';const [before,sale,next]=project(d).result.years;
 assert.equal(sale.household.oneOffIncome,0);assert.equal(sale.household.assetSaleFundingShortfall,106000);assert.equal(sale.household.totalDebt,0);assert.equal(sale.household.totalAccessibleAssets,0);assert.ok(sale.household.unmetSpending>=6000);assert.equal(next.household.assetSaleFundingShortfall,undefined);
 assert.equal(before.household.totalAccessibleAssets,100000);
});

test('sale proceeds inflate once, cost percentage follows gross, taxable gains stay in sale-year dollars',()=>{
 const d=draft();d.assumptions.inflationRatePct=2.5;const sale=project(d).result.years[1].household.assetSales[0];
 assert.equal(sale.grossProceeds,307500);assert.equal(sale.sellingCosts,6150);assert.equal(sale.taxableCapitalGainPerson1,50000);
 assert.equal(c.FFSDollarBasis.displayedValue(sale.netBeforeTax,1,2.5,'today'),294000);
});

test('duplicate, home, missing and incomplete tax instructions fail validation',()=>{
 for(const mutate of [
  d=>d.scenario.oneOffIncomeEvents.push({...d.scenario.oneOffIncomeEvents[0],id:'twice',year:2028}),
  d=>d.assets[0].type='home',d=>d.scenario.oneOffIncomeEvents[0].assetSaleId='missing',
  d=>d.scenario.oneOffIncomeEvents[0].taxTreatment='',d=>delete d.scenario.oneOffIncomeEvents[0].taxableCapitalGainPerson1,
  d=>d.scenario.oneOffIncomeEvents[0].sellingCostPct=101,
 ]){const d=draft();mutate(d);assert.ok(invalid(d).length);}
});

test('Age Pension assesses remaining cash and assets after the sale, with no duplicate property',()=>{
 const d=draft();d.scenario.agePension={enabled:true};d.scenario.oneOffIncomeEvents[0].taxTreatment='exempt';
 const out=project(d),row=out.result.years[1];assert.ok(row.household.agePension);assert.equal(row.assets.length,0);assert.equal(row.household.assetSales[0].netBeforeTax,294000);
 const noSale=clone(d);noSale.scenario.oneOffIncomeEvents=[];const baseline=project(noSale).result.years[1];
 assert.ok(row.household.agePension.assessableAssets < baseline.household.agePension.assessableAssets,'costs reduce assets; sold property must not also be assessed');
});

test('saved sale inputs round-trip without mutation, including nominal gains and explicit exemption',()=>{
 const d=draft({joint:true}),saved=clone(d),out=project(saved);const normal=U.normaliseOneOffIncomeEvents(saved.scenario.oneOffIncomeEvents)[0];
 assert.equal(normal.saleProceedsBasis,'gross');assert.equal(normal.taxableCapitalGainPerson2,30000);assert.equal(normal.sellingCostPct,2);
 const reopened=project(clone(saved));assert.equal(JSON.stringify(out.result),JSON.stringify(reopened.result));assert.equal(JSON.stringify(saved),JSON.stringify(d));
});

test('legacy rent linked only through the sold loan also ceases, including passive tax mapping',()=>{
 const d=draft({rental:true,debt:100000});d.propertyIncome[0].linkedAssetId='';d.passiveIncome.forEach(i=>i.linkedAssetId='');
 const sale=project(d).result.years[1];assert.equal(sale.propertyIncome.length,0);assert.equal(sale.people[0].rentalTaxableIncome,0);assert.equal(sale.people[0].totalTaxableIncome,50000);
});

test('sale repays the scheduled outstanding balance and prevents further interest or repayments',()=>{
 const d=draft({rental:true,debt:100000});Object.assign(d.liabilities[0],{interestRatePct:6,repaymentAmount:1000,repaymentFrequency:'monthly',repaymentType:'principalAndInterest'});
 const [before,sale,next]=project(d).result.years;assert.ok(before.liabilities[0].interestCharged>0);assert.ok(before.liabilities[0].totalRepayment>0);
 assert.equal(sale.household.assetSales[0].linkedDebtRepaid,before.liabilities[0].closingBalance);assert.equal(sale.liabilities[0].totalRepayment,0);assert.equal(sale.liabilities[0].interestCharged,0);assert.equal(next.liabilities[0].interestCharged,0);
});

test('capital-gain allocation must respect sole ownership after a plan ownership edit',()=>{
 const d=draft({joint:true});d.assets[0].owner='person1';assert.ok(invalid(d).some(e=>e.path.endsWith('taxableCapitalGainPerson2')));
 d.scenario.oneOffIncomeEvents[0].taxableCapitalGainPerson2=0;assert.equal(project(d).result.years[1].people[1].totalTaxableIncome,0);
});

for (const rental of [false, true]) {
 for (const type of ['homeLoan', 'mortgage', 'investmentLoan', 'otherDebt', 'rentalPropertyLoan']) {
  test(`${rental ? 'investment property' : 'vacant land'} sale leaves unrelated unlinked ${type} untouched`,()=>{
   const d=draft({rental});
   d.assets.push({id:'home',name:'Principal residence',type:'home',openingValue:500000,annualGrowthRatePct:0,ownershipPercent:100});
   d.liabilities.push({id:'unrelated',name:'Separate home loan',type,openingBalance:200000,interestRatePct:6,repaymentAmount:1500,repaymentFrequency:'monthly',remainingTermYears:30,repaymentType:'principalAndInterest'});
   const before=JSON.stringify(d),baseline=clone(d);baseline.scenario.oneOffIncomeEvents=[];
   const ordinary=project(baseline).result,withSale=project(d).result;
   assert.equal(JSON.stringify(d),before);
   const sale=withSale.years[1].household.assetSales[0];assert.equal(sale.linkedDebtRepaid,0);assert.deepEqual(Array.from(sale.linkedLoanIds),[]);assert.equal(sale.netBeforeTax,294000);
   assert.deepEqual(clone(withSale.years.map(row=>row.liabilities)),clone(ordinary.years.map(row=>row.liabilities)),'balances, interest and repayments follow the unchanged loan schedule');
   assert.ok(withSale.years[1].liabilities[0].closingBalance>0);
   assert.ok(!withSale.summary.debtPayoffMilestones.some(m=>m.liabilityId==='unrelated'));
  });
 }
}

for (const directConflict of [false,true]) test(`conflicting sale-linked debt requires correction (direct conflict=${directConflict})`,()=>{
 const d=draft({rental:true,debt:100000});
 d.assets.push({...d.assets[0],id:'other',name:'Other property'});
 d.liabilities[0].linkedAssetId=directConflict?'other':'';
 if(!directConflict)d.propertyIncome.push({...d.propertyIncome[0],id:'other-rent',name:'Other rent',linkedAssetId:'other',linkedLoanIds:['loan']});
 const errors=invalid(d);
 assert.ok(errors.some(e=>e.path==='scenario.oneOffIncomeEvents.0.assetSaleId'&&/Land loan/.test(e.message)),JSON.stringify(errors));
});

test('conflicting links wholly unrelated to the sale do not block a debt-free sale',()=>{
 const d=draft({rental:true,debt:100000});
 d.assets.push({...d.assets[0],id:'other',name:'Other property'},{...d.assets[0],id:'third',name:'Third property'});
 d.liabilities[0].linkedAssetId='other';d.propertyIncome[0].linkedAssetId='third';
 const sale=project(d).result.years[1];assert.equal(sale.household.assetSales[0].linkedDebtRepaid,0);assert.equal(sale.liabilities[0].closingBalance,100000);
});
