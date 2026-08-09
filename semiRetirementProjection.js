(function attachSemiRetirementProjection(global) {
  const CALC = global.FFSCalculator || {};
  function developmentFlagFromLocation() {
    try {
      const params = new URLSearchParams(global.location?.search || "");
      return params.get("semiRetirementProjection") === "1";
    } catch (error) {
      return false;
    }
  }

  const FEATURE_FLAGS = {
    semiRetirementProjectionEnabled: Boolean(global.FFS_ENABLE_SEMI_RETIREMENT_PROJECTION || developmentFlagFromLocation()),
  };
  const DEFAULT_CONTRIBUTIONS_TAX_RATE = 0.15;
  const DEFAULT_EMPLOYER_SUPER_RATE = 0.12;
  const DEFAULT_FINANCIAL_YEAR = CALC.FINANCIAL_YEAR || "2026-27";
  const DEFAULT_FINANCIAL_YEAR_CONFIG = CALC.financialYearConfigs?.[DEFAULT_FINANCIAL_YEAR] || {};
  const DEFAULT_MAXIMUM_CONTRIBUTION_BASE = DEFAULT_FINANCIAL_YEAR_CONFIG.employerSuperMaximumContributionBase || 0;

  function hasFiniteNumber(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundCurrency(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function roundRatio(value) {
    return Math.round((number(value) + Number.EPSILON) * 10000) / 10000;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function inflationFactor(rate, yearIndex) {
    return Math.pow(1 + number(rate), Math.max(0, yearIndex));
  }

  function grownAmount(amount, growthRate, yearIndex) {
    return roundCurrency(number(amount) * inflationFactor(growthRate, yearIndex));
  }

  function todayDollarAmount(amount, inflationRate, yearIndex) {
    return roundCurrency(number(amount) * inflationFactor(inflationRate, yearIndex));
  }

  function emptyMilestone() {
    return {
      calendarYear: null,
      person1Age: null,
      person2Age: null,
    };
  }

  function milestoneForYear(calendarYear, peopleYear) {
    return {
      calendarYear,
      person1Age: peopleYear[0]?.age ?? null,
      person2Age: peopleYear[1]?.age ?? null,
    };
  }

  function emptyRetirementMilestone() {
    return {
      ...emptyMilestone(),
      retiredPersonIds: [],
    };
  }

  function retirementMilestoneForYear(calendarYear, peopleYear, retiredPersonIds) {
    return {
      ...milestoneForYear(calendarYear, peopleYear),
      retiredPersonIds: retiredPersonIds.slice(),
    };
  }

  function milestoneIsUnset(milestone) {
    return !milestone || milestone.calendarYear === null;
  }

  function defaultSummary() {
    return {
      accessibleBalanceAtFirstPersonFullRetirement: null,
      // Deprecated alias retained temporarily for consumers that still read the Stage 1 field.
      accessibleBalanceAtFirstFullRetirement: null,
      accessibleBalanceWhenBothFullyRetired: null,
      totalSuperAtAge60: null,
      superByPersonAtAge60: { person1: null, person2: null },
      superByPersonAtAccessAge: {},
      totalInvestableAssetsAtFullRetirement: null,
      accessibleFundsExhausted: emptyMilestone(),
      accessibleFundsExhaustedAge: null,
      accessibleFundsExhaustedYear: null,
      allRetirementFundsExhausted: emptyMilestone(),
      allRetirementFundsExhaustedAge: null,
      allRetirementFundsExhaustedYear: null,
      firstUnfundedSpending: emptyMilestone(),
      firstUnfundedSpendingAge: null,
      firstUnfundedSpendingYear: null,
      firstPersonFullRetirement: emptyRetirementMilestone(),
      householdFullRetirement: emptyMilestone(),
      // Deprecated alias retained temporarily for the Stage 1A household-full-retirement milestone.
      firstFullRetirement: emptyMilestone(),
      firstYearAllPeopleSuperAccessible: emptyMilestone(),
      totalUnfundedSpending: 0,
      accessibleBalanceAtEndAge: 0,
      superBalanceAtEndAge: 0,
      totalInvestableAssetsAtEndAge: 0,
      minimumEstateBalanceTarget: 0,
      minimumEstateBalanceShortfallAtEndAge: 0,
      meetsMinimumEstateBalanceAtEndAge: true,
      totalPlannedSemiRetirementWithdrawals: 0,
      totalRetirementWithdrawals: 0,
    };
  }

  function employmentPhaseForAge(person, age) {
    if (age >= person.fullRetirementAge) return "fully-retired";
    if (person.hasSemiRetirement && age >= person.semiRetirementAge) return "semi-retired";
    return "full-time";
  }

  function isSemiRetirementYear(peopleYear) {
    return householdPhase(peopleYear) === "semi-retirement";
  }

  function householdPhase(peopleYear) {
    if (peopleYear.every((person) => person.employmentPhase === "fully-retired")) return "full-retirement";
    if (peopleYear.every((person) => person.employmentPhase === "full-time")) return "working";
    return "semi-retirement";
  }

  function normalisePerson(person, index) {
    const id = String(person?.id || `person${index + 1}`);
    const currentAge = number(person?.currentAge);
    const fullRetirementAge = number(person?.fullRetirementAge);
    const hasSemiRetirement = hasFiniteNumber(person?.semiRetirementAge)
      && number(person.semiRetirementAge) < fullRetirementAge;
    const semiRetirementAge = hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge;
    return {
      id,
      name: String(person?.name || `Person ${index + 1}`),
      currentAge,
      currentGrossEmploymentIncome: number(person?.currentGrossEmploymentIncome),
      annualIncomeGrowthRate: number(person?.annualIncomeGrowthRate),
      semiRetirementAge,
      hasSemiRetirement,
      semiRetirementGrossIncome: hasSemiRetirement ? number(person?.semiRetirementGrossIncome) : 0,
      fullRetirementAge,
      superAccessAge: number(person?.superAccessAge),
      openingSuperBalance: number(person?.openingSuperBalance),
      superReturnBeforeRetirement: number(person?.superReturnBeforeRetirement),
      superReturnAfterRetirement: number(person?.superReturnAfterRetirement),
      superAnnualFeesRate: number(person?.superAnnualFeesRate),
      employerSuperRate: hasFiniteNumber(person?.employerSuperRate)
        ? number(person.employerSuperRate)
        : DEFAULT_EMPLOYER_SUPER_RATE,
      existingAdditionalConcessionalContributions: number(person?.existingAdditionalConcessionalContributions),
      additionalContributionsStopAge: hasFiniteNumber(person?.additionalContributionsStopAge)
        ? number(person.additionalContributionsStopAge)
        : fullRetirementAge,
      stslOpeningBalance: number(person?.stslOpeningBalance),
      hasPrivateHealthCover: person?.hasPrivateHealthCover !== false,
    };
  }

  function normaliseWithdrawalOrder(value) {
    if (value === undefined || value === null || value === "") return "accessible-first";
    if (value === "accessible-first") return "accessible-first";
    if (Array.isArray(value) && value.length === 2 && value[0] === "accessible" && value[1] === "super") {
      return "accessible-first";
    }
    return value;
  }

  function normaliseInputs(input) {
    const people = Array.isArray(input?.people) ? input.people.map(normalisePerson) : [];
    const externalAccessibleContribution = hasFiniteNumber(input?.accessibleInvestments?.externalAnnualAccessibleContribution)
      ? number(input.accessibleInvestments.externalAnnualAccessibleContribution)
      : number(input?.accessibleInvestments?.currentAnnualContributions);
    return {
      projectionStartYear: Math.round(number(input?.projectionStartYear)),
      projectionEndAge: number(input?.projectionEndAge),
      inflationRate: number(input?.inflationRate),
      household: {
        currentLifestyleSpending: number(input?.household?.currentLifestyleSpending),
        semiRetirementLifestyleSpending: number(input?.household?.semiRetirementLifestyleSpending),
        fullRetirementLifestyleSpending: number(input?.household?.fullRetirementLifestyleSpending),
        spendingAmountsAreInTodaysDollars: true,
        otherAnnualIncome: number(input?.household?.otherAnnualIncome),
        annualLoanPrincipalRepayments: number(input?.household?.annualLoanPrincipalRepayments),
      },
      accessibleInvestments: {
        openingBalance: number(input?.accessibleInvestments?.openingBalance),
        annualReturnRate: number(input?.accessibleInvestments?.annualReturnRate),
        annualFeesRate: number(input?.accessibleInvestments?.annualFeesRate),
        externalAnnualAccessibleContribution: externalAccessibleContribution,
        currentAnnualContributions: externalAccessibleContribution,
      },
      people,
      scenario: {
        semiRetirementAccessibleWithdrawal: number(input?.scenario?.semiRetirementAccessibleWithdrawal),
        fullRetirementAnnualSpending: number(input?.scenario?.fullRetirementAnnualSpending),
        minimumAccessibleBalance: number(input?.scenario?.minimumAccessibleBalance),
        minimumEstateBalanceAtEndAge: number(input?.scenario?.minimumEstateBalanceAtEndAge),
        withdrawalOrder: normaliseWithdrawalOrder(input?.scenario?.withdrawalOrder),
        superWithdrawalOrder: Array.isArray(input?.scenario?.superWithdrawalOrder)
          ? input.scenario.superWithdrawalOrder.slice()
          : null,
      },
    };
  }

  function addValidation(errors, path, message) {
    errors.push({ path, message });
  }

  function validateInputs(input) {
    const errors = [];
    if (!input || typeof input !== "object") {
      addValidation(errors, "inputs", "Projection inputs must be provided as an object.");
      return errors;
    }
    if (!hasFiniteNumber(input.projectionStartYear)) addValidation(errors, "projectionStartYear", "Projection start year is required.");
    if (!hasFiniteNumber(input.projectionEndAge)) addValidation(errors, "projectionEndAge", "Projection end age is required.");
    if (!hasFiniteNumber(input.inflationRate)) addValidation(errors, "inflationRate", "Inflation rate is required.");
    const rateChecks = [
      ["inflationRate", input.inflationRate],
      ["accessibleInvestments.annualReturnRate", input.accessibleInvestments?.annualReturnRate],
      ["accessibleInvestments.annualFeesRate", input.accessibleInvestments?.annualFeesRate],
    ];
    rateChecks.forEach(([path, value]) => {
      if (hasFiniteNumber(value) && number(value) < -1) addValidation(errors, path, "Return or fee assumptions cannot be below -100%.");
    });

    [
      ["household.currentLifestyleSpending", input.household?.currentLifestyleSpending],
      ["household.semiRetirementLifestyleSpending", input.household?.semiRetirementLifestyleSpending],
      ["household.fullRetirementLifestyleSpending", input.household?.fullRetirementLifestyleSpending],
      ["household.otherAnnualIncome", input.household?.otherAnnualIncome],
      ["household.annualLoanPrincipalRepayments", input.household?.annualLoanPrincipalRepayments],
      ["accessibleInvestments.openingBalance", input.accessibleInvestments?.openingBalance],
      ["accessibleInvestments.currentAnnualContributions", input.accessibleInvestments?.currentAnnualContributions],
      ["accessibleInvestments.externalAnnualAccessibleContribution", input.accessibleInvestments?.externalAnnualAccessibleContribution],
      ["scenario.semiRetirementAccessibleWithdrawal", input.scenario?.semiRetirementAccessibleWithdrawal],
      ["scenario.minimumAccessibleBalance", input.scenario?.minimumAccessibleBalance],
    ].forEach(([path, value]) => {
      if (hasFiniteNumber(value) && number(value) < 0) addValidation(errors, path, "Negative amounts are not valid for this projection input.");
    });

    if (!Array.isArray(input.people) || input.people.length === 0) {
      addValidation(errors, "people", "At least one person is required.");
    }
    if (Array.isArray(input.people) && input.people.length > 2) {
      addValidation(errors, "people", "Stage 1 supports up to two people.");
    }
    const peopleArray = Array.isArray(input.people) ? input.people : [];
    const finiteCurrentAges = peopleArray
      .map((person) => person?.currentAge)
      .filter(hasFiniteNumber)
      .map(number);
    const youngestCurrentAge = finiteCurrentAges.length ? Math.min(...finiteCurrentAges) : null;
    const horizonYears = youngestCurrentAge !== null && hasFiniteNumber(input.projectionEndAge)
      ? Math.max(0, Math.ceil(number(input.projectionEndAge) - youngestCurrentAge))
      : null;
    const withdrawalOrder = normaliseWithdrawalOrder(input.scenario?.withdrawalOrder);
    if (withdrawalOrder !== "accessible-first") {
      addValidation(errors, "scenario.withdrawalOrder", "Stage 1A supports only the accessible-first withdrawal strategy.");
    }
    const ids = new Set();
    peopleArray.forEach((person, index) => {
      const prefix = `people.${index}`;
      const id = String(person?.id || `person${index + 1}`);
      if (ids.has(id)) addValidation(errors, `${prefix}.id`, "Duplicate person IDs are not valid.");
      ids.add(id);
      [
        ["currentAge", person?.currentAge],
        ["currentGrossEmploymentIncome", person?.currentGrossEmploymentIncome],
        ["fullRetirementAge", person?.fullRetirementAge],
        ["superAccessAge", person?.superAccessAge],
        ["openingSuperBalance", person?.openingSuperBalance],
      ].forEach(([field, value]) => {
        if (!hasFiniteNumber(value)) addValidation(errors, `${prefix}.${field}`, `${field} is required.`);
      });
      [
        ["currentGrossEmploymentIncome", person?.currentGrossEmploymentIncome],
        ["semiRetirementGrossIncome", person?.semiRetirementGrossIncome],
        ["openingSuperBalance", person?.openingSuperBalance],
        ["existingAdditionalConcessionalContributions", person?.existingAdditionalConcessionalContributions],
        ["stslOpeningBalance", person?.stslOpeningBalance],
      ].forEach(([field, value]) => {
        if (hasFiniteNumber(value) && number(value) < 0) addValidation(errors, `${prefix}.${field}`, "Negative amounts are not valid.");
      });
      [
        ["annualIncomeGrowthRate", person?.annualIncomeGrowthRate],
        ["superReturnBeforeRetirement", person?.superReturnBeforeRetirement],
        ["superReturnAfterRetirement", person?.superReturnAfterRetirement],
        ["superAnnualFeesRate", person?.superAnnualFeesRate],
        ["employerSuperRate", person?.employerSuperRate],
      ].forEach(([field, value]) => {
        if (hasFiniteNumber(value) && number(value) < -1) addValidation(errors, `${prefix}.${field}`, "Rate assumptions cannot be below -100%.");
      });
      const currentAge = number(person?.currentAge);
      const fullRetirementAge = number(person?.fullRetirementAge);
      const hasSemiAge = hasFiniteNumber(person?.semiRetirementAge);
      const semiRetirementAge = hasSemiAge ? number(person?.semiRetirementAge) : fullRetirementAge;
      if (hasSemiAge && semiRetirementAge < currentAge) addValidation(errors, `${prefix}.semiRetirementAge`, "Semi-retirement age cannot be below current age.");
      if (fullRetirementAge < semiRetirementAge) addValidation(errors, `${prefix}.fullRetirementAge`, "Full-retirement age cannot be below semi-retirement age.");
      if (hasFiniteNumber(person?.superAccessAge) && number(person.superAccessAge) < currentAge) addValidation(errors, `${prefix}.superAccessAge`, "Super access age cannot be below current age.");
      const finalAgeAtProjectionEnd = horizonYears !== null ? currentAge + horizonYears : null;
      if (finalAgeAtProjectionEnd !== null && finalAgeAtProjectionEnd < fullRetirementAge) {
        addValidation(errors, "projectionEndAge", "Projection end age leaves a person before their full-retirement age.");
      }
    });
    return errors;
  }

  function fallbackTaxBreakdown(income) {
    const taxable = Math.max(0, number(income));
    const incomeTax = taxable <= 18200 ? 0
      : taxable <= 45000 ? (taxable - 18200) * 0.15
        : taxable <= 135000 ? 4020 + (taxable - 45000) * 0.30
          : taxable <= 190000 ? 31020 + (taxable - 135000) * 0.37
            : 51370 + (taxable - 190000) * 0.45;
    return {
      incomeTax: roundCurrency(incomeTax),
      medicareLevy: roundCurrency(taxable * 0.02),
    };
  }

  function calculateMls(peopleYear, normalised) {
    if (typeof CALC.calculateMedicareLevySurcharge !== "function") {
      return { person1Surcharge: 0, person2Surcharge: 0, annualSurcharge: 0, warning: "Existing MLS helper was not available; MLS has been treated as zero." };
    }
    const p1 = peopleYear[0] || {};
    const p2 = peopleYear[1] || {};
    const hasPartner = Boolean(peopleYear[1]);
    const result = CALC.calculateMedicareLevySurcharge({
      person1TaxableIncome: p1.grossEmploymentIncome || 0,
      person2TaxableIncome: p2.grossEmploymentIncome || 0,
      person1MLSIncomeForThreshold: p1.grossEmploymentIncome || 0,
      person2MLSIncomeForThreshold: p2.grossEmploymentIncome || 0,
      person1MLSSurchargeBase: p1.grossEmploymentIncome || 0,
      person2MLSSurchargeBase: p2.grossEmploymentIncome || 0,
      person1CoverStatus: p1.hasPrivateHealthCover ? "full-year" : "no-cover",
      person2CoverStatus: hasPartner ? (p2.hasPrivateHealthCover ? "full-year" : "no-cover") : "full-year",
      dependantsHospitalCoverStatus: "full-year",
      dependants: normalised.household.dependants || 0,
      hasPartner,
      spouseForFullYear: hasPartner,
    });
    return {
      person1Surcharge: roundCurrency(result.person1Surcharge || 0),
      person2Surcharge: roundCurrency(result.person2Surcharge || 0),
      annualSurcharge: roundCurrency(result.annualSurcharge || 0),
      warning: result.cannotConfirm ? result.note : "",
    };
  }

  function estimateStslRepayment(repaymentIncome, openingBalance) {
    if (typeof CALC.estimateHelpRepayment === "function") {
      return CALC.estimateHelpRepayment(repaymentIncome, openingBalance).annualRepayment || 0;
    }
    return 0;
  }

  function employerSuperContribution(grossIncome, rate) {
    const cappedIncome = DEFAULT_MAXIMUM_CONTRIBUTION_BASE > 0
      ? Math.min(Math.max(0, grossIncome), DEFAULT_MAXIMUM_CONTRIBUTION_BASE)
      : Math.max(0, grossIncome);
    return roundCurrency(cappedIncome * Math.max(0, rate));
  }

  function withdrawFromSuper(requiredAmount, personOutputs, personStates, normalised) {
    let remaining = roundCurrency(Math.max(0, requiredAmount));
    const withdrawals = {};
    const configuredOrder = normalised.scenario.superWithdrawalOrder;
    const ordered = configuredOrder
      ? configuredOrder.map((id) => personOutputs.find((person) => person.id === id)).filter(Boolean)
      : personOutputs.slice().sort((a, b) => (b.age - a.age) || String(a.id).localeCompare(String(b.id)));
    ordered.forEach((person) => {
      if (remaining <= 0) return;
      if (person.age < person.superAccessAge) {
        withdrawals[person.id] = 0;
        return;
      }
      const state = personStates[person.id];
      const provisionalBalance = roundCurrency(state.openingSuperBalance + person.netEmployerSuperContribution + person.netAdditionalSuperContribution);
      const amount = roundCurrency(Math.min(provisionalBalance, remaining));
      withdrawals[person.id] = amount;
      person.superWithdrawal = amount;
      remaining = roundCurrency(remaining - amount);
    });
    personOutputs.forEach((person) => {
      if (!hasFiniteNumber(withdrawals[person.id])) withdrawals[person.id] = person.superWithdrawal || 0;
    });
    return {
      withdrawals,
      total: roundCurrency(requiredAmount - remaining),
      unmet: roundCurrency(remaining),
    };
  }

  function projectRetirementScenario(inputs) {
    const originalInputs = clone(inputs);
    const validationErrors = validateInputs(inputs);
    const normalised = normaliseInputs(inputs || {});
    const youngestCurrentAge = normalised.people.length
      ? Math.min(...normalised.people.map((person) => person.currentAge))
      : 0;
    const projectionHorizonYears = Math.max(0, Math.ceil(normalised.projectionEndAge - youngestCurrentAge));
    const projectedEndAgesByPerson = Object.fromEntries(normalised.people.map((person) => [
      person.id,
      person.currentAge + projectionHorizonYears,
    ]));
    const assumptions = {
      featureFlags: { ...FEATURE_FLAGS },
      financialYear: DEFAULT_FINANCIAL_YEAR,
      annualCalculationOrder: [
        "Determine person employment phases and gross employment income.",
        "Calculate person-level tax, Medicare levy, MLS and capped STSL repayment using existing helpers.",
        "Calculate gross and net employer/additional concessional super contributions.",
        "Calculate household lifestyle requirement in nominal dollars using today's-dollar inflation.",
        "Apply cash surplus or shortfall to accessible investments first, then available super where permitted.",
        "Apply midpoint total-return earnings to accessible investments and super balances.",
      ],
      ageConvention: "A person's currentAge is treated as their age at the start of projection year zero. Semi-retirement, full-retirement, super access and contribution stop transitions apply when age >= the entered transition age.",
      householdPhaseRules: {
        working: "All people are still full-time.",
        "semi-retirement": "At least one person is no longer full-time and not all people are fully retired.",
        "full-retirement": "All people are fully retired.",
      },
      projectionEndAgeTreatment: "projectionEndAge is the age reached by the youngest person in the household. Older people may be older than projectionEndAge in the final projection year.",
      projectionHorizonYears,
      projectedEndAgesByPerson,
      superAtAge60Treatment: "superByPersonAtAge60 records each person's own projected super balance only in the projection year where that person's age is exactly 60. If a person is older than 60 at projection start, the value remains null because the engine does not reconstruct historical age-60 balances.",
      inflation: "Household lifestyle spending is treated as today's dollars and inflated from projection year zero.",
      investmentReturnTiming: "Total-return method. Earnings equal opening balance return plus 50% of net annual cash movement return. Fees use the same midpoint balance. Dividends, interest and rent are not added separately.",
      superContributionTiming: "Employer and additional concessional contributions are reduced by 15% contributions tax before being added to super. Stage 1 does not optimise concessional caps or carry-forward amounts.",
      superAccessTreatment: "scenario-assumed-access-age",
      superAccessNote: "Super availability is modelled using the entered scenario access age. The engine does not independently determine whether all legal conditions of release are satisfied.",
      accessibleContributionTreatment: "accessibleInvestments.externalAnnualAccessibleContribution/currentAnnualContributions is treated as an explicit additional accessible-investment contribution on top of any household cash surplus. It is not auto-populated from household surplus.",
      withdrawalOrder: normalised.scenario.withdrawalOrder,
      superWithdrawalOrder: normalised.scenario.superWithdrawalOrder || "oldest available person first",
      limitations: [
        "No Age Pension, Monte Carlo modelling, contribution optimisation, account-based pension minimums or transfer balance cap treatment.",
        "Additional concessional contributions are paid from household cash and receive contributions-tax treatment only in Stage 1.",
        "Investment assumptions use a total-return model to avoid double counting cash yield.",
      ],
    };

    if (validationErrors.length) {
      return {
        years: [],
        summary: defaultSummary(),
        assumptions,
        validation: { isValid: false, errors: validationErrors },
        warnings: ["Projection was not run because validation errors were found."],
      };
    }

    const peopleStates = {};
    normalised.people.forEach((person) => {
      peopleStates[person.id] = {
        openingSuperBalance: roundCurrency(person.openingSuperBalance),
        stslBalance: roundCurrency(person.stslOpeningBalance),
      };
    });

    const years = [];
    const summary = defaultSummary();
    const warnings = [];
    normalised.people.forEach((person) => {
      if (!Object.prototype.hasOwnProperty.call(summary.superByPersonAtAge60, person.id)) {
        summary.superByPersonAtAge60[person.id] = null;
      }
      if (!Object.prototype.hasOwnProperty.call(summary.superByPersonAtAccessAge, person.id)) {
        summary.superByPersonAtAccessAge[person.id] = null;
      }
      if (person.currentAge > 60) {
        warnings.push(`${person.name} is older than 60 at projection start, so superByPersonAtAge60 is not inferred from the opening balance.`);
      }
    });
    if (normalised.accessibleInvestments.externalAnnualAccessibleContribution > 0) {
      warnings.push("External annual accessible contribution is modelled as additional to ordinary household cash surplus.");
    }
    let accessibleOpening = roundCurrency(normalised.accessibleInvestments.openingBalance);
    // Age is measured at the start of each projection year; projectionEndAge belongs to the youngest person.
    const maxYears = projectionHorizonYears;

    for (let yearIndex = 0; yearIndex <= maxYears; yearIndex += 1) {
      const calendarYear = normalised.projectionStartYear + yearIndex;
      const peopleYear = normalised.people.map((person) => {
        const age = person.currentAge + yearIndex;
        const employmentPhase = employmentPhaseForAge(person, age);
        const grossEmploymentIncome = employmentPhase === "fully-retired" ? 0
          : employmentPhase === "semi-retired" ? grownAmount(person.semiRetirementGrossIncome, person.annualIncomeGrowthRate, yearIndex)
            : grownAmount(person.currentGrossEmploymentIncome, person.annualIncomeGrowthRate, yearIndex);
        return {
          id: person.id,
          name: person.name,
          age,
          employmentPhase,
          grossEmploymentIncome,
          superAccessAge: person.superAccessAge,
          hasPrivateHealthCover: person.hasPrivateHealthCover,
          warnings: [],
        };
      });

      const mls = calculateMls(peopleYear, normalised);
      if (mls.warning) warnings.push(`${calendarYear}: ${mls.warning}`);

      peopleYear.forEach((person, index) => {
        const source = normalised.people.find((item) => item.id === person.id);
        const taxBreakdown = typeof CALC.individualTaxBreakdown === "function"
          ? CALC.individualTaxBreakdown(person.grossEmploymentIncome)
          : fallbackTaxBreakdown(person.grossEmploymentIncome);
        const stslOpeningBalance = peopleStates[person.id].stslBalance;
        const stslRepayment = roundCurrency(Math.min(stslOpeningBalance, estimateStslRepayment(person.grossEmploymentIncome, stslOpeningBalance)));
        peopleStates[person.id].stslBalance = roundCurrency(Math.max(0, stslOpeningBalance - stslRepayment));
        const medicareLevySurcharge = index === 0 ? mls.person1Surcharge : mls.person2Surcharge;
        const additionalSuperContribution = person.grossEmploymentIncome > 0 && person.age < source.additionalContributionsStopAge
          ? roundCurrency(source.existingAdditionalConcessionalContributions)
          : 0;
        const employerSuper = employerSuperContribution(person.grossEmploymentIncome, source.employerSuperRate);
        person.incomeTax = roundCurrency(taxBreakdown.incomeTax);
        person.medicareLevy = roundCurrency(taxBreakdown.medicareLevy);
        person.medicareLevySurcharge = roundCurrency(medicareLevySurcharge);
        person.stslOpeningBalance = stslOpeningBalance;
        person.stslRepayment = stslRepayment;
        person.stslClosingBalance = peopleStates[person.id].stslBalance;
        person.netEmploymentIncome = roundCurrency(Math.max(0, person.grossEmploymentIncome - person.incomeTax - person.medicareLevy - person.medicareLevySurcharge - stslRepayment));
        person.employerSuperContribution = employerSuper;
        person.netEmployerSuperContribution = roundCurrency(employerSuper * (1 - DEFAULT_CONTRIBUTIONS_TAX_RATE));
        person.additionalSuperContribution = additionalSuperContribution;
        person.netAdditionalSuperContribution = roundCurrency(additionalSuperContribution * (1 - DEFAULT_CONTRIBUTIONS_TAX_RATE));
        person.superContributionsTax = roundCurrency(
          person.employerSuperContribution
          + person.additionalSuperContribution
          - person.netEmployerSuperContribution
          - person.netAdditionalSuperContribution,
        );
        person.openingSuperBalance = peopleStates[person.id].openingSuperBalance;
        person.superWithdrawal = 0;
      });

      const phase = householdPhase(peopleYear);
      const lifestyleBase = phase === "full-retirement"
        ? (normalised.scenario.fullRetirementAnnualSpending || normalised.household.fullRetirementLifestyleSpending)
        : phase === "semi-retirement"
          ? normalised.household.semiRetirementLifestyleSpending
          : normalised.household.currentLifestyleSpending;
      const applicableLifestyleSpending = todayDollarAmount(lifestyleBase, normalised.inflationRate, yearIndex);
      const totalNetEmploymentIncome = roundCurrency(peopleYear.reduce((total, person) => total + person.netEmploymentIncome, 0));
      const otherIncome = roundCurrency(normalised.household.otherAnnualIncome);
      const totalAdditionalSuperContribution = roundCurrency(peopleYear.reduce((total, person) => total + person.additionalSuperContribution, 0));
      const householdCashRequirement = roundCurrency(applicableLifestyleSpending + normalised.household.annualLoanPrincipalRepayments + totalAdditionalSuperContribution);
      const netHouseholdCashIncome = roundCurrency(totalNetEmploymentIncome + otherIncome);
      const cashSurplusOrShortfall = roundCurrency(netHouseholdCashIncome - householdCashRequirement);
      const householdSurplusAccessibleContribution = roundCurrency(Math.max(0, cashSurplusOrShortfall));
      const externalAnnualAccessibleContribution = roundCurrency(normalised.accessibleInvestments.externalAnnualAccessibleContribution);
      const accessibleInvestmentContribution = roundCurrency(householdSurplusAccessibleContribution + externalAnnualAccessibleContribution);
      let accessibleBeforeReturn = roundCurrency(accessibleOpening + accessibleInvestmentContribution);
      let requiredShortfall = roundCurrency(Math.max(0, -cashSurplusOrShortfall));
      const minimumAccessibleBalance = roundCurrency(normalised.scenario.minimumAccessibleBalance);
      const withdrawableAccessible = () => roundCurrency(Math.max(0, accessibleBeforeReturn - minimumAccessibleBalance));
      const requiredAccessibleWithdrawal = roundCurrency(Math.min(requiredShortfall, withdrawableAccessible()));
      accessibleBeforeReturn = roundCurrency(accessibleBeforeReturn - requiredAccessibleWithdrawal);
      requiredShortfall = roundCurrency(requiredShortfall - requiredAccessibleWithdrawal);

      const plannedSemiRetirementWithdrawalRequested = phase === "semi-retirement"
        ? roundCurrency(normalised.scenario.semiRetirementAccessibleWithdrawal)
        : 0;
      const plannedSemiRetirementWithdrawal = roundCurrency(Math.min(plannedSemiRetirementWithdrawalRequested, withdrawableAccessible()));
      accessibleBeforeReturn = roundCurrency(accessibleBeforeReturn - plannedSemiRetirementWithdrawal);
      const unfundedPlannedSemiRetirementWithdrawal = roundCurrency(plannedSemiRetirementWithdrawalRequested - plannedSemiRetirementWithdrawal);

      const superFunding = requiredShortfall > 0
        ? withdrawFromSuper(requiredShortfall, peopleYear, peopleStates, normalised)
        : { total: 0, unmet: 0, withdrawals: {} };
      const unmetSpending = roundCurrency(superFunding.unmet + unfundedPlannedSemiRetirementWithdrawal);
      const totalAccessibleWithdrawal = roundCurrency(requiredAccessibleWithdrawal + plannedSemiRetirementWithdrawal);
      const netAccessibleMovement = roundCurrency(accessibleInvestmentContribution - totalAccessibleWithdrawal);
      const accessibleEarningsBasis = Math.max(0, accessibleOpening + netAccessibleMovement * 0.5);
      const accessibleInvestmentEarnings = roundCurrency(accessibleEarningsBasis * normalised.accessibleInvestments.annualReturnRate);
      const accessibleInvestmentFees = roundCurrency(accessibleEarningsBasis * Math.max(0, normalised.accessibleInvestments.annualFeesRate));
      const closingAccessibleInvestmentBalance = roundCurrency(Math.max(0, accessibleBeforeReturn + accessibleInvestmentEarnings - accessibleInvestmentFees));
      const accessibleReconciliationExpectedClosing = roundCurrency(
        accessibleOpening
        + accessibleInvestmentEarnings
        + householdSurplusAccessibleContribution
        + externalAnnualAccessibleContribution
        - requiredAccessibleWithdrawal
        - plannedSemiRetirementWithdrawal
        - accessibleInvestmentFees,
      );
      const accessibleReconciliationDifference = roundCurrency(closingAccessibleInvestmentBalance - accessibleReconciliationExpectedClosing);

      peopleYear.forEach((person) => {
        const source = normalised.people.find((item) => item.id === person.id);
        const opening = person.openingSuperBalance;
        const netContributions = roundCurrency(person.netEmployerSuperContribution + person.netAdditionalSuperContribution);
        const rate = person.employmentPhase === "fully-retired" ? source.superReturnAfterRetirement : source.superReturnBeforeRetirement;
        const movement = roundCurrency(netContributions - person.superWithdrawal);
        const earningsBasis = Math.max(0, opening + movement * 0.5);
        person.superInvestmentEarnings = roundCurrency(earningsBasis * rate);
        person.superFees = roundCurrency(earningsBasis * Math.max(0, source.superAnnualFeesRate));
        person.closingSuperBalance = roundCurrency(Math.max(0, opening + movement + person.superInvestmentEarnings - person.superFees));
        const expectedSuperClosingBalance = roundCurrency(
          opening
          + person.employerSuperContribution
          + person.additionalSuperContribution
          - person.superContributionsTax
          + person.superInvestmentEarnings
          - person.superFees
          - person.superWithdrawal,
        );
        person.superReconciliation = {
          openingBalance: opening,
          employerContributionGross: person.employerSuperContribution,
          additionalContributionGross: person.additionalSuperContribution,
          contributionsTax: person.superContributionsTax,
          investmentEarnings: person.superInvestmentEarnings,
          fees: person.superFees,
          withdrawal: person.superWithdrawal,
          expectedClosingBalance: expectedSuperClosingBalance,
          closingBalance: person.closingSuperBalance,
          difference: roundCurrency(person.closingSuperBalance - expectedSuperClosingBalance),
        };
        peopleStates[person.id].openingSuperBalance = person.closingSuperBalance;
      });

      const totalSuperBalance = roundCurrency(peopleYear.reduce((total, person) => total + person.closingSuperBalance, 0));
      const totalInvestableAssets = roundCurrency(closingAccessibleInvestmentBalance + totalSuperBalance);
      const yearWarnings = [];
      if (unfundedPlannedSemiRetirementWithdrawal > 0) yearWarnings.push("Planned semi-retirement withdrawal could not be fully funded from accessible investments.");
      if (superFunding.unmet > 0) yearWarnings.push("Household spending shortfall could not be fully funded.");
      if (closingAccessibleInvestmentBalance === 0 && totalAccessibleWithdrawal > 0 && milestoneIsUnset(summary.accessibleFundsExhausted)) {
        summary.accessibleFundsExhausted = milestoneForYear(calendarYear, peopleYear);
        summary.accessibleFundsExhaustedAge = summary.accessibleFundsExhausted.person1Age;
        summary.accessibleFundsExhaustedYear = summary.accessibleFundsExhausted.calendarYear;
      }
      if (unmetSpending > 0 && milestoneIsUnset(summary.firstUnfundedSpending)) {
        summary.firstUnfundedSpending = milestoneForYear(calendarYear, peopleYear);
        summary.firstUnfundedSpendingAge = summary.firstUnfundedSpending.person1Age;
        summary.firstUnfundedSpendingYear = summary.firstUnfundedSpending.calendarYear;
      }
      if (unmetSpending > 0 && totalInvestableAssets === 0 && milestoneIsUnset(summary.allRetirementFundsExhausted)) {
        summary.allRetirementFundsExhausted = milestoneForYear(calendarYear, peopleYear);
        summary.allRetirementFundsExhaustedAge = summary.allRetirementFundsExhausted.person1Age;
        summary.allRetirementFundsExhaustedYear = summary.allRetirementFundsExhausted.calendarYear;
      }
      const retiredPersonIds = peopleYear
        .filter((person) => person.employmentPhase === "fully-retired")
        .map((person) => person.id);
      if (retiredPersonIds.length > 0 && milestoneIsUnset(summary.firstPersonFullRetirement)) {
        summary.firstPersonFullRetirement = retirementMilestoneForYear(calendarYear, peopleYear, retiredPersonIds);
        summary.accessibleBalanceAtFirstPersonFullRetirement = closingAccessibleInvestmentBalance;
        summary.accessibleBalanceAtFirstFullRetirement = closingAccessibleInvestmentBalance;
      }
      if (phase === "full-retirement" && milestoneIsUnset(summary.householdFullRetirement)) {
        summary.householdFullRetirement = milestoneForYear(calendarYear, peopleYear);
        summary.firstFullRetirement = { ...summary.householdFullRetirement };
      }
      if (peopleYear.every((person) => person.age >= person.superAccessAge) && milestoneIsUnset(summary.firstYearAllPeopleSuperAccessible)) {
        summary.firstYearAllPeopleSuperAccessible = milestoneForYear(calendarYear, peopleYear);
      }

      const annualResult = {
        calendarYear,
        yearIndex,
        householdPhase: phase,
        person1Age: peopleYear[0]?.age ?? null,
        person2Age: peopleYear[1]?.age ?? null,
        people: peopleYear.map((person) => ({
          id: person.id,
          name: person.name,
          age: person.age,
          employmentPhase: person.employmentPhase,
          grossEmploymentIncome: roundCurrency(person.grossEmploymentIncome),
          incomeTax: person.incomeTax,
          medicareLevy: person.medicareLevy,
          medicareLevySurcharge: person.medicareLevySurcharge,
          stslOpeningBalance: person.stslOpeningBalance,
          stslRepayment: person.stslRepayment,
          stslClosingBalance: person.stslClosingBalance,
          netEmploymentIncome: person.netEmploymentIncome,
          employerSuperContribution: person.employerSuperContribution,
          netEmployerSuperContribution: person.netEmployerSuperContribution,
          additionalSuperContribution: person.additionalSuperContribution,
          netAdditionalSuperContribution: person.netAdditionalSuperContribution,
          superContributionsTax: person.superContributionsTax,
          openingSuperBalance: person.openingSuperBalance,
          superInvestmentEarnings: person.superInvestmentEarnings,
          superFees: person.superFees,
          superWithdrawal: person.superWithdrawal,
          closingSuperBalance: person.closingSuperBalance,
          superReconciliation: person.superReconciliation,
        })),
        household: {
          householdPhase: phase,
          applicableLifestyleSpending,
          totalNetEmploymentIncome,
          otherIncome,
          netHouseholdCashIncome,
          annualLoanPrincipalRepayments: roundCurrency(normalised.household.annualLoanPrincipalRepayments),
          additionalConcessionalContributionsPaidFromCash: totalAdditionalSuperContribution,
          householdCashRequirement,
          cashSurplusOrShortfall,
          plannedSemiRetirementWithdrawal: plannedSemiRetirementWithdrawal,
          plannedSemiRetirementWithdrawalRequested,
          unfundedPlannedSemiRetirementWithdrawal,
          requiredAccessibleWithdrawal,
          totalAccessibleWithdrawal,
          householdSurplusAccessibleContribution,
          externalAnnualAccessibleContribution,
          accessibleInvestmentContribution,
          openingAccessibleInvestmentBalance: accessibleOpening,
          accessibleInvestmentEarnings,
          accessibleInvestmentFees,
          closingAccessibleInvestmentBalance,
          accessibleReconciliation: {
            openingBalance: accessibleOpening,
            householdSurplusContribution: householdSurplusAccessibleContribution,
            externalAnnualAccessibleContribution,
            investmentEarnings: accessibleInvestmentEarnings,
            requiredAccessibleWithdrawal,
            plannedSemiRetirementWithdrawal,
            fees: accessibleInvestmentFees,
            expectedClosingBalance: accessibleReconciliationExpectedClosing,
            closingBalance: closingAccessibleInvestmentBalance,
            difference: accessibleReconciliationDifference,
          },
          totalSuperWithdrawal: superFunding.total,
          totalSuperBalance,
          totalInvestableAssets,
          unmetSpending,
        },
        warnings: yearWarnings,
      };
      years.push(annualResult);

      if (summary.accessibleBalanceWhenBothFullyRetired === null && peopleYear.every((person) => person.employmentPhase === "fully-retired")) {
        summary.accessibleBalanceWhenBothFullyRetired = closingAccessibleInvestmentBalance;
        summary.totalInvestableAssetsAtFullRetirement = totalInvestableAssets;
      }
      peopleYear.forEach((person) => {
        if (summary.superByPersonAtAge60[person.id] === null && person.age === 60) {
          summary.superByPersonAtAge60[person.id] = person.closingSuperBalance;
        }
        if (summary.superByPersonAtAccessAge[person.id] === null && person.age >= person.superAccessAge) {
          summary.superByPersonAtAccessAge[person.id] = person.closingSuperBalance;
        }
      });
      summary.totalUnfundedSpending = roundCurrency(summary.totalUnfundedSpending + unmetSpending);
      summary.totalPlannedSemiRetirementWithdrawals = roundCurrency(summary.totalPlannedSemiRetirementWithdrawals + plannedSemiRetirementWithdrawal);
      if (phase === "full-retirement") {
        summary.totalRetirementWithdrawals = roundCurrency(summary.totalRetirementWithdrawals + requiredAccessibleWithdrawal + superFunding.total);
      }
      accessibleOpening = closingAccessibleInvestmentBalance;
    }

    const finalYear = years.at(-1);
    if (finalYear) {
      summary.accessibleBalanceAtEndAge = finalYear.household.closingAccessibleInvestmentBalance;
      summary.superBalanceAtEndAge = finalYear.household.totalSuperBalance;
      summary.totalInvestableAssetsAtEndAge = finalYear.household.totalInvestableAssets;
    }
    summary.minimumEstateBalanceTarget = roundCurrency(normalised.scenario.minimumEstateBalanceAtEndAge);
    summary.minimumEstateBalanceShortfallAtEndAge = roundCurrency(Math.max(
      0,
      summary.minimumEstateBalanceTarget - summary.totalInvestableAssetsAtEndAge,
    ));
    summary.meetsMinimumEstateBalanceAtEndAge = summary.minimumEstateBalanceShortfallAtEndAge === 0;
    const allAge60BalancesAvailable = normalised.people.every((person) => hasFiniteNumber(summary.superByPersonAtAge60[person.id]));
    summary.totalSuperAtAge60 = allAge60BalancesAvailable
      ? roundCurrency(normalised.people.reduce((total, person) => total + summary.superByPersonAtAge60[person.id], 0))
      : null;
    if (summary.accessibleBalanceWhenBothFullyRetired === null) summary.accessibleBalanceWhenBothFullyRetired = finalYear?.household.closingAccessibleInvestmentBalance ?? 0;
    if (summary.totalInvestableAssetsAtFullRetirement === null) summary.totalInvestableAssetsAtFullRetirement = finalYear?.household.totalInvestableAssets ?? 0;

    const result = {
      years,
      summary,
      assumptions,
      validation: { isValid: true, errors: [] },
      warnings,
    };
    if (JSON.stringify(inputs) !== JSON.stringify(originalInputs)) {
      result.warnings.push("Input mutation was detected. This should not occur.");
    }
    return result;
  }

  global.FFSSemiRetirementProjection = {
    featureFlags: FEATURE_FLAGS,
    projectRetirementScenario,
    validateRetirementProjectionInputs: validateInputs,
    normaliseRetirementProjectionInputs: normaliseInputs,
  };
})(globalThis);
