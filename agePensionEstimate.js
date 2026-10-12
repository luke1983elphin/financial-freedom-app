/* Indicative annual Australian Age Pension. Pure, opt-in, normal domestic rates.
 * Source register and modelling limits: docs/AGE-PENSION.md. */
(function attachAgePension(global) {
  "use strict";
  const round = value => Math.round(value * 100) / 100;
  const positive = value => Math.max(0, Number(value) || 0);
  const RATES = Object.freeze({
    effectiveFrom: "2026-09-20", verifiedOn: "2026-10-13", pensionAge: 67,
    maximumAnnualSingle: 1237.70 * 26, maximumAnnualCoupleEach: 933 * 26,
    energyAnnualSingle: 14.10 * 26, energyAnnualCoupleEach: 10.60 * 26,
    taxExemptAnnualSingle: round((88.20 - 30.70 + 14.10) * 26),
    taxExemptAnnualCoupleEach: round((66.50 - 25.30 + 10.60) * 26),
    assetFreeAreaSingleHomeowner: 333000, assetFreeAreaSingleNonHomeowner: 600000,
    assetFreeAreaCoupleHomeowner: 499000, assetFreeAreaCoupleNonHomeowner: 766000,
    annualAssetTaperPerThousandSingle: 78, annualAssetTaperPerThousandCoupleEach: 39,
    incomeFreeAreaSingleAnnual: 226 * 26, incomeFreeAreaCoupleAnnual: 396 * 26,
    incomeTaperSingle: 0.5, incomeTaperCoupleEach: 0.25,
    deemingThresholdSingle: 66800, deemingThresholdCouple: 110600,
    deemingLowerRate: 0.0175, deemingUpperRate: 0.0375, workBonusAnnual: 300 * 26,
  });
  // Only these monetary thresholds are indexed. Percentages, tapers, age,
  // Energy Supplement and Work Bonus are fixed policy parameters.
  const INDEXED_THRESHOLDS = Object.freeze([
    "assetFreeAreaSingleHomeowner", "assetFreeAreaSingleNonHomeowner",
    "assetFreeAreaCoupleHomeowner", "assetFreeAreaCoupleNonHomeowner",
    "incomeFreeAreaSingleAnnual", "incomeFreeAreaCoupleAnnual",
    "deemingThresholdSingle", "deemingThresholdCouple",
  ]);
  function validateRates(rates) {
    if (!rates?.effectiveFrom || Object.keys(RATES).some(key => typeof RATES[key] === "number"
      && (!Number.isFinite(rates[key]) || rates[key] < 0))) throw new Error("A dated, complete Age Pension rate schedule is required.");
  }
  function ratesForProjectionYear(calendarYear, annualIndexationRate, base = RATES) {
    validateRates(base);
    if (!Number.isInteger(calendarYear) || !Number.isFinite(annualIndexationRate) || annualIndexationRate < -1) {
      throw new Error("Age Pension indexation requires a calendar year and finite scenario CPI.");
    }
    const years = Math.max(0, calendarYear - Number(base.effectiveFrom.slice(0, 4)));
    // No nominal reductions. This annual CPI proxy is not the statutory
    // March/September CPI/PBLCI and wages benchmark or July threshold rounding.
    const rate = Math.max(0, annualIndexationRate);
    const factor = (1 + rate) ** years;
    const projected = { ...base, projectionYear: calendarYear, annualIndexationRate: rate, indexationYears: years };
    for (const key of INDEXED_THRESHOLDS) projected[key] = round(base[key] * factor);
    for (const suffix of ["Single", "CoupleEach"]) {
      const energy = base[`energyAnnual${suffix}`];
      projected[`maximumAnnual${suffix}`] = round((base[`maximumAnnual${suffix}`] - energy) * factor + energy);
      projected[`taxExemptAnnual${suffix}`] = round((base[`taxExemptAnnual${suffix}`] - energy) * factor + energy);
    }
    validateRates(projected);
    return Object.freeze(projected);
  }
  function deemedIncome(financialAssets, partnered, rates = RATES) {
    validateRates(rates);
    const threshold = partnered ? rates.deemingThresholdCouple : rates.deemingThresholdSingle;
    return round(Math.min(positive(financialAssets), threshold) * rates.deemingLowerRate
      + Math.max(0, positive(financialAssets) - threshold) * rates.deemingUpperRate);
  }
  function estimateAnnualPension(input = {}, rates = RATES) {
    validateRates(rates);
    const partnered = input.partnered === true;
    const ages = partnered ? [input.person1Age, input.person2Age] : [input.person1Age];
    if (ages.some(age => !Number.isFinite(age) || age < 0)
      || !Number.isFinite(input.assessableAssets) || input.assessableAssets < 0
      || !Number.isFinite(input.assessableAnnualIncome) || input.assessableAnnualIncome < 0
      || typeof input.homeowner !== "boolean" || input.hasComplexCentrelinkAssets) {
      return { annualPension: null, unsupported: true, reason: "Complete ordinary household assessment required; complex circumstances are not supported.", effectiveFrom: rates.effectiveFrom };
    }
    const eligibleCount = ages.filter(age => age >= rates.pensionAge).length;
    const maximumEach = partnered ? rates.maximumAnnualCoupleEach : rates.maximumAnnualSingle;
    const assetFree = rates[`assetFreeArea${partnered ? "Couple" : "Single"}${input.homeowner ? "Homeowner" : "NonHomeowner"}`];
    const assetTaper = partnered ? rates.annualAssetTaperPerThousandCoupleEach : rates.annualAssetTaperPerThousandSingle;
    const incomeFree = partnered ? rates.incomeFreeAreaCoupleAnnual : rates.incomeFreeAreaSingleAnnual;
    const incomeTaper = partnered ? rates.incomeTaperCoupleEach : rates.incomeTaperSingle;
    const assetEach = Math.max(0, maximumEach - Math.max(0, input.assessableAssets - assetFree) / 1000 * assetTaper);
    const incomeEach = Math.max(0, maximumEach - Math.max(0, input.assessableAnnualIncome - incomeFree) * incomeTaper);
    const pensionEach = round(Math.min(maximumEach, assetEach, incomeEach));
    return { annualPension: round(pensionEach * eligibleCount), pensionEach: eligibleCount ? pensionEach : 0,
      taxableEach: eligibleCount ? round(Math.max(0, pensionEach - (partnered ? rates.taxExemptAnnualCoupleEach : rates.taxExemptAnnualSingle))) : 0,
      assetTestAnnual: round(assetEach * eligibleCount), incomeTestAnnual: round(incomeEach * eligibleCount),
      eligibleCount, effectiveFrom: rates.effectiveFrom, indicativeOnly: true };
  }
  const isHome = asset => ["home", "principalResidence", "principal_residence"].includes(asset.type);
  function assessProjectionYear({ people, assets, liabilities, accessibleBalance, otherIncome = 0, rentalIncome = 0,
    incomeStreamSuper = false, unsupported = false, calendarYear = 2026, annualIndexationRate = 0 }) {
    const rates = ratesForProjectionYear(calendarYear, annualIndexationRate);
    const partnered = people.length === 2;
    const superAssets = people.reduce((sum, person) => sum + (person.age >= rates.pensionAge || incomeStreamSuper
      ? positive(person.openingSuperBalance) + positive(person.downsizerSuperContribution) : 0), 0);
    const financialAssets = positive(accessibleBalance) + superAssets;
    // The aggregate accessible balance already includes cash, offsets and investments.
    const otherAssets = assets.filter(asset => !asset.isAccessibleAsset && !isHome(asset) && asset.type !== "super")
      .reduce((sum, asset) => sum + Math.max(0, positive(asset.openingValue)
        - liabilities.filter(debt => debt.linkedAssetId === asset.id).reduce((n, debt) => n + positive(debt.openingBalance), 0)), 0);
    const employmentIncome = people.reduce((sum, person) => sum + Math.max(0, positive(person.grossEmploymentIncome)
      - (person.age >= rates.pensionAge ? rates.workBonusAnnual : 0)), 0);
    const deemedAnnualIncome = deemedIncome(financialAssets, partnered, rates);
    const assessableAssets = round(financialAssets + otherAssets);
    const assessableAnnualIncome = round(deemedAnnualIncome + employmentIncome + positive(otherIncome) + positive(rentalIncome));
    return { ...estimateAnnualPension({ partnered, person1Age: people[0]?.age, person2Age: people[1]?.age,
      homeowner: assets.some(isHome), assessableAssets, assessableAnnualIncome,
      hasComplexCentrelinkAssets: unsupported || assets.some(asset => /trust|company|business/i.test(asset.type)) }, rates),
      assessableAssets, assessableAnnualIncome, deemedAnnualIncome, financialAssets, rates };
  }
  // Income Tax Assessment (1936 Act) Regulations 2025, ss 9–12.
  // The $445, $37,000 and 1.5% constants are statutory SAPTO formula inputs,
  // not the current LITO. Do not replace them with current LITO settings.
  function saptoThreshold(base, financialYear) {
    const config = global.FFSCalculator.resolveFinancialYearConfig(financialYear).config;
    if (!config) throw new Error("Unsupported SAPTO tax year.");
    const [, first, second] = config.taxBrackets;
    let threshold = first.threshold + (445 + base) / first.rate;
    if (threshold > 37000) threshold = (first.threshold * first.rate + 445 + base
      + 37000 * (0.015 + second.rate - first.rate)) / (0.015 + second.rate);
    return Math.ceil(threshold);
  }
  function estimateSapto(people, financialYear) {
    if (!Array.isArray(people) || people.length < 1 || people.length > 2) throw new Error("SAPTO requires one or two people.");
    const partnered = people.length === 2, base = partnered ? 1602 : 2230;
    const threshold = saptoThreshold(base, financialYear);
    const cutoff = Math.ceil(threshold + base / 0.125);
    const rows = people.map(person => {
      const taxableIncome = positive(person.taxableIncome);
      const rebateIncome = round(taxableIncome + positive(person.reportableSuperContributions)
        + positive(person.netInvestmentLoss) + positive(person.adjustedFringeBenefits));
      const tax = global.FFSCalculator.individualTaxBreakdown(taxableIncome, { financialYear });
      return { taxableIncome, rebateIncome, eligible: person.eligible === true, tax,
        baseRebate: base, transferredBaseReceived: 0, transferredBaseGiven: 0, baseReduction: 0 };
    });
    const combined = rows.reduce((sum, row) => sum + row.rebateIncome, 0);
    for (const row of rows) row.eligible = row.eligible && (partnered ? combined < 2 * cutoff : row.rebateIncome < cutoff);
    if (partnered && rows.every(row => row.eligible)) {
      for (const [index, donor] of rows.entries()) {
        const receiver = rows[1 - index];
        // Transfer changes the recipient's base AND rebate threshold. It is
        // not simply their spouse's offset remaining after LITO.
        if (donor.tax.incomeTaxBeforeOffsets < base && receiver.rebateIncome > threshold) {
          const transfer = round(Math.max(0, base - Math.max(0, donor.taxableIncome - 6000) * 0.15));
          donor.transferredBaseGiven = transfer;
          donor.baseReduction = round(base - donor.tax.incomeTaxBeforeOffsets);
          receiver.transferredBaseReceived = transfer;
        }
      }
    }
    return rows.map(row => {
      const adjustedBase = row.baseRebate + row.transferredBaseReceived - row.baseReduction;
      const adjustedThreshold = saptoThreshold(adjustedBase, financialYear);
      const entitlement = row.eligible ? round(Math.max(0, adjustedBase - Math.max(0, row.rebateIncome - adjustedThreshold) * 0.125)) : 0;
      const applied = round(Math.min(row.tax.incomeTax, entitlement));
      return { eligible: row.eligible, rebateIncome: row.rebateIncome, combinedRebateIncome: combined,
        entitlement, applied, transferredBaseReceived: row.transferredBaseReceived,
        transferredBaseGiven: row.transferredBaseGiven, rebateThreshold: adjustedThreshold,
        individualCutoff: cutoff, incomeTaxBeforeSapto: row.tax.incomeTax,
        incomeTax: round(Math.max(0, row.tax.incomeTax - applied)) };
    });
  }
  global.FFSAgePension = Object.freeze({ RATES, INDEXED_THRESHOLDS, validateRates, ratesForProjectionYear, deemedIncome, estimateAnnualPension, assessProjectionYear, saptoThreshold, estimateSapto });
})(globalThis);
