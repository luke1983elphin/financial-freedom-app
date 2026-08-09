(function attachSemiRetirementUi(global) {
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function finiteNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function nonNegative(value) {
    return Math.max(0, number(value));
  }

  function percentToRate(value) {
    return number(value) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function planValue(plan, path, fallback = 0) {
    return path.split(".").reduce((cursor, key) => cursor?.[key], plan) ?? fallback;
  }

  function personName(plan, index) {
    return String(plan?.personal?.[`person${index}Name`] || `Person ${index}`);
  }

  function personId(index) {
    return `person${index}`;
  }

  function hasSecondPerson(plan = {}, result = {}) {
    return Boolean(
      plan.personal?.person2Name
      || number(plan.personal?.person2Age) > 0
      || number(result.person2SalaryWages) > 0
      || number(plan.assets?.superPerson2) > 0
      || number(result.helpRepaymentEstimate?.person2?.openingBalance) > 0
      || number(result.people?.person2?.taxableIncome) > 0,
    );
  }

  function salaryForPerson(result = {}, index) {
    const key = personId(index);
    return nonNegative(result[`${key}SalaryWages`] ?? result.people?.[key]?.salaryAndWages);
  }

  function superForPerson(plan = {}, index) {
    return nonNegative(plan.assets?.[`superPerson${index}`]);
  }

  function stslForPerson(result = {}, index) {
    return nonNegative(result.helpRepaymentEstimate?.[personId(index)]?.openingBalance);
  }

  function defaultFullRetirementAge(plan = {}, index) {
    const currentAge = nonNegative(plan.personal?.[`person${index}Age`]);
    const entered = number(plan.personal?.fullRetirementAge || plan.personal?.semiRetirementAge || plan.personal?.workOptionalAge);
    return Math.max(currentAge, entered || currentAge);
  }

  function basePlanSourceKey(plan = {}, result = {}) {
    return JSON.stringify({
      personal: {
        person1Name: plan.personal?.person1Name || "",
        person2Name: plan.personal?.person2Name || "",
        person1Age: number(plan.personal?.person1Age),
        person2Age: number(plan.personal?.person2Age),
        fullRetirementAge: number(plan.personal?.fullRetirementAge),
        semiRetirementAge: number(plan.personal?.semiRetirementAge),
        targetAnnualSpending: number(plan.personal?.targetAnnualSpending),
      },
      income: {
        person1SalaryWages: salaryForPerson(result, 1),
        person2SalaryWages: salaryForPerson(result, 2),
      },
      assets: {
        accessibleInvestmentAssets: nonNegative(result.accessibleInvestmentAssets),
        superPerson1: superForPerson(plan, 1),
        superPerson2: superForPerson(plan, 2),
      },
      assumptions: {
        investmentReturnPct: number(plan.investing?.expectedInvestmentReturnPct),
        superReturnPct: number(plan.investing?.expectedSuperReturnPct),
        inflationPct: number(plan.investing?.inflationPct),
        wageGrowthPct: number(plan.investing?.wageGrowthPct),
        employerSuperRate: number(result.employerSuperRate || result.taxConfiguration?.employerSuperRate),
      },
      stsl: {
        person1: stslForPerson(result, 1),
        person2: stslForPerson(result, 2),
      },
    });
  }

  function personDefaults(plan = {}, result = {}, index = 1) {
    const currentAge = nonNegative(plan.personal?.[`person${index}Age`]);
    const fullRetirementAge = defaultFullRetirementAge(plan, index);
    const employerSuperRatePct = number(result.employerSuperRate || result.taxConfiguration?.employerSuperRate || 0.12) * 100;
    const superReturnPct = number(plan.investing?.expectedSuperReturnPct, 6.5);
    return {
      id: personId(index),
      name: personName(plan, index),
      currentAge,
      currentGrossEmploymentIncome: salaryForPerson(result, index),
      annualIncomeGrowthRatePct: number(plan.investing?.wageGrowthPct, 3),
      hasSemiRetirement: false,
      semiRetirementAge: fullRetirementAge,
      semiRetirementGrossIncome: 0,
      fullRetirementAge,
      superAccessAge: 60,
      openingSuperBalance: superForPerson(plan, index),
      superReturnBeforeRetirementPct: superReturnPct,
      superReturnAfterRetirementPct: Math.max(0, superReturnPct - 1),
      superAnnualFeesRatePct: 0,
      employerSuperRatePct,
      existingAdditionalConcessionalContributions: 0,
      additionalContributionsStopAge: fullRetirementAge,
      stslOpeningBalance: stslForPerson(result, index),
      hasPrivateHealthCover: result.people?.[personId(index)]?.privateHealth?.hasAppropriateHospitalCover !== false,
    };
  }

  function buildSemiRetirementScenarioDefaults(plan = {}, result = {}) {
    const lifestyleSpending = nonNegative(plan.personal?.targetAnnualSpending) || nonNegative(result.annualLivingExpenses);
    const people = [personDefaults(plan, result, 1)];
    if (hasSecondPerson(plan, result)) people.push(personDefaults(plan, result, 2));
    const draft = {
      version: 1,
      projectionStartYear: currentYear(),
      projectionEndAge: 90,
      household: {
        currentLifestyleSpending: lifestyleSpending,
        semiRetirementLifestyleSpending: lifestyleSpending,
        fullRetirementLifestyleSpending: lifestyleSpending,
        annualLoanPrincipalRepayments: 0,
        otherAnnualIncome: nonNegative(result.otherAnnualIncome),
      },
      accessibleInvestments: {
        openingBalance: nonNegative(result.accessibleInvestmentAssets),
        annualReturnRatePct: number(plan.investing?.expectedInvestmentReturnPct, 7),
        annualFeesRatePct: 0,
        externalAnnualAccessibleContribution: 0,
      },
      assumptions: {
        inflationRatePct: number(plan.investing?.inflationPct, 2.5),
      },
      scenario: {
        semiRetirementAccessibleWithdrawal: 0,
        minimumAccessibleBalance: 0,
        minimumEstateBalanceAtEndAge: 0,
        withdrawalOrder: "accessible-first",
      },
      people,
    };
    return {
      sourceKey: basePlanSourceKey(plan, result),
      draft,
    };
  }

  function getDraftPath(draft, path) {
    return String(path || "").split(".").reduce((cursor, key) => {
      if (cursor === undefined || cursor === null) return undefined;
      if (/^\d+$/.test(key) && Array.isArray(cursor)) return cursor[Number(key)];
      return cursor[key];
    }, draft);
  }

  function setDraftPath(draft, path, value) {
    const keys = String(path || "").split(".");
    const last = keys.pop();
    const target = keys.reduce((cursor, key, index) => {
      const nextKey = keys[index + 1] || last;
      const isArrayIndex = /^\d+$/.test(nextKey);
      const realKey = /^\d+$/.test(key) && Array.isArray(cursor) ? Number(key) : key;
      if (cursor[realKey] === undefined || cursor[realKey] === null) cursor[realKey] = isArrayIndex ? [] : {};
      return cursor[realKey];
    }, draft);
    const realLast = /^\d+$/.test(last) && Array.isArray(target) ? Number(last) : last;
    target[realLast] = value;
    return draft;
  }

  function validateSemiRetirementScenarioDraft(draft = {}) {
    const errors = [];
    const add = (path, message) => errors.push({ path, message });
    if (!Array.isArray(draft.people) || !draft.people.length) add("people", "At least one person is required.");
    (draft.people || []).forEach((person, index) => {
      const prefix = `people.${index}`;
      const currentAge = number(person.currentAge);
      const fullRetirementAge = number(person.fullRetirementAge);
      const semiRetirementAge = person.hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge;
      if (currentAge < 0) add(`${prefix}.currentAge`, "Current age cannot be negative.");
      if (person.hasSemiRetirement && semiRetirementAge < currentAge) add(`${prefix}.semiRetirementAge`, "Semi-retirement age cannot be earlier than your current age.");
      if (fullRetirementAge < currentAge) add(`${prefix}.fullRetirementAge`, "Full-retirement age cannot be earlier than your current age.");
      if (person.hasSemiRetirement && fullRetirementAge < semiRetirementAge) add(`${prefix}.fullRetirementAge`, "Full-retirement age cannot be earlier than semi-retirement age.");
      if (number(person.superAccessAge) < currentAge) add(`${prefix}.superAccessAge`, "Assumed super access age cannot be earlier than your current age.");
      [
        ["currentGrossEmploymentIncome", "Annual income cannot be negative."],
        ["semiRetirementGrossIncome", "Annual income cannot be negative."],
        ["openingSuperBalance", "Super balance cannot be negative."],
        ["existingAdditionalConcessionalContributions", "Additional super contributions cannot be negative."],
        ["stslOpeningBalance", "STSL balance cannot be negative."],
      ].forEach(([field, message]) => {
        if (number(person[field]) < 0) add(`${prefix}.${field}`, message);
      });
    });
    [
      ["household.currentLifestyleSpending", draft.household?.currentLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["household.semiRetirementLifestyleSpending", draft.household?.semiRetirementLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["household.fullRetirementLifestyleSpending", draft.household?.fullRetirementLifestyleSpending, "Lifestyle spending cannot be negative."],
      ["accessibleInvestments.openingBalance", draft.accessibleInvestments?.openingBalance, "Accessible investment balance cannot be negative."],
      ["accessibleInvestments.externalAnnualAccessibleContribution", draft.accessibleInvestments?.externalAnnualAccessibleContribution, "Additional planned investment contribution cannot be negative."],
      ["scenario.semiRetirementAccessibleWithdrawal", draft.scenario?.semiRetirementAccessibleWithdrawal, "Planned withdrawal cannot be negative."],
    ].forEach(([path, value, message]) => {
      if (number(value) < 0) add(path, message);
    });
    [
      ["accessibleInvestments.annualReturnRatePct", draft.accessibleInvestments?.annualReturnRatePct],
      ["accessibleInvestments.annualFeesRatePct", draft.accessibleInvestments?.annualFeesRatePct],
      ["assumptions.inflationRatePct", draft.assumptions?.inflationRatePct],
      ...(draft.people || []).flatMap((person, index) => [
        [`people.${index}.annualIncomeGrowthRatePct`, person.annualIncomeGrowthRatePct],
        [`people.${index}.superReturnBeforeRetirementPct`, person.superReturnBeforeRetirementPct],
        [`people.${index}.superReturnAfterRetirementPct`, person.superReturnAfterRetirementPct],
        [`people.${index}.superAnnualFeesRatePct`, person.superAnnualFeesRatePct],
        [`people.${index}.employerSuperRatePct`, person.employerSuperRatePct],
      ]),
    ].forEach(([path, value]) => {
      if (number(value) < -100) add(path, "Investment return must be greater than -100%.");
    });
    const youngestCurrentAge = (draft.people || []).reduce((youngest, person) => Math.min(youngest, number(person.currentAge)), Infinity);
    const projectionEndAge = number(draft.projectionEndAge);
    if (!Number.isFinite(youngestCurrentAge) || projectionEndAge < 80 || projectionEndAge > 110) add("projectionEndAge", "Projection end age must be between 80 and 110.");
    const yearsUntilProjectionEnd = projectionEndAge - youngestCurrentAge;
    (draft.people || []).forEach((person) => {
      const yearsUntilFullRetirement = number(person.fullRetirementAge) - number(person.currentAge);
      if (yearsUntilFullRetirement > yearsUntilProjectionEnd) {
        add("projectionEndAge", `${person.name || "This person's"} full-retirement age occurs after the selected projection end.`);
      }
    });
    return errors;
  }

  function scenarioDraftToProjectionInputs(draft = {}) {
    const inputs = {
      projectionStartYear: Math.round(number(draft.projectionStartYear, currentYear())),
      projectionEndAge: number(draft.projectionEndAge, 90),
      inflationRate: percentToRate(draft.assumptions?.inflationRatePct),
      household: {
        currentLifestyleSpending: nonNegative(draft.household?.currentLifestyleSpending),
        semiRetirementLifestyleSpending: nonNegative(draft.household?.semiRetirementLifestyleSpending),
        fullRetirementLifestyleSpending: nonNegative(draft.household?.fullRetirementLifestyleSpending),
        otherAnnualIncome: nonNegative(draft.household?.otherAnnualIncome),
        annualLoanPrincipalRepayments: nonNegative(draft.household?.annualLoanPrincipalRepayments),
      },
      accessibleInvestments: {
        openingBalance: nonNegative(draft.accessibleInvestments?.openingBalance),
        annualReturnRate: percentToRate(draft.accessibleInvestments?.annualReturnRatePct),
        annualFeesRate: percentToRate(draft.accessibleInvestments?.annualFeesRatePct),
        externalAnnualAccessibleContribution: nonNegative(draft.accessibleInvestments?.externalAnnualAccessibleContribution),
        currentAnnualContributions: nonNegative(draft.accessibleInvestments?.externalAnnualAccessibleContribution),
      },
      people: (draft.people || []).map((person, index) => {
        const fullRetirementAge = number(person.fullRetirementAge);
        const hasSemiRetirement = Boolean(person.hasSemiRetirement);
        return {
          id: String(person.id || personId(index + 1)),
          name: String(person.name || `Person ${index + 1}`),
          currentAge: number(person.currentAge),
          currentGrossEmploymentIncome: nonNegative(person.currentGrossEmploymentIncome),
          annualIncomeGrowthRate: percentToRate(person.annualIncomeGrowthRatePct),
          semiRetirementAge: hasSemiRetirement ? number(person.semiRetirementAge) : fullRetirementAge,
          semiRetirementGrossIncome: hasSemiRetirement ? nonNegative(person.semiRetirementGrossIncome) : 0,
          fullRetirementAge,
          superAccessAge: number(person.superAccessAge, 60),
          openingSuperBalance: nonNegative(person.openingSuperBalance),
          superReturnBeforeRetirement: percentToRate(person.superReturnBeforeRetirementPct),
          superReturnAfterRetirement: percentToRate(person.superReturnAfterRetirementPct),
          superAnnualFeesRate: percentToRate(person.superAnnualFeesRatePct),
          employerSuperRate: percentToRate(person.employerSuperRatePct),
          existingAdditionalConcessionalContributions: nonNegative(person.existingAdditionalConcessionalContributions),
          additionalContributionsStopAge: number(person.additionalContributionsStopAge, fullRetirementAge),
          stslOpeningBalance: nonNegative(person.stslOpeningBalance),
          hasPrivateHealthCover: person.hasPrivateHealthCover !== false,
        };
      }),
      scenario: {
        semiRetirementAccessibleWithdrawal: nonNegative(draft.scenario?.semiRetirementAccessibleWithdrawal),
        fullRetirementAnnualSpending: nonNegative(draft.household?.fullRetirementLifestyleSpending),
        minimumAccessibleBalance: nonNegative(draft.scenario?.minimumAccessibleBalance),
        minimumEstateBalanceAtEndAge: nonNegative(draft.scenario?.minimumEstateBalanceAtEndAge),
        withdrawalOrder: "accessible-first",
      },
    };
    return inputs;
  }

  function runSemiRetirementProjection(engine, draft) {
    const uiErrors = validateSemiRetirementScenarioDraft(draft);
    if (uiErrors.length) {
      return {
        inputs: scenarioDraftToProjectionInputs(draft),
        result: null,
        validation: { isValid: false, errors: uiErrors },
      };
    }
    if (!engine || typeof engine.projectRetirementScenario !== "function") {
      return {
        inputs: scenarioDraftToProjectionInputs(draft),
        result: null,
        validation: { isValid: false, errors: [{ path: "engine", message: "Semi-retirement projection engine is not available." }] },
      };
    }
    const inputs = scenarioDraftToProjectionInputs(draft);
    const result = engine.projectRetirementScenario(inputs);
    return {
      inputs,
      result,
      validation: result.validation || { isValid: true, errors: [] },
    };
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function personListFromProjection(projection = {}, draft = {}, inputs = {}) {
    const projectedPeople = asArray(projection.years?.[0]?.people);
    const draftPeople = asArray(draft.people);
    const inputPeople = asArray(inputs.people);
    const people = projectedPeople.length ? projectedPeople : draftPeople;
    return people.map((person, index) => ({
      id: person.id || personId(index + 1),
      name: person.name || `Person ${index + 1}`,
      currentAge: number(person.currentAge ?? person.age),
    })).map((person, index) => {
      const inputPerson = inputPeople.find((candidate) => candidate.id === person.id);
      const draftPerson = draftPeople.find((candidate) => candidate.id === person.id) || draftPeople[index];
      return {
        ...person,
        superAccessAge: finiteNumberOrNull(inputPerson?.superAccessAge ?? draftPerson?.superAccessAge),
      };
    });
  }

  function milestoneHasYear(milestone) {
    return Boolean(milestone && milestone.calendarYear !== null && milestone.calendarYear !== undefined);
  }

  function milestoneAges(milestone = {}, people = []) {
    return people.map((person, index) => ({
      id: person.id,
      name: person.name,
      age: milestone[`${person.id}Age`] ?? milestone[`person${index + 1}Age`] ?? null,
    }));
  }

  function rowAges(row = {}, people = []) {
    return people.map((person, index) => {
      const projected = asArray(row.people).find((entry) => entry.id === person.id);
      return {
        id: person.id,
        name: person.name,
        age: projected?.age ?? row[`${person.id}Age`] ?? row[`person${index + 1}Age`] ?? null,
      };
    });
  }

  function rowForCalendarYear(years = [], calendarYear) {
    if (!calendarYear) return null;
    return years.find((row) => row.calendarYear === calendarYear) || null;
  }

  function phaseLabel(phase = "") {
    const labels = {
      working: "Working",
      "semi-retirement": "Semi-retirement",
      "full-retirement": "Full retirement",
      "full-time": "Full-time work",
      "semi-retired": "Semi-retired",
      "fully-retired": "Fully retired",
    };
    return labels[phase] || String(phase || "Not available");
  }

  function roundDisplayAmount(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function warningText(warning) {
    const text = String(warning || "");
    if (!text) return "";
    return text
      .replace(/superByPersonAtAge60/g, "age-60 super balance")
      .replace(/External annual accessible contribution/g, "Additional planned investment contribution")
      .replace(/Input mutation was detected\. This should not occur\./g, "The projection input changed unexpectedly while calculating. Review the scenario and calculate again.");
  }

  function addTimelineEvent(groups, event) {
    if (!event?.calendarYear) return;
    const key = `${event.calendarYear}:${event.title}`;
    if (groups.seen.has(key)) return;
    groups.seen.add(key);
    const group = groups.byYear.get(event.calendarYear) || {
      calendarYear: event.calendarYear,
      ages: event.ages || [],
      events: [],
    };
    if ((!group.ages || !group.ages.length) && event.ages) group.ages = event.ages;
    group.events.push({
      title: event.title,
      detail: event.detail || "",
      tone: event.tone || "neutral",
    });
    groups.byYear.set(event.calendarYear, group);
  }

  function buildRetirementTimeline(projection = {}, people = []) {
    const years = asArray(projection.years);
    const summary = projection.summary || {};
    const groups = { byYear: new Map(), seen: new Set() };
    const lastPhaseByPerson = {};
    const superAccessSeen = new Set();

    years.forEach((row) => {
      asArray(row.people).forEach((person) => {
        const previousPhase = lastPhaseByPerson[person.id];
        if (person.employmentPhase === "semi-retired" && previousPhase !== "semi-retired" && previousPhase !== "fully-retired") {
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: `${person.name || person.id} semi-retires`,
            detail: "Reduced work begins in the projection.",
          });
        }
        if (person.employmentPhase === "fully-retired" && previousPhase !== "fully-retired") {
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: `${person.name || person.id} fully retires`,
            detail: "Employment income for this person is no longer modelled.",
          });
        }
        const displayPerson = people.find((candidate) => candidate.id === person.id);
        const superAccessAge = finiteNumberOrNull(displayPerson?.superAccessAge);
        if (!superAccessSeen.has(person.id) && superAccessAge !== null && person.age >= superAccessAge) {
          superAccessSeen.add(person.id);
          const alreadyReachedAtStart = row.yearIndex === 0 && person.age >= superAccessAge;
          addTimelineEvent(groups, {
            calendarYear: row.calendarYear,
            ages: rowAges(row, people),
            title: alreadyReachedAtStart
              ? `${person.name || person.id} is already at or above the assumed super access age`
              : `${person.name || person.id} reaches the scenario super-access age`,
            detail: "Super access is based on the scenario assumption entered.",
          });
        }
        lastPhaseByPerson[person.id] = person.employmentPhase;
      });
    });

    if (milestoneHasYear(summary.firstPersonFullRetirement)) {
      const retiredNames = asArray(summary.firstPersonFullRetirement.retiredPersonIds)
        .map((id) => people.find((person) => person.id === id)?.name || id)
        .join(", ");
      addTimelineEvent(groups, {
        calendarYear: summary.firstPersonFullRetirement.calendarYear,
        ages: milestoneAges(summary.firstPersonFullRetirement, people),
        title: "First person fully retires",
        detail: retiredNames ? `Retired: ${retiredNames}` : "",
      });
    }
    if (milestoneHasYear(summary.householdFullRetirement)) {
      addTimelineEvent(groups, {
        calendarYear: summary.householdFullRetirement.calendarYear,
        ages: milestoneAges(summary.householdFullRetirement, people),
        title: "Household fully retired",
        detail: "All people in the scenario are fully retired.",
      });
    }
    if (milestoneHasYear(summary.accessibleFundsExhausted)) {
      addTimelineEvent(groups, {
        calendarYear: summary.accessibleFundsExhausted.calendarYear,
        ages: milestoneAges(summary.accessibleFundsExhausted, people),
        title: "Accessible investments reach $0",
        tone: "warning",
      });
    }
    if (milestoneHasYear(summary.firstUnfundedSpending)) {
      addTimelineEvent(groups, {
        calendarYear: summary.firstUnfundedSpending.calendarYear,
        ages: milestoneAges(summary.firstUnfundedSpending, people),
        title: "First projected funding shortfall",
        tone: "warning",
      });
    }
    if (milestoneHasYear(summary.allRetirementFundsExhausted)) {
      addTimelineEvent(groups, {
        calendarYear: summary.allRetirementFundsExhausted.calendarYear,
        ages: milestoneAges(summary.allRetirementFundsExhausted, people),
        title: "Total investable retirement assets reach $0",
        tone: "warning",
      });
    }

    return Array.from(groups.byYear.values()).sort((a, b) => a.calendarYear - b.calendarYear);
  }

  function buildAnnualProjectionRows(projection = {}, people = []) {
    return asArray(projection.years).map((row) => ({
      calendarYear: row.calendarYear,
      yearIndex: row.yearIndex,
      householdPhase: row.householdPhase,
      householdPhaseLabel: phaseLabel(row.householdPhase),
      ages: rowAges(row, people),
      people: asArray(row.people).map((person) => ({
        ...person,
        employmentPhaseLabel: phaseLabel(person.employmentPhase),
      })),
      household: row.household || {},
      warnings: asArray(row.warnings).map(warningText).filter(Boolean),
    }));
  }

  function buildAssumptionRows(projection = {}, inputs = {}) {
    const assumptions = projection.assumptions || {};
    const people = asArray(inputs.people);
    return [
      { label: "Projection start year", value: inputs.projectionStartYear ?? assumptions.projectionStartYear ?? null, type: "plain" },
      { label: "Projection end age", value: inputs.projectionEndAge ?? null, type: "age" },
      { label: "Inflation", value: inputs.inflationRate, type: "percentRate" },
      { label: "Accessible investment return", value: inputs.accessibleInvestments?.annualReturnRate, type: "percentRate" },
      { label: "Accessible investment fees", value: inputs.accessibleInvestments?.annualFeesRate, type: "percentRate" },
      { label: "Additional planned investment contribution", value: inputs.accessibleInvestments?.externalAnnualAccessibleContribution ?? inputs.accessibleInvestments?.currentAnnualContributions, type: "currency" },
      { label: "Current lifestyle spending", value: inputs.household?.currentLifestyleSpending, type: "currency" },
      { label: "Semi-retirement lifestyle spending", value: inputs.household?.semiRetirementLifestyleSpending, type: "currency" },
      { label: "Full-retirement lifestyle spending", value: inputs.household?.fullRetirementLifestyleSpending ?? inputs.scenario?.fullRetirementAnnualSpending, type: "currency" },
      { label: "Annual loan principal repayments", value: inputs.household?.annualLoanPrincipalRepayments, type: "currency" },
      { label: "Other annual income", value: inputs.household?.otherAnnualIncome, type: "currency" },
      { label: "Planned semi-retirement accessible withdrawal", value: inputs.scenario?.semiRetirementAccessibleWithdrawal, type: "currency" },
      { label: "Minimum accessible balance", value: inputs.scenario?.minimumAccessibleBalance, type: "currency" },
      { label: "Withdrawal order", value: inputs.scenario?.withdrawalOrder || assumptions.withdrawalOrder || "accessible investments first", type: "plain" },
      ...people.flatMap((person) => [
        { label: `${person.name || person.id} semi-retirement income`, value: person.semiRetirementGrossIncome, type: "currency" },
        { label: `${person.name || person.id} full-retirement age`, value: person.fullRetirementAge, type: "age" },
        { label: `${person.name || person.id} assumed super access age`, value: person.superAccessAge, type: "age" },
        { label: `${person.name || person.id} employer super rate`, value: person.employerSuperRate, type: "percentRate" },
        { label: `${person.name || person.id} super return before retirement`, value: person.superReturnBeforeRetirement, type: "percentRate" },
        { label: `${person.name || person.id} super return after retirement`, value: person.superReturnAfterRetirement, type: "percentRate" },
      ]),
    ].filter((row) => row.value !== undefined);
  }

  function buildSemiRetirementResultsViewModel(projection = {}, inputs = {}, draft = {}) {
    if (!projection || !projection.summary || !asArray(projection.years).length) {
      return { isAvailable: false };
    }
    const years = asArray(projection.years);
    const summary = projection.summary || {};
    const people = personListFromProjection(projection, draft, inputs);
    const finalYear = years[years.length - 1] || {};
    const householdFullRetirementRow = rowForCalendarYear(years, summary.householdFullRetirement?.calendarYear)
      || years.find((row) => row.householdPhase === "full-retirement")
      || null;
    const firstPersonFullRetirementRow = rowForCalendarYear(years, summary.firstPersonFullRetirement?.calendarYear) || null;
    const firstUnfunded = summary.firstUnfundedSpending || {};
    const isShortfall = milestoneHasYear(firstUnfunded) || roundDisplayAmount(summary.totalUnfundedSpending) > 0;
    const projectionEndAge = inputs.projectionEndAge
      ?? Math.min(...asArray(finalYear.people).map((person) => person.age).filter((age) => Number.isFinite(Number(age))));
    const annualRows = buildAnnualProjectionRows(projection, people);
    const topWarnings = asArray(projection.warnings).map(warningText).filter(Boolean);
    const annualWarnings = annualRows
      .flatMap((row) => row.warnings.map((warning) => `${row.calendarYear}: ${warning}`))
      .filter(Boolean);
    const semiRetirementRows = years.filter((row) => row.householdPhase === "semi-retirement");
    const requiredAccessibleWithdrawalsDuringSemiRetirement = semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.requiredAccessibleWithdrawal));
    }, 0);
    const superWithdrawalsDuringSemiRetirement = semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.totalSuperWithdrawal));
    }, 0);
    const plannedSemiRetirementWithdrawals = summary.totalPlannedSemiRetirementWithdrawals ?? semiRetirementRows.reduce((total, row) => {
      const household = row.household || {};
      return roundDisplayAmount(total + number(household.plannedSemiRetirementWithdrawal));
    }, 0);
    const totalAssetWithdrawalsDuringSemiRetirement = roundDisplayAmount(
      plannedSemiRetirementWithdrawals
      + requiredAccessibleWithdrawalsDuringSemiRetirement
      + superWithdrawalsDuringSemiRetirement,
    );
    const missingSuperAccessAgeWarnings = people
      .filter((person) => finiteNumberOrNull(person.superAccessAge) === null)
      .map((person) => `${person.name || person.id}: assumed super access age is missing, so no super-access timeline event is shown.`);

    return {
      isAvailable: true,
      people,
      projectionEndAge,
      projectionEndDescription: `Projection ends when the younger person reaches age ${projectionEndAge}`,
      status: {
        type: isShortfall ? "shortfall" : "funded",
        title: isShortfall
          ? `Projected funding shortfall begins in ${firstUnfunded.calendarYear}`
          : "Lifestyle funded through the projection period",
        milestone: isShortfall ? firstUnfunded : null,
        ages: isShortfall ? milestoneAges(firstUnfunded, people) : [],
      },
      keyResults: {
        accessibleAtFirstPersonFullRetirement: {
          milestone: summary.firstPersonFullRetirement,
          value: summary.accessibleBalanceAtFirstPersonFullRetirement,
          row: firstPersonFullRetirementRow,
        },
        accessibleWhenBothFullyRetired: {
          milestone: summary.householdFullRetirement,
          value: summary.accessibleBalanceWhenBothFullyRetired ?? householdFullRetirementRow?.household?.closingAccessibleInvestmentBalance ?? null,
          row: householdFullRetirementRow,
        },
        totalInvestableAssetsWhenBothFullyRetired: {
          milestone: summary.householdFullRetirement,
          value: summary.totalInvestableAssetsAtFullRetirement ?? householdFullRetirementRow?.household?.totalInvestableAssets ?? null,
          row: householdFullRetirementRow,
        },
        superAtAge60: people.map((person) => ({
          person,
          value: summary.superByPersonAtAge60?.[person.id] ?? null,
          unavailableReason: summary.superByPersonAtAge60?.[person.id] === null ? "Not available - age 60 predates this projection" : "",
        })),
        superAtAccessAge: people.map((person) => ({
          person,
          value: summary.superByPersonAtAccessAge?.[person.id] ?? null,
        })),
        projectionEnd: {
          calendarYear: finalYear.calendarYear,
          ages: rowAges(finalYear, people),
          accessibleInvestments: summary.accessibleBalanceAtEndAge ?? finalYear.household?.closingAccessibleInvestmentBalance ?? null,
          super: summary.superBalanceAtEndAge ?? finalYear.household?.totalSuperBalance ?? null,
          totalInvestableAssets: summary.totalInvestableAssetsAtEndAge ?? finalYear.household?.totalInvestableAssets ?? null,
        },
      },
      timeline: buildRetirementTimeline(projection, people),
      longevity: {
        accessibleFundsExhausted: summary.accessibleFundsExhausted,
        allRetirementFundsExhausted: summary.allRetirementFundsExhausted,
        firstUnfundedSpending: summary.firstUnfundedSpending,
        totalUnfundedSpending: roundDisplayAmount(summary.totalUnfundedSpending),
      },
      semiRetirementFunding: {
        plannedAnnualAccessibleWithdrawal: inputs.scenario?.semiRetirementAccessibleWithdrawal ?? draft.scenario?.semiRetirementAccessibleWithdrawal ?? 0,
        totalPlannedSemiRetirementWithdrawals: plannedSemiRetirementWithdrawals,
        requiredAccessibleWithdrawalsDuringSemiRetirement,
        superWithdrawalsDuringSemiRetirement,
        totalAssetWithdrawalsDuringSemiRetirement,
      },
      annualRows,
      assumptions: {
        rows: buildAssumptionRows(projection, inputs),
        engineAssumptions: projection.assumptions || {},
      },
      warnings: [...topWarnings, ...annualWarnings, ...missingSuperAccessAgeWarnings],
    };
  }

  const SCENARIO_ADJUSTMENT_FIELDS = {
    semiRetirementAccessibleWithdrawal: {
      path: "scenario.semiRetirementAccessibleWithdrawal",
      label: "Annual semi-retirement withdrawal",
    },
    fullRetirementLifestyleSpending: {
      path: "household.fullRetirementLifestyleSpending",
      label: "Annual retirement lifestyle spending",
    },
  };

  function hasSemiRetirementPhase(projection = {}, inputs = {}, draft = {}) {
    if (asArray(projection.years).some((row) => row.householdPhase === "semi-retirement")) return true;
    const people = asArray(inputs.people).length ? inputs.people : asArray(draft.people);
    return people.some((person) => Boolean(person.hasSemiRetirement) && number(person.semiRetirementAge) < number(person.fullRetirementAge));
  }

  function scenarioAdjustmentSliderMax(value) {
    const amount = nonNegative(value);
    return Math.max(100000, Math.ceil((amount * 2) / 5000) * 5000);
  }

  function scenarioAdjustmentValue(draft = {}, field) {
    const config = SCENARIO_ADJUSTMENT_FIELDS[field];
    return config ? number(getDraftPath(draft, config.path)) : 0;
  }

  function applyScenarioAdjustment(draft = {}, field, value) {
    const config = SCENARIO_ADJUSTMENT_FIELDS[field];
    if (!config) return draft;
    const parsed = Number(value);
    setDraftPath(draft, config.path, Number.isFinite(parsed) ? parsed : value);
    return draft;
  }

  function buildScenarioAdjustmentSnapshot(projection = {}, inputs = {}, draft = {}) {
    const viewModel = buildSemiRetirementResultsViewModel(projection, inputs, draft);
    if (!viewModel?.isAvailable) return null;
    const firstShortfall = viewModel.longevity?.firstUnfundedSpending || null;
    return {
      values: {
        semiRetirementAccessibleWithdrawal: scenarioAdjustmentValue(draft, "semiRetirementAccessibleWithdrawal"),
        fullRetirementLifestyleSpending: scenarioAdjustmentValue(draft, "fullRetirementLifestyleSpending"),
      },
      statusType: viewModel.status?.type || "funded",
      statusTitle: viewModel.status?.title || "",
      projectionEndAssets: finiteNumberOrNull(viewModel.keyResults?.projectionEnd?.totalInvestableAssets),
      projectionEndYear: viewModel.keyResults?.projectionEnd?.calendarYear ?? null,
      projectionEndAges: viewModel.keyResults?.projectionEnd?.ages || [],
      firstShortfallYear: firstShortfall?.calendarYear ?? null,
      firstShortfallAges: firstShortfall?.calendarYear ? milestoneAges(firstShortfall, viewModel.people) : [],
      hasSemiRetirementPhase: hasSemiRetirementPhase(projection, inputs, draft),
    };
  }

  function buildScenarioAdjustmentComparison(baseline = null, adjusted = null) {
    if (!baseline || !adjusted) return null;
    const baselineEndAssets = finiteNumberOrNull(baseline.projectionEndAssets);
    const adjustedEndAssets = finiteNumberOrNull(adjusted.projectionEndAssets);
    return {
      endAssetsDelta: baselineEndAssets === null || adjustedEndAssets === null
        ? null
        : roundDisplayAmount(adjustedEndAssets - baselineEndAssets),
      baselineFirstShortfallYear: baseline.firstShortfallYear ?? null,
      adjustedFirstShortfallYear: adjusted.firstShortfallYear ?? null,
      firstShortfallYearDelta:
        baseline.firstShortfallYear === null || baseline.firstShortfallYear === undefined
        || adjusted.firstShortfallYear === null || adjusted.firstShortfallYear === undefined
          ? null
          : Number(adjusted.firstShortfallYear) - Number(baseline.firstShortfallYear),
      valueDeltas: {
        semiRetirementAccessibleWithdrawal: roundDisplayAmount(
          scenarioAdjustmentValue({ scenario: { semiRetirementAccessibleWithdrawal: adjusted.values?.semiRetirementAccessibleWithdrawal } }, "semiRetirementAccessibleWithdrawal")
          - scenarioAdjustmentValue({ scenario: { semiRetirementAccessibleWithdrawal: baseline.values?.semiRetirementAccessibleWithdrawal } }, "semiRetirementAccessibleWithdrawal"),
        ),
        fullRetirementLifestyleSpending: roundDisplayAmount(
          scenarioAdjustmentValue({ household: { fullRetirementLifestyleSpending: adjusted.values?.fullRetirementLifestyleSpending } }, "fullRetirementLifestyleSpending")
          - scenarioAdjustmentValue({ household: { fullRetirementLifestyleSpending: baseline.values?.fullRetirementLifestyleSpending } }, "fullRetirementLifestyleSpending"),
        ),
      },
    };
  }

  function buildScenarioAdjustmentState(projection = {}, inputs = {}, draft = {}, baseline = null) {
    const impact = buildScenarioAdjustmentSnapshot(projection, inputs, draft);
    if (!impact) return { isAvailable: false };
    const semiValue = scenarioAdjustmentValue(draft, "semiRetirementAccessibleWithdrawal");
    const retirementValue = scenarioAdjustmentValue(draft, "fullRetirementLifestyleSpending");
    return {
      isAvailable: true,
      values: {
        semiRetirementAccessibleWithdrawal: semiValue,
        fullRetirementLifestyleSpending: retirementValue,
      },
      controls: {
        semiRetirementAccessibleWithdrawal: {
          ...SCENARIO_ADJUSTMENT_FIELDS.semiRetirementAccessibleWithdrawal,
          enabled: impact.hasSemiRetirementPhase,
          value: semiValue,
          min: 0,
          max: scenarioAdjustmentSliderMax(semiValue),
          step: 1000,
        },
        fullRetirementLifestyleSpending: {
          ...SCENARIO_ADJUSTMENT_FIELDS.fullRetirementLifestyleSpending,
          enabled: true,
          value: retirementValue,
          min: 0,
          max: scenarioAdjustmentSliderMax(retirementValue),
          step: 1000,
        },
      },
      impact,
      comparison: buildScenarioAdjustmentComparison(baseline, impact),
    };
  }

  function buildScenarioAdjustmentDisplayState({
    projection = {},
    inputs = {},
    resultDraft = {},
    currentDraft = {},
    baseline = null,
    hasValidationErrors = false,
  } = {}) {
    const resultState = buildScenarioAdjustmentState(projection, inputs, resultDraft, baseline);
    if (!resultState?.isAvailable) return { isAvailable: false };
    const controlState = buildScenarioAdjustmentState(projection, inputs, currentDraft, null);
    if (!controlState?.isAvailable) return resultState;
    return {
      ...resultState,
      values: controlState.values,
      controls: {
        semiRetirementAccessibleWithdrawal: {
          ...resultState.controls.semiRetirementAccessibleWithdrawal,
          value: controlState.controls.semiRetirementAccessibleWithdrawal.value,
          max: controlState.controls.semiRetirementAccessibleWithdrawal.max,
        },
        fullRetirementLifestyleSpending: {
          ...resultState.controls.fullRetirementLifestyleSpending,
          value: controlState.controls.fullRetirementLifestyleSpending.value,
          max: controlState.controls.fullRetirementLifestyleSpending.max,
        },
      },
      resultValues: resultState.values,
      draftValues: controlState.values,
      isUsingLastValidResult: Boolean(hasValidationErrors),
      statusMessage: hasValidationErrors
        ? "Last valid projection remains visible. Fix the adjustment value to update the results."
        : "Projection updated from the existing engine.",
    };
  }

  function resetScenarioAdjustmentsToBaseline(draft = {}, baseline = null) {
    if (!baseline?.values) return draft;
    applyScenarioAdjustment(draft, "semiRetirementAccessibleWithdrawal", baseline.values.semiRetirementAccessibleWithdrawal);
    applyScenarioAdjustment(draft, "fullRetirementLifestyleSpending", baseline.values.fullRetirementLifestyleSpending);
    return draft;
  }

  function isSemiRetirementUiEnabled(engine = global.FFSSemiRetirementProjection) {
    return Boolean(engine?.featureFlags?.semiRetirementProjectionEnabled);
  }

  function setSemiRetirementProjectionEnabledForDevelopment(enabled = true) {
    if (!global.FFSSemiRetirementProjection?.featureFlags) return false;
    global.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled = Boolean(enabled);
    return global.FFSSemiRetirementProjection.featureFlags.semiRetirementProjectionEnabled;
  }

  global.FFSSemiRetirementUi = {
    buildSemiRetirementScenarioDefaults,
    basePlanSourceKey,
    getDraftPath,
    setDraftPath,
    validateSemiRetirementScenarioDraft,
    scenarioDraftToProjectionInputs,
    runSemiRetirementProjection,
    buildSemiRetirementResultsViewModel,
    hasSemiRetirementPhase,
    applyScenarioAdjustment,
    buildScenarioAdjustmentSnapshot,
    buildScenarioAdjustmentComparison,
    buildScenarioAdjustmentState,
    buildScenarioAdjustmentDisplayState,
    resetScenarioAdjustmentsToBaseline,
    isSemiRetirementUiEnabled,
    setSemiRetirementProjectionEnabledForDevelopment,
  };
})(globalThis);
