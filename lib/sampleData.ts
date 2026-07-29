import type { HouseholdModel } from "./types.ts";

export const sampleHousehold: HouseholdModel = {
  householdName: "James and Sarah",
  people: [
    { name: "James", age: 42 },
    { name: "Sarah", age: 41 },
  ],
  goals: {
    workOptionalAge: 50,
    semiRetirementAge: 55,
    fullRetirementAge: 60,
    targetAnnualSpending: 90000,
  },
  assets: [
    { id: "home", name: "Home", category: "home", value: 900000 },
    { id: "offset", name: "Offset account", category: "offset", value: 90000 },
    { id: "shares", name: "Shares and ETFs", category: "shares", value: 70000 },
    { id: "crypto", name: "Crypto", category: "crypto", value: 10000 },
    { id: "super", name: "Combined super", category: "super", value: 240000 },
    { id: "vehicles", name: "Vehicles", category: "vehicle", value: 30000 },
  ],
  loans: [
    {
      id: "home-loan",
      name: "Home loan",
      type: "homeLoan",
      principal: 550000,
      annualInterestRate: 0.061,
      monthlyRepayment: 3400,
      termYears: 30,
      offsetBalance: 90000,
    },
  ],
  incomes: [
    { id: "james-income", name: "James net income", amount: 2400, frequency: "fortnightly" },
    { id: "sarah-income", name: "Sarah net income", amount: 2300, frequency: "fortnightly" },
    { id: "other-income", name: "Other Income", amount: 5000, frequency: "annually" },
  ],
  expenses: [
    { id: "living", name: "Living costs", amount: 4000, frequency: "monthly" },
    { id: "food", name: "Food", amount: 300, frequency: "weekly" },
    { id: "utilities", name: "Utilities", amount: 4000, frequency: "annually" },
    { id: "insurance", name: "Insurance", amount: 2500, frequency: "annually" },
    { id: "school", name: "School / kids", amount: 3000, frequency: "annually" },
    { id: "rates", name: "Rates / property costs", amount: 4000, frequency: "annually" },
  ],
  investing: {
    annualInvestingTarget: 30000,
    annualEmployerSuper: 22000,
    annualExtraSuper: 0,
  },
  assumptions: {
    modelStartDate: "2026-07-01",
    expectedInvestmentReturn: 0.08,
    expectedSuperReturn: 0.08,
    propertyGrowth: 0.03,
    inflation: 0.025,
    safeWithdrawalRate: 0.04,
    taxRate: 0.345,
    concessionalSuperTaxRate: 0.15,
    preservationAge: 60,
    retirementAge: 60,
    liquidityPreference: "medium",
  },
};
