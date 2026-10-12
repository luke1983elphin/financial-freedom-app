/* Optional Age Pension estimate — isolated from the retirement engine.
 * Not connected to production forecasts until validated and explicitly enabled.
 * Rates must be supplied from a dated, verified Services Australia schedule.
 */
(function attachAgePension(global) {
  "use strict";
  const money = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  const finite = (value) => Number.isFinite(value) && value >= 0;
  function validateRates(rates) {
    const required = ["pensionAge", "maximumAnnualSingle", "maximumAnnualCoupleEach",
      "assetFreeAreaSingleHomeowner", "assetFreeAreaCoupleHomeowner",
      "assetFreeAreaSingleNonHomeowner", "assetFreeAreaCoupleNonHomeowner",
      "annualAssetTaperPerThousandSingle", "annualAssetTaperPerThousandCouple",
      "incomeFreeAreaSingleAnnual", "incomeFreeAreaCoupleAnnual",
      "incomeTaperSingle", "incomeTaperCouple"];
    if (!rates || !rates.effectiveFrom || required.some((key) => !finite(rates[key]))) {
      throw new Error("Age Pension requires a verified, dated rates schedule.");
    }
  }
  function estimateAnnualPension(input, rates) {
    validateRates(rates);
    const household = input || {};
    const partnered = Boolean(household.partnered);
    const eligibleCount = partnered
      ? [household.person1Age, household.person2Age].filter((age) => Number(age) >= rates.pensionAge).length
      : (Number(household.person1Age) >= rates.pensionAge ? 1 : 0);
    if (!eligibleCount) return { annualPension: 0, assetTestAnnual: 0, incomeTestAnnual: 0, eligibleCount: 0, effectiveFrom: rates.effectiveFrom };
    if (household.hasComplexCentrelinkAssets) {
      return { annualPension: null, eligibleCount, unsupported: true, reason: "Complex Centrelink asset attribution requires specialist assessment.", effectiveFrom: rates.effectiveFrom };
    }
    const maximum = partnered ? rates.maximumAnnualCoupleEach * eligibleCount : rates.maximumAnnualSingle;
    const assetFree = partnered
      ? (household.homeowner ? rates.assetFreeAreaCoupleHomeowner : rates.assetFreeAreaCoupleNonHomeowner)
      : (household.homeowner ? rates.assetFreeAreaSingleHomeowner : rates.assetFreeAreaSingleNonHomeowner);
    const assetTaper = partnered ? rates.annualAssetTaperPerThousandCouple : rates.annualAssetTaperPerThousandSingle;
    const incomeFree = partnered ? rates.incomeFreeAreaCoupleAnnual : rates.incomeFreeAreaSingleAnnual;
    const incomeTaper = partnered ? rates.incomeTaperCouple : rates.incomeTaperSingle;
    // Caller must supply Centrelink-assessable assets and income, after exclusions/deeming.
    // Never substitute portfolio returns for Centrelink deemed income.
    if (!finite(household.assessableAssets) || !finite(household.assessableAnnualIncome)) {
      return { annualPension: null, eligibleCount, unsupported: true, reason: "Centrelink-assessable assets and income are required.", effectiveFrom: rates.effectiveFrom };
    }
    const assetTestAnnual = Math.max(0, maximum - Math.max(0, household.assessableAssets - assetFree) / 1000 * assetTaper);
    const incomeTestAnnual = Math.max(0, maximum - Math.max(0, household.assessableAnnualIncome - incomeFree) * incomeTaper);
    return { annualPension: Math.round(Math.min(maximum, assetTestAnnual, incomeTestAnnual) * 100) / 100,
      assetTestAnnual, incomeTestAnnual, eligibleCount, effectiveFrom: rates.effectiveFrom,
      indicativeOnly: true };
  }
  global.FFSAgePension = Object.freeze({ estimateAnnualPension, validateRates });
})(globalThis);
