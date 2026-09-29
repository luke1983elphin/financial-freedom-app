import {load, loan} from './fi-cashflow-fixture.mjs';
export {load};
export function mortgagePlan(C) {
  const p=C.emptyPlan();
  Object.assign(p.personal,{person1Age:45,person2Age:0,fullRetirementAge:65,targetAnnualSpending:40000});
  Object.assign(p.investing,{annualInvestingTarget:6000,expectedInvestmentReturnPct:0,expectedSuperReturnPct:0,inflationPct:0});
  p.incomeItems=[{id:'salary',type:'salaryWages',owner:'person1',amount:80000,frequency:'annually'}];
  p.expenseItems=[{id:'living',category:'living',amount:40000,frequency:'annually'}];
  Object.assign(p.liabilities,{homeLoanBalance:18000,monthlyRepayment:1000,homeLoanInterestRatePct:0,remainingLoanTermYears:10});
  return p;
}
export function couplePlan(C) {
  const p=C.emptyPlan();
  Object.assign(p.personal,{person1Name:'A',person2Name:'B',person1Age:58,person2Age:55,fullRetirementAge:65,targetAnnualSpending:40000});
  Object.assign(p.assets,{superPerson1:300000,superPerson2:250000,cash:100000});
  Object.assign(p.investing,{expectedSuperReturnPct:0,expectedInvestmentReturnPct:0,inflationPct:0,annualInvestingTarget:0});
  return p;
}
export function debtPlans(C) {
  const base=()=>{const p=mortgagePlan(C);p.liabilities.homeLoanBalance=99000;return p;};
  const active=base();active.liabilityItems=[loan('h','homeLoan','home',12000,1200)];
  const zero=base();zero.liabilityItems=[loan('h','homeLoan','home',0,0)];
  const inactive=base();inactive.liabilityItems=[{...loan('h','homeLoan','home',12000,1200),active:false}];
  const absent=base();absent.planSchemaVersion=1;absent.liabilityItems=[];
  const rental=base();rental.liabilities.homeLoanBalance=0;rental.liabilities.otherDebts=75000;
  rental.liabilityItems=[{...loan('r','rentalPropertyLoan','rent',75000,9000),deleted:true}];
  const legacy=base();
  return {active,zero,inactive,absent,rental,legacy};
}
