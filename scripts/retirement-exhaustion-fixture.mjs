import { readFileSync } from 'node:fs';
import vm from 'node:vm';
export function engine(root = new URL('../', import.meta.url)) {
  const context = { console }; context.globalThis = context;
  for (const file of ['calculator.js', 'semiRetirementProjection.js']) vm.runInNewContext(readFileSync(new URL(file, root), 'utf8'), context);
  return context.FFSSemiRetirementProjection;
}
export function fixture() {
  return {
    projectionStartYear: 2066, projectionEndAge: 90, inflationRate: 0,
    people: [{ id: 'person1', name: 'Example retiree', currentAge: 83, currentGrossEmploymentIncome: 0,
      hasSemiRetirement: false, fullRetirementAge: 60, superAccessAge: 60, openingSuperBalance: 170000,
      superReturnBeforeRetirement: .05, superReturnAfterRetirement: .05, superAnnualFeesRate: 0,
      employerSuperRate: 0, existingAdditionalConcessionalContributions: 0, stslOpeningBalance: 0, hasPrivateHealthCover: true }],
    accessibleInvestments: { openingBalance: 10000, annualReturnRate: .05, annualFeesRate: 0, currentAnnualContributions: 0 },
    household: { currentLifestyleSpending: 70000, semiRetirementLifestyleSpending: 70000, fullRetirementLifestyleSpending: 70000, otherAnnualIncome: 0, annualLoanPrincipalRepayments: 0 },
    scenario: { fullRetirementAnnualSpending: 70000, minimumAccessibleBalance: 0, minimumEstateBalanceAtEndAge: 0 },
    assets: [{ id: 'home', name: 'Home', type: 'home', openingValue: 1000000, annualGrowthRate: .03 }], liabilities: []
  };
}
export function trace(result) {
  return result.years.map(r => ({ year: r.calendarYear, age: r.person1Age, phase: r.householdPhase,
    accessibleOpening: r.household.accessibleReconciliation?.openingBalance,
    accessibleReturn: r.household.accessibleInvestmentEarnings,
    accessibleWithdrawal: r.household.totalAccessibleWithdrawal,
    accessibleClosing: r.household.closingAccessibleInvestmentBalance,
    superOpening: r.people.reduce((n,p)=>n+p.openingSuperBalance,0),
    superReturn: r.people.reduce((n,p)=>n+p.superInvestmentEarnings,0),
    superWithdrawal: r.household.totalSuperWithdrawal, superClosing: r.household.totalSuperBalance,
    netCashIncome: r.household.netHouseholdCashIncome, lifestyleSpending: r.household.totalProjectedLifestyleSpending,
    requiredPortfolioFunding: r.household.requiredTotalPortfolioWithdrawal + r.household.unmetSpending,
    funded: r.household.requiredTotalPortfolioWithdrawal, unfunded: r.household.unmetSpending }));
}
