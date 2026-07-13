(function attachWeeklyPlanEngine(global) {
  const WEEKLY_PLAN_VERSION = 1;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const frequencyLabels = {
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually",
  };
  const essentialExpenseCategories = new Set([
    "living",
    "food",
    "utilities",
    "insurance",
    "schoolChildren",
    "ratesPropertyCosts",
    "phoneInternet",
    "privateHealth",
    "petrol",
    "vehicleCosts",
    "petCosts",
  ]);

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundMoney(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function annualize(amount, frequency = "annually") {
    const value = toNumber(amount);
    if (frequency === "weekly") return value * 52;
    if (frequency === "fortnightly") return value * 26;
    if (frequency === "monthly") return value * 12;
    if (frequency === "quarterly") return value * 4;
    return value;
  }

  function dateFromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function dateIso(date) {
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function addMonths(date, months) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  }

  function nextMondayIso(today = new Date()) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const day = date.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    date.setDate(date.getDate() + daysUntilMonday);
    return dateIso(date);
  }

  function weekIndexForDate(date, startDate, weeksCount) {
    const index = Math.floor((date.getTime() - startDate.getTime()) / (7 * DAY_MS));
    return index >= 0 && index < weeksCount ? index : -1;
  }

  function createWeeks(startDateIso, durationWeeks) {
    const start = dateFromIso(startDateIso);
    return Array.from({ length: durationWeeks }, (_, index) => ({
      weekNumber: index + 1,
      startDate: dateIso(addDays(start, index * 7)),
      endDate: dateIso(addDays(start, index * 7 + 6)),
    }));
  }

  function normaliseDuration(value) {
    const duration = Math.round(toNumber(value));
    if ([12, 26, 52].includes(duration)) return duration;
    return clamp(duration || 52, 1, 104);
  }

  function normaliseAllocationSettings(settings = {}) {
    const mode = ["priority", "split", "cash"].includes(settings.mode) ? settings.mode : "priority";
    const priority = Array.isArray(settings.priority) && settings.priority.length
      ? settings.priority.filter((item) => ["extraDebt", "investment", "extraSuper"].includes(item))
      : ["extraDebt", "investment", "extraSuper"];
    const uniquePriority = [...new Set(priority)];
    ["extraDebt", "investment", "extraSuper"].forEach((item) => {
      if (!uniquePriority.includes(item)) uniquePriority.push(item);
    });
    const split = {
      investment: toNumber(settings.split?.investment ?? 60),
      extraDebt: toNumber(settings.split?.extraDebt ?? 30),
      extraSuper: toNumber(settings.split?.extraSuper ?? 10),
    };
    const total = split.investment + split.extraDebt + split.extraSuper;
    return {
      mode,
      priority: uniquePriority,
      split,
      splitIsValid: mode !== "split" || Math.round(total) === 100,
    };
  }

  function defaultSettings(plan = {}, result = {}, overrides = {}) {
    const existing = overrides || {};
    const weeklyPlanner = plan.reportSettings?.weeklyPlanner || {};
    const cash = toNumber(plan.assets?.cash);
    const targetSpending = toNumber(plan.personal?.targetAnnualSpending || result.annualLivingExpenses);
    return {
      planName: existing.planName || householdName(plan) || "Weekly Plan",
      startDate: existing.startDate || weeklyPlanner.startDate || nextMondayIso(),
      durationWeeks: normaliseDuration(existing.durationWeeks || weeklyPlanner.periodWeeks || 52),
      minimumCashBuffer: roundMoney(existing.minimumCashBuffer ?? Math.max(1000, Math.min(5000, cash || targetSpending / 26 || 1000))),
      openingBankBalance: roundMoney(existing.openingBankBalance ?? weeklyPlanner.startingBalance ?? cash),
      weeklyDiscretionaryLimit: roundMoney(existing.weeklyDiscretionaryLimit ?? discretionaryWeeklyEstimate(plan, result)),
      investmentTarget: roundMoney(existing.investmentTarget ?? plan.investing?.annualInvestingTarget ?? 0),
      extraSuperTarget: roundMoney(existing.extraSuperTarget ?? plan.investing?.extraSuperContributions ?? 0),
      extraDebtRepaymentTarget: roundMoney(existing.extraDebtRepaymentTarget ?? weeklyPlanner.extraDebtRepaymentTarget ?? 0),
      missedTransferTreatment: existing.missedTransferTreatment || "carry-forward",
      allocationSettings: normaliseAllocationSettings(existing.allocationSettings),
      allowCompletedWeekEditing: existing.allowCompletedWeekEditing !== false,
      showInAppReminders: existing.showInAppReminders !== false,
      payDates: existing.payDates && typeof existing.payDates === "object" ? { ...existing.payDates } : {},
      billDates: existing.billDates && typeof existing.billDates === "object" ? { ...existing.billDates } : {},
      notes: existing.notes || "",
      sourcePlanUpdatedAt: existing.sourcePlanUpdatedAt || "",
    };
  }

  function householdName(plan = {}) {
    return [plan.personal?.person1Name, plan.personal?.person2Name]
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .join(" and ");
  }

  function discretionaryWeeklyEstimate(plan = {}, result = {}) {
    const discretionary = (plan.expenseItems || [])
      .filter((item) => !essentialExpenseCategories.has(item.category))
      .reduce((total, item) => total + annualize(item.amount, item.frequency), 0);
    if (discretionary > 0) return discretionary / 52;
    return Math.max(0, (toNumber(result.annualOtherRegularExpenses) || 0) / 52);
  }

  function displayName(options, fallback) {
    return String(options?.name || options?.label || fallback || "").trim();
  }

  function intervalForFrequency(frequency) {
    if (frequency === "weekly") return { days: 7 };
    if (frequency === "fortnightly") return { days: 14 };
    if (frequency === "monthly") return { months: 1 };
    if (frequency === "quarterly") return { months: 3 };
    if (frequency === "annually") return { months: 12 };
    return null;
  }

  function advanceDate(date, interval) {
    if (interval?.days) return addDays(date, interval.days);
    if (interval?.months) return addMonths(date, interval.months);
    return addDays(date, 7);
  }

  function scheduleRecurring(amount, frequency, weeks, startDate, exactDateIso = "", options = {}) {
    const value = roundMoney(amount);
    const values = Array.from({ length: weeks.length }, () => 0);
    if (value <= 0) return values;
    const plannerStart = startDate;
    const plannerEnd = addDays(plannerStart, weeks.length * 7);
    const interval = intervalForFrequency(frequency);
    if (exactDateIso && interval) {
      let date = dateFromIso(exactDateIso);
      let guard = 0;
      while (date < plannerStart && guard < 160) {
        date = advanceDate(date, interval);
        guard += 1;
      }
      while (date < plannerEnd && guard < 320) {
        const index = weekIndexForDate(date, plannerStart, weeks.length);
        if (index >= 0) values[index] = roundMoney(values[index] + value);
        date = advanceDate(date, interval);
        guard += 1;
      }
      return values;
    }
    if (frequency === "weekly") return values.map(() => value);
    if (frequency === "fortnightly") return values.map((_, index) => (index % 2 === 0 ? value : 0));
    if (frequency === "monthly") {
      for (let month = 0; month < Math.ceil(weeks.length / 4) + 1; month += 1) {
        const index = weekIndexForDate(addMonths(plannerStart, month), plannerStart, weeks.length);
        if (index >= 0) values[index] = roundMoney(values[index] + value);
      }
      return values;
    }
    if (frequency === "quarterly") {
      for (let month = 0; month < Math.ceil(weeks.length / 4) + 3; month += 3) {
        const index = weekIndexForDate(addMonths(plannerStart, month), plannerStart, weeks.length);
        if (index >= 0) values[index] = roundMoney(values[index] + value);
      }
      return values;
    }
    if (frequency === "annually" && options.assignAnnualToFirstWeek) {
      values[0] = value;
      return values;
    }
    const weekly = roundMoney(annualize(value, frequency || "annually") / 52);
    return values.map(() => weekly);
  }

  function addScheduledItem(collection, item) {
    const values = (item.values || []).map(roundMoney);
    if (values.reduce((total, value) => total + value, 0) <= 0) return;
    collection.push({
      id: item.id || "",
      name: item.name,
      frequency: item.frequency || "annually",
      frequencyLabel: item.frequencyLabel || frequencyLabels[item.frequency] || "Estimate",
      timing: item.timing || "estimated",
      values,
    });
  }

  function itemValueAt(items, index) {
    return roundMoney((items || []).reduce((total, item) => total + toNumber(item.values?.[index]), 0));
  }

  function buildScheduleItems(plan, settings, weeks) {
    const startDate = dateFromIso(settings.startDate);
    const incomeItems = [];
    const billItems = [];
    const setAsideItems = [];
    const discretionaryItems = [];
    const requiredDebtItems = [];
    const incomeList = Array.isArray(plan.incomeItems) ? plan.incomeItems : [];
    const expenseList = Array.isArray(plan.expenseItems) ? plan.expenseItems : [];
    const liabilityList = Array.isArray(plan.liabilityItems) ? plan.liabilityItems : [];

    incomeList.forEach((item, index) => {
      const frequency = item.frequency || "annually";
      const exactDate = settings.payDates?.[item.id] || "";
      const values = scheduleRecurring(item.amount, frequency, weeks, startDate, exactDate);
      addScheduledItem(incomeItems, {
        id: item.id,
        name: displayName(item, `Income ${index + 1}`),
        frequency,
        frequencyLabel: exactDate ? `${frequencyLabels[frequency] || "Income"} from pay date` : frequencyLabels[frequency],
        timing: exactDate ? "dated" : frequency === "annually" ? "weekly-estimate" : "estimated",
        values,
      });
    });

    expenseList.forEach((item) => {
      const frequency = item.frequency || "annually";
      const exactDate = settings.billDates?.[item.id] || "";
      const isEssential = essentialExpenseCategories.has(item.category);
      const useSetAside = !exactDate && frequency === "annually";
      const values = scheduleRecurring(item.amount, frequency, weeks, startDate, exactDate, { assignAnnualToFirstWeek: false });
      addScheduledItem(useSetAside ? setAsideItems : isEssential ? billItems : discretionaryItems, {
        id: item.id,
        name: useSetAside ? `${displayName(item, "Annual cost")} set aside` : displayName(item, "Expense"),
        frequency,
        frequencyLabel: exactDate ? `${frequencyLabels[frequency]} from bill date` : useSetAside ? `${frequencyLabels[frequency]} - weekly amount set aside` : `${frequencyLabels[frequency]} estimate`,
        timing: exactDate ? "dated" : useSetAside ? "set-aside" : "estimated",
        values,
      });
    });

    liabilityList.forEach((item) => {
      if (item.type === "hecsHelp") return;
      const frequency = item.repaymentFrequency || "monthly";
      const exactDate = settings.billDates?.[item.id] || "";
      const values = scheduleRecurring(item.repayment, frequency, weeks, startDate, exactDate);
      addScheduledItem(requiredDebtItems, {
        id: item.id,
        name: `${displayName(item, "Debt")} repayment`,
        frequency,
        frequencyLabel: exactDate ? `${frequencyLabels[frequency]} from repayment date` : `${frequencyLabels[frequency]} estimate`,
        timing: exactDate ? "dated" : "estimated",
        values,
      });
    });

    return { incomeItems, billItems, setAsideItems, discretionaryItems, requiredDebtItems };
  }

  function desiredTransfers(settings, weekIndex, remainingWeeks, carryForward) {
    const treatment = settings.missedTransferTreatment || "carry-forward";
    const base = {
      investment: roundMoney(toNumber(settings.investmentTarget) / 52),
      extraSuper: roundMoney(toNumber(settings.extraSuperTarget) / 52),
      extraDebt: roundMoney(toNumber(settings.extraDebtRepaymentTarget) / 52),
    };
    if (treatment === "carry-forward") {
      return {
        investment: roundMoney(base.investment + carryForward.investment),
        extraSuper: roundMoney(base.extraSuper + carryForward.extraSuper),
        extraDebt: roundMoney(base.extraDebt + carryForward.extraDebt),
      };
    }
    if (treatment === "spread") {
      const divisor = Math.max(1, remainingWeeks);
      return {
        investment: roundMoney(base.investment + carryForward.investment / divisor),
        extraSuper: roundMoney(base.extraSuper + carryForward.extraSuper / divisor),
        extraDebt: roundMoney(base.extraDebt + carryForward.extraDebt / divisor),
      };
    }
    return base;
  }

  function allocateOptionalTransfers(available, desired, allocationSettings) {
    const allocated = { investment: 0, extraSuper: 0, extraDebt: 0 };
    const safeAvailable = Math.max(0, roundMoney(available));
    if (safeAvailable <= 0 || allocationSettings.mode === "cash") return allocated;
    const desiredTotal = roundMoney(desired.investment + desired.extraSuper + desired.extraDebt);
    let remaining = Math.min(safeAvailable, desiredTotal);

    if (allocationSettings.mode === "split" && allocationSettings.splitIsValid) {
      const order = ["investment", "extraDebt", "extraSuper"];
      order.forEach((key) => {
        const target = roundMoney(Math.min(desired[key], remaining * (toNumber(allocationSettings.split[key]) / 100)));
        allocated[key] = target;
      });
      remaining = roundMoney(Math.min(safeAvailable, desiredTotal) - allocated.investment - allocated.extraDebt - allocated.extraSuper);
      order.forEach((key) => {
        if (remaining <= 0) return;
        const topUp = Math.min(remaining, desired[key] - allocated[key]);
        allocated[key] = roundMoney(allocated[key] + topUp);
        remaining = roundMoney(remaining - topUp);
      });
      return allocated;
    }

    allocationSettings.priority.forEach((key) => {
      if (remaining <= 0) return;
      const amount = Math.min(remaining, desired[key] || 0);
      allocated[key] = roundMoney(amount);
      remaining = roundMoney(remaining - amount);
    });
    return allocated;
  }

  function weekStatus(closingBalance, minimumCashBuffer, adjustmentReason) {
    const closing = roundMoney(closingBalance);
    const buffer = roundMoney(minimumCashBuffer);
    if (closing < 0 || closing < buffer) {
      return {
        status: "action-needed",
        label: "Action needed",
        message: closing < 0
          ? "Your expected bank balance is negative this week. Review upcoming bills or add funds before they are due."
          : "Your expected bank balance falls below the minimum buffer this week. Review bills, spending or optional transfers.",
      };
    }
    if (adjustmentReason || closing <= buffer + Math.max(250, buffer * 0.15)) {
      return {
        status: "tight",
        label: "Tight week",
        message: adjustmentReason || "This is a tighter week because the expected closing balance is close to your minimum cash buffer.",
      };
    }
    return {
      status: "on-track",
      label: "On track",
      message: "You are on track this week. After bills, spending and planned transfers, your bank balance is expected to remain above your minimum buffer.",
    };
  }

  function completedWeekMap(existingPlan) {
    const map = new Map();
    (existingPlan?.weeks || []).forEach((week) => {
      if (week?.isCompleted) map.set(week.weekNumber, week);
    });
    return map;
  }

  function actualWeekMap(existingPlan) {
    const map = new Map();
    (existingPlan?.weeks || []).forEach((week) => {
      if (week?.actual) map.set(week.weekNumber, week.actual);
    });
    return map;
  }

  function buildProgress(weeks, settings) {
    const completed = weeks.filter((week) => week.isCompleted);
    const remaining = weeks.filter((week) => !week.isCompleted);
    const sumActual = (key) => roundMoney(completed.reduce((total, week) => total + toNumber(week.actual?.[key]), 0));
    const sumPlanned = (key) => roundMoney(remaining.reduce((total, week) => total + toNumber(week.planned?.[key]), 0));
    const incomeReceived = sumActual("income");
    const actualInvestment = sumActual("investment");
    const actualSuper = sumActual("extraSuper");
    const actualDebt = sumActual("extraDebtRepayment");
    const closingSource = [...weeks].reverse().find((week) => week.isCompleted ? week.actual?.closingBalance !== undefined : week.planned?.closingBalance !== undefined);
    const currentBankBalance = roundMoney(closingSource?.isCompleted ? closingSource.actual?.closingBalance : closingSource?.planned?.closingBalance);
    const plannedIncome = sumPlanned("income");
    return {
      weeksCompleted: completed.length,
      incomeReceived,
      essentialCostsPaid: sumActual("essentialCosts"),
      averageWeeklyDiscretionarySpending: completed.length ? roundMoney(sumActual("discretionarySpending") / completed.length) : 0,
      amountInvested: actualInvestment,
      extraSuperContributed: actualSuper,
      extraDebtRepaid: actualDebt,
      currentCashBuffer: settings.minimumCashBuffer,
      currentBankBalance,
      annualSavingsRate: incomeReceived > 0 ? roundMoney((actualInvestment + actualSuper + actualDebt) / incomeReceived * 100) : 0,
      plannedWealthTransfersRemaining: roundMoney(sumPlanned("investment") + sumPlanned("extraSuper") + sumPlanned("extraDebtRepayment")),
      estimatedImprovementInFinancialPosition: roundMoney(actualInvestment + actualSuper + actualDebt + sumPlanned("investment") + sumPlanned("extraSuper") + sumPlanned("extraDebtRepayment")),
      plannedInvestmentRemaining: sumPlanned("investment"),
      plannedExtraSuperRemaining: sumPlanned("extraSuper"),
      plannedExtraDebtRemaining: sumPlanned("extraDebtRepayment"),
      investmentTarget: toNumber(settings.investmentTarget),
      extraSuperTarget: toNumber(settings.extraSuperTarget),
      extraDebtRepaymentTarget: toNumber(settings.extraDebtRepaymentTarget),
      estimatedEndOfYearIncome: roundMoney(incomeReceived + plannedIncome),
      weeksBelowBuffer: weeks.filter((week) => (week.isCompleted ? toNumber(week.actual?.closingBalance) : toNumber(week.planned?.closingBalance)) < settings.minimumCashBuffer).length,
    };
  }

  function currentWeekNumberFor(weeks, startDateIso) {
    const todayIndex = weekIndexForDate(new Date(), dateFromIso(startDateIso), weeks.length);
    const firstIncomplete = weeks.find((week) => !week.isCompleted)?.weekNumber || weeks.length;
    if (todayIndex < 0) return firstIncomplete;
    return clamp(Math.max(firstIncomplete, todayIndex + 1), 1, weeks.length);
  }

  function createFromPlan(plan = {}, result = {}, options = {}, existingPlan = null) {
    const now = new Date().toISOString();
    const settings = defaultSettings(plan, result, existingPlan?.settings ? { ...existingPlan.settings, ...options } : options);
    const weeksBase = createWeeks(settings.startDate, settings.durationWeeks);
    const schedule = buildScheduleItems(plan, settings, weeksBase);
    const completed = completedWeekMap(existingPlan);
    const actuals = actualWeekMap(existingPlan);
    const weeks = [];
    const carryForward = { investment: 0, extraSuper: 0, extraDebt: 0 };
    let opening = roundMoney(settings.openingBankBalance);
    const allocationSettings = normaliseAllocationSettings(settings.allocationSettings);

    weeksBase.forEach((baseWeek, index) => {
      const completedWeek = completed.get(baseWeek.weekNumber);
      if (completedWeek) {
        weeks.push(completedWeek);
        opening = roundMoney(completedWeek.actual?.closingBalance ?? completedWeek.planned?.closingBalance ?? opening);
        return;
      }
      const income = itemValueAt(schedule.incomeItems, index);
      const billsDue = roundMoney(itemValueAt(schedule.billItems, index) + itemValueAt(schedule.requiredDebtItems, index));
      const amountSetAside = itemValueAt(schedule.setAsideItems, index);
      const essentialCosts = roundMoney(billsDue + amountSetAside);
      const discretionaryFromItems = itemValueAt(schedule.discretionaryItems, index);
      const discretionaryAllowance = roundMoney(settings.weeklyDiscretionaryLimit || discretionaryFromItems);
      const remainingWeeks = Math.max(1, settings.durationWeeks - index);
      const desired = desiredTransfers(settings, index, remainingWeeks, carryForward);
      const availableAfterBuffer = roundMoney(opening + income - essentialCosts - discretionaryAllowance - settings.minimumCashBuffer);
      const allocated = allocateOptionalTransfers(availableAfterBuffer, desired, allocationSettings);
      const totalTransfers = roundMoney(allocated.investment + allocated.extraSuper + allocated.extraDebt);
      const closingBalance = roundMoney(opening + income - essentialCosts - discretionaryAllowance - totalTransfers);
      const reducedInvestment = desired.investment > allocated.investment;
      const reducedSuper = desired.extraSuper > allocated.extraSuper;
      const reducedDebt = desired.extraDebt > allocated.extraDebt;
      let adjustmentReason = "";
      if (reducedInvestment || reducedSuper || reducedDebt) {
        const parts = [];
        if (reducedInvestment) parts.push(`investment reduced from ${roundMoney(desired.investment)} to ${roundMoney(allocated.investment)}`);
        if (reducedDebt) parts.push(`extra debt repayment reduced from ${roundMoney(desired.extraDebt)} to ${roundMoney(allocated.extraDebt)}`);
        if (reducedSuper) parts.push(`extra super reduced from ${roundMoney(desired.extraSuper)} to ${roundMoney(allocated.extraSuper)}`);
        adjustmentReason = `Your optional transfers were adjusted so the plan protects the minimum cash buffer where possible: ${parts.join(", ")}.`;
      }
      if (opening + income - essentialCosts < settings.minimumCashBuffer) {
        adjustmentReason = "Essential payments are expected to reduce your bank balance below the minimum buffer this week. Review upcoming bills or add funds before they are due.";
      }
      const status = weekStatus(closingBalance, settings.minimumCashBuffer, adjustmentReason);
      if (settings.missedTransferTreatment === "carry-forward" || settings.missedTransferTreatment === "spread") {
        carryForward.investment = roundMoney(Math.max(0, desired.investment - allocated.investment));
        carryForward.extraSuper = roundMoney(Math.max(0, desired.extraSuper - allocated.extraSuper));
        carryForward.extraDebt = roundMoney(Math.max(0, desired.extraDebt - allocated.extraDebt));
      } else {
        carryForward.investment = 0;
        carryForward.extraSuper = 0;
        carryForward.extraDebt = 0;
      }
      const week = {
        ...baseWeek,
        isCompleted: false,
        planned: {
          openingBalance: opening,
          income,
          essentialCosts,
          billsDue,
          amountSetAside,
          discretionaryAllowance,
          investment: allocated.investment,
          extraSuper: allocated.extraSuper,
          extraDebtRepayment: allocated.extraDebt,
          closingBalance,
          status: status.status,
          statusLabel: status.label,
          statusMessage: status.message,
          adjustmentReason,
        },
        detail: {
          incomeItems: valuesForWeek(schedule.incomeItems, index),
          billItems: valuesForWeek([...schedule.billItems, ...schedule.requiredDebtItems], index),
          setAsideItems: valuesForWeek(schedule.setAsideItems, index),
          discretionaryItems: valuesForWeek(schedule.discretionaryItems, index),
        },
      };
      if (actuals.has(baseWeek.weekNumber)) week.actual = actuals.get(baseWeek.weekNumber);
      weeks.push(week);
      opening = closingBalance;
    });

    const migrated = migrate(existingPlan);
    const weeklyPlan = {
      version: WEEKLY_PLAN_VERSION,
      id: migrated?.id || `weekly-plan-${Date.now()}`,
      planName: settings.planName || householdName(plan) || "Weekly Plan",
      createdAt: migrated?.createdAt || now,
      updatedAt: now,
      startDate: settings.startDate,
      durationWeeks: settings.durationWeeks,
      currentWeekNumber: currentWeekNumberFor(weeks, settings.startDate),
      status: "active",
      minimumCashBuffer: settings.minimumCashBuffer,
      openingBankBalance: settings.openingBankBalance,
      allocationSettings,
      weeks,
      progress: buildProgress(weeks, settings),
      settings: { ...settings, allocationSettings },
      sourceSnapshot: {
        householdName: householdName(plan),
        cash: toNumber(plan.assets?.cash),
        offset: toNumber(plan.assets?.offsetBalance),
        investments: toNumber(plan.assets?.sharesEtfs) + toNumber(plan.assets?.crypto),
        super: toNumber(result.superannuationBalance),
        liabilities: toNumber(result.totalLiabilities),
      },
    };
    return weeklyPlan;
  }

  function valuesForWeek(items, index) {
    return (items || [])
      .map((item) => ({ name: item.name, amount: roundMoney(item.values?.[index] || 0), frequencyLabel: item.frequencyLabel, timing: item.timing }))
      .filter((item) => item.amount > 0);
  }

  function migrate(input) {
    if (!input || typeof input !== "object") return null;
    const settings = defaultSettings({}, {}, input.settings || {});
    const weeks = Array.isArray(input.weeks) ? input.weeks.map((week, index) => ({
      weekNumber: Number(week.weekNumber) || index + 1,
      startDate: week.startDate || week.startDateIso || "",
      endDate: week.endDate || "",
      isCompleted: Boolean(week.isCompleted),
      planned: {
        openingBalance: roundMoney(week.planned?.openingBalance),
        income: roundMoney(week.planned?.income),
        essentialCosts: roundMoney(week.planned?.essentialCosts),
        billsDue: roundMoney(week.planned?.billsDue),
        amountSetAside: roundMoney(week.planned?.amountSetAside),
        discretionaryAllowance: roundMoney(week.planned?.discretionaryAllowance),
        investment: Math.max(0, roundMoney(week.planned?.investment)),
        extraSuper: Math.max(0, roundMoney(week.planned?.extraSuper)),
        extraDebtRepayment: Math.max(0, roundMoney(week.planned?.extraDebtRepayment)),
        closingBalance: roundMoney(week.planned?.closingBalance),
        status: week.planned?.status || "on-track",
        statusLabel: week.planned?.statusLabel || "",
        statusMessage: week.planned?.statusMessage || "",
        adjustmentReason: week.planned?.adjustmentReason || "",
      },
      actual: week.actual ? {
        income: roundMoney(week.actual.income),
        essentialCosts: roundMoney(week.actual.essentialCosts),
        discretionarySpending: roundMoney(week.actual.discretionarySpending),
        investment: Math.max(0, roundMoney(week.actual.investment)),
        extraSuper: Math.max(0, roundMoney(week.actual.extraSuper)),
        extraDebtRepayment: Math.max(0, roundMoney(week.actual.extraDebtRepayment)),
        closingBalance: roundMoney(week.actual.closingBalance),
        notes: week.actual.notes || "",
        completedAt: week.actual.completedAt || "",
        checks: week.actual.checks && typeof week.actual.checks === "object" ? { ...week.actual.checks } : {},
      } : undefined,
      detail: week.detail || { incomeItems: [], billItems: [], setAsideItems: [], discretionaryItems: [] },
    })) : [];
    return {
      version: WEEKLY_PLAN_VERSION,
      id: input.id || `weekly-plan-${Date.now()}`,
      planName: input.planName || settings.planName || "Weekly Plan",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: input.updatedAt || new Date().toISOString(),
      startDate: input.startDate || settings.startDate,
      durationWeeks: normaliseDuration(input.durationWeeks || settings.durationWeeks),
      currentWeekNumber: Number(input.currentWeekNumber) || 1,
      status: input.status || "active",
      minimumCashBuffer: roundMoney(input.minimumCashBuffer ?? settings.minimumCashBuffer),
      openingBankBalance: roundMoney(input.openingBankBalance ?? settings.openingBankBalance),
      allocationSettings: normaliseAllocationSettings(input.allocationSettings || settings.allocationSettings),
      weeks,
      progress: input.progress && typeof input.progress === "object" ? input.progress : buildProgress(weeks, settings),
      settings,
      sourceSnapshot: input.sourceSnapshot || {},
    };
  }

  function reforecast(plan, result, weeklyPlan) {
    return createFromPlan(plan, result, weeklyPlan?.settings || {}, weeklyPlan);
  }

  function updateActual(weeklyPlan, weekNumber, actual = {}, options = {}) {
    const migrated = migrate(weeklyPlan);
    if (!migrated) return null;
    const week = migrated.weeks.find((item) => item.weekNumber === Number(weekNumber));
    if (!week) return migrated;
    const previous = week.actual || {};
    week.actual = {
      income: roundMoney(actual.income ?? previous.income ?? week.planned.income),
      essentialCosts: roundMoney(actual.essentialCosts ?? previous.essentialCosts ?? week.planned.essentialCosts),
      discretionarySpending: roundMoney(actual.discretionarySpending ?? previous.discretionarySpending ?? week.planned.discretionaryAllowance),
      investment: Math.max(0, roundMoney(actual.investment ?? previous.investment ?? week.planned.investment)),
      extraSuper: Math.max(0, roundMoney(actual.extraSuper ?? previous.extraSuper ?? week.planned.extraSuper)),
      extraDebtRepayment: Math.max(0, roundMoney(actual.extraDebtRepayment ?? previous.extraDebtRepayment ?? week.planned.extraDebtRepayment)),
      closingBalance: roundMoney(actual.closingBalance ?? previous.closingBalance ?? week.planned.closingBalance),
      notes: String(actual.notes ?? previous.notes ?? ""),
      completedAt: options.complete ? new Date().toISOString() : previous.completedAt || "",
      checks: actual.checks && typeof actual.checks === "object" ? { ...previous.checks, ...actual.checks } : previous.checks || {},
    };
    if (options.complete) week.isCompleted = true;
    migrated.updatedAt = new Date().toISOString();
    migrated.progress = buildProgress(migrated.weeks, migrated.settings);
    migrated.currentWeekNumber = currentWeekNumberFor(migrated.weeks, migrated.startDate);
    return migrated;
  }

  function completeWeek(plan, result, weeklyPlan, weekNumber, actual = {}) {
    const updated = updateActual(weeklyPlan, weekNumber, actual, { complete: true });
    return reforecast(plan, result, updated);
  }

  function updateSettings(plan, result, weeklyPlan, settingsPatch = {}) {
    const migrated = migrate(weeklyPlan);
    const settings = defaultSettings(plan, result, { ...migrated?.settings, ...settingsPatch });
    return createFromPlan(plan, result, settings, migrated);
  }

  function exportPayload(weeklyPlan) {
    return {
      app: "Financial Freedom",
      type: "financial-freedom-weekly-plan-backup",
      schemaVersion: WEEKLY_PLAN_VERSION,
      exportedAt: new Date().toISOString(),
      weeklyPlan: migrate(weeklyPlan),
    };
  }

  function importPayload(payload) {
    if (!payload || typeof payload !== "object") throw new Error("The selected file is not a valid Weekly Plan backup.");
    const raw = payload.weeklyPlan || payload;
    const migrated = migrate(raw);
    if (!migrated || !Array.isArray(migrated.weeks)) throw new Error("No Weekly Plan data was found in the selected file.");
    return migrated;
  }

  const api = {
    VERSION: WEEKLY_PLAN_VERSION,
    annualize,
    nextMondayIso,
    defaultSettings,
    createFromPlan,
    reforecast,
    updateActual,
    completeWeek,
    updateSettings,
    migrate,
    exportPayload,
    importPayload,
    roundMoney,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FFSWeeklyPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
