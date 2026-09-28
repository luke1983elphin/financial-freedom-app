import { readFileSync } from 'node:fs';
import vm from 'node:vm';
export function load(root = new URL('../',import.meta.url)) {
  const c={console};c.globalThis=c;
  for(const file of ['calculator.js','semiRetirementProjection.js','semiRetirementUi.js']) vm.runInNewContext(readFileSync(new URL(file,root),'utf8'),c);
  return {CALC:c.FFSCalculator,ENGINE:c.FFSSemiRetirementProjection,UI:c.FFSSemiRetirementUi};
}
export function household(CALC) {
  const p=CALC.emptyPlan();
  Object.assign(p.personal,{person1Name:'Example',person1Age:43,person2Age:0,fullRetirementAge:65,targetAnnualSpending:40000});
  Object.assign(p.income,{person1HospitalCoverStatus:'full-year',person2HospitalCoverStatus:'full-year',dependantsHospitalCoverStatus:'full-year'});
  Object.assign(p.investing,{inflationPct:0,wageGrowthPct:0,expectedInvestmentReturnPct:0,expectedSuperReturnPct:0,annualInvestingTarget:12000});
  p.assetItems=[{id:'shares',category:'shares',value:100000},{id:'crypto',category:'crypto',value:50000},{id:'offset',category:'offset',value:190000},
    {id:'home',category:'home',value:800000,propertyGrowthRatePct:0},{id:'rental',category:'rentalInvestmentProperty',value:600000,propertyGrowthRatePct:0}];
  p.liabilityItems=[loan('home-loan','homeLoan','home',400000,30000),loan('rental-loan','rentalPropertyLoan','rental',250000,18000)];
  p.incomeItems=[{id:'salary',type:'salaryWages',owner:'person1',amount:100000,frequency:'annually'},
    {id:'rent',type:'rentalNetCashIncome',owner:'person1',amount:5000,rentalCashIncomeAnnual:20000,annualRentReceived:30000,
      annualPropertyExpensesExcludingPrincipal:10000,rentalCashflowTreatment:'beforeInterest',linkedAssetId:'rental',linkedLoanIds:['rental-loan']}];
  p.expenseItems=[{id:'living',category:'living',amount:40000,frequency:'annually'}];
  return p;
}
export function loan(id,type,linkedAssetId,balance,annualPayment,rate=0,repaymentType='principalAndInterest') {
  return {id,type,linkedAssetId,balance,repayment:annualPayment,repaymentFrequency:'annually',interestRatePct:rate,termYears:30,repaymentType};
}
