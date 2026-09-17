import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const rootUrl = new URL("../../", import.meta.url);
const context = { Blob, console, Date, TextDecoder, TextEncoder, Uint8Array };
context.globalThis = context;
for (const file of ["calculator.js", "weekly-plan.js", "weekly-planner-export.js"]) {
  vm.runInNewContext(readFileSync(new URL(file, rootUrl), "utf8"), context, { filename: file });
}

const CALC = context.FFSCalculator;
const WEEKLY = context.FFSWeeklyPlan;
const EXPORT = context.FFSWeeklyPlannerExport;
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixtures({ frequency = "fortnightly", net = 69472, startDate = "2026-09-14", firstDate = startDate, durationWeeks = 20 } = {}) {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Taylor";
  plan.income.person1Frequency = "annually";
  plan.incomeItems = net > 0 ? [{
    id: "income-person-1",
    name: "Taylor salary",
    type: "salaryWages",
    owner: "person1",
    amount: net,
    frequency,
  }] : [];
  plan.expenseItems = [];
  plan.assetItems = [];
  plan.liabilityItems = [];
  plan.investing.annualInvestingTarget = 0;
  plan.investing.extraSuperContributions = 0;
  const result = {
    person1AnnualIncome: net,
    person2AnnualIncome: 0,
    otherAnnualIncome: 0,
    annualGrossIncome: net,
    netIncomeAfterTaxHelp: net,
    payrollEstimates: {
      person1: { estimatedNetEmploymentIncome: net },
      person2: { estimatedNetEmploymentIncome: 0 },
      household: {},
    },
  };
  const weeklyPlan = WEEKLY.createFromPlan(plan, result, {
    startDate,
    todayIso: startDate,
    durationWeeks,
    openingBankBalance: 1000,
    minimumCashBuffer: 0,
    payDates: { "income-person-1": firstDate },
  });
  return { plan, result, weeklyPlan };
}

function incomeWeeks(weeklyPlan) {
  return weeklyPlan.weeks.filter((week) => week.planned.income > 0).map((week) => week.weekNumber);
}

function incomeValues(weeklyPlan) {
  return weeklyPlan.weeks.map((week) => week.planned.income);
}

function extractStoredZipEntry(bytes, wantedName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    if (name === wantedName) return decoder.decode(bytes.slice(contentStart, contentStart + compressedSize));
    offset = contentStart + compressedSize;
  }
  throw new Error(`Workbook entry not found: ${wantedName}`);
}

function exportedIncomeValues(weeklyPlan) {
  const uiValues = incomeValues(weeklyPlan);
  const planner = {
    planName: "DST regression",
    generatedAt: "2026-09-15T00:00:00.000Z",
    startingBalance: 1000,
    weeks: weeklyPlan.weeks.map((week) => ({
      startDateIso: week.startDate,
      endDateIso: week.endDate,
      receiptsTotal: week.planned.income,
      essentialTotal: 0,
      provisionsTotal: 0,
      discretionaryTotal: 0,
      offsetTransferTotal: 0,
      investmentTransferTotal: 0,
      superTransferTotal: 0,
      closingBalance: week.planned.closingBalance,
      priority: "",
    })),
    sections: {
      receipts: [{ name: "Taylor salary - estimated net pay", frequency: "Fortnightly", values: uiValues }],
      essential: [],
      provisions: [],
      discretionary: [],
      transfers: [],
    },
  };
  const sheet = extractStoredZipEntry(EXPORT.createWorkbookBytes(planner), "xl/worksheets/sheet2.xml");
  const row = sheet.match(/<row r="4"[^>]*>([\s\S]*?)<\/row>/)?.[1] || "";
  const valuesByColumn = new Map();
  for (const match of row.matchAll(/<c r="([A-Z]+)4"[^>]*>(?:<v>([^<]*)<\/v>|<is><t>([^<]*)<\/t><\/is>)<\/c>/g)) {
    valuesByColumn.set(match[1], Number(match[2] || 0));
  }
  const column = (index) => {
    let value = index;
    let output = "";
    while (value > 0) {
      value -= 1;
      output = String.fromCharCode(65 + (value % 26)) + output;
      value = Math.floor(value / 26);
    }
    return output;
  };
  return uiValues.map((_, index) => valuesByColumn.get(column(index + 3)) || 0);
}

export function buildProbe() {
  const forwardFortnight = fixtures({ durationWeeks: 10 });
  const forwardWeekly = fixtures({ frequency: "weekly", net: 52000, durationWeeks: 10 });
  const backwardFortnight = fixtures({ startDate: "2027-03-08", firstDate: "2027-03-08", durationWeeks: 10 });
  const backwardWeekly = fixtures({ frequency: "weekly", net: 52000, startDate: "2027-03-08", firstDate: "2027-03-08", durationWeeks: 10 });

  const empty = fixtures({ net: 0, durationWeeks: 10 });
  const oneOff = WEEKLY.addOneOffItem(empty.plan, empty.result, empty.weeklyPlan, { id: "one-off-dst", description: "Receipt", amount: 1000, date: "2026-10-12", type: "money-in" });

  const sameDateOverride = WEEKLY.applyOccurrenceEdit(forwardFortnight.plan, forwardFortnight.result, forwardFortnight.weeklyPlan, "timing-income-person-1", "2026-10-12", { amount: 3000 }, "this");
  const sameWeekMove = WEEKLY.applyOccurrenceEdit(forwardFortnight.plan, forwardFortnight.result, forwardFortnight.weeklyPlan, "timing-income-person-1", "2026-10-12", { amount: 3000, date: "2026-10-13" }, "this");
  const precedingWeekMove = WEEKLY.applyOccurrenceEdit(forwardFortnight.plan, forwardFortnight.result, forwardFortnight.weeklyPlan, "timing-income-person-1", "2026-10-12", { amount: 3000, date: "2026-10-11" }, "this");
  const deactivated = WEEKLY.applyOccurrenceEdit(forwardFortnight.plan, forwardFortnight.result, forwardFortnight.weeklyPlan, "timing-income-person-1", "2026-10-12", { active: false }, "this");

  const boundaryPlan = fixtures({ net: 0, durationWeeks: 5 }).weeklyPlan;
  const boundaryDates = ["2026-09-13", "2026-09-14", "2026-09-20", "2026-09-21", "2026-09-27", "2026-09-28"];
  const boundaryWeeks = boundaryDates.map((date) => WEEKLY.currentCalendarWeekNumberFor(boundaryPlan.weeks, boundaryPlan.startDate, date));

  const plannerEndBase = fixtures({ net: 0, durationWeeks: 5 });
  let plannerEnd = WEEKLY.addOneOffItem(plannerEndBase.plan, plannerEndBase.result, plannerEndBase.weeklyPlan, { id: "last-day", amount: 400, date: "2026-10-18", type: "money-in" });
  plannerEnd = WEEKLY.addOneOffItem(plannerEndBase.plan, plannerEndBase.result, plannerEnd, { id: "after-end", amount: 900, date: "2026-10-19", type: "money-in" });

  const monthly = fixtures({ frequency: "monthly", net: 12000, firstDate: "2026-10-12", durationWeeks: 20 }).weeklyPlan;
  const quarterly = fixtures({ frequency: "quarterly", net: 4000, firstDate: "2026-10-12", durationWeeks: 30 }).weeklyPlan;
  const annually = fixtures({ frequency: "annually", net: 1000, firstDate: "2026-10-12", durationWeeks: 60 }).weeklyPlan;
  const annualPlan = fixtures({ durationWeeks: 52 });

  let completed = WEEKLY.completeWeek(forwardFortnight.plan, forwardFortnight.result, forwardFortnight.weeklyPlan, 1, { income: 2800, closingBalance: 3800, notes: "History" });
  const completedBefore = clone(completed.weeks[0]);
  completed = WEEKLY.reforecast(forwardFortnight.plan, forwardFortnight.result, completed);

  return clone({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    forwardFortnightWeeks: incomeWeeks(forwardFortnight.weeklyPlan),
    forwardWeeklyWeeks: incomeWeeks(forwardWeekly.weeklyPlan),
    backwardFortnightWeeks: incomeWeeks(backwardFortnight.weeklyPlan),
    backwardWeeklyWeeks: incomeWeeks(backwardWeekly.weeklyPlan),
    oneOffWeeks: incomeWeeks(oneOff),
    sameDateOverride: incomeValues(sameDateOverride),
    sameWeekMove: incomeValues(sameWeekMove),
    precedingWeekMove: incomeValues(precedingWeekMove),
    deactivated: incomeValues(deactivated),
    currentWeekAfterDstStart: WEEKLY.currentCalendarWeekNumberFor(forwardFortnight.weeklyPlan.weeks, forwardFortnight.weeklyPlan.startDate, "2026-10-12"),
    currentWeekAtDstStart: WEEKLY.currentCalendarWeekNumberFor(forwardFortnight.weeklyPlan.weeks, forwardFortnight.weeklyPlan.startDate, "2026-10-04"),
    currentWeekBeforeDstEnd: WEEKLY.currentCalendarWeekNumberFor(backwardFortnight.weeklyPlan.weeks, backwardFortnight.weeklyPlan.startDate, "2027-04-03"),
    currentWeekAtDstEnd: WEEKLY.currentCalendarWeekNumberFor(backwardFortnight.weeklyPlan.weeks, backwardFortnight.weeklyPlan.startDate, "2027-04-04"),
    currentWeekAfterDstEnd: WEEKLY.currentCalendarWeekNumberFor(backwardFortnight.weeklyPlan.weeks, backwardFortnight.weeklyPlan.startDate, "2027-04-05"),
    boundaryDates,
    boundaryWeeks,
    plannerEndIncome: incomeValues(plannerEnd),
    monthlyWeeks: incomeWeeks(monthly),
    quarterlyWeeks: incomeWeeks(quarterly),
    annualWeeks: incomeWeeks(annually),
    annualIncomeTotal: annualPlan.weeklyPlan.weeks.reduce((total, week) => total + week.planned.income, 0),
    canonicalFrequency: annualPlan.weeklyPlan.settings.timingItems.find((item) => item.id === "timing-income-person-1")?.frequency,
    legacyFrequency: annualPlan.plan.income.person1Frequency,
    completedHistoryPreserved: JSON.stringify(completed.weeks[0]) === JSON.stringify(completedBefore),
    completedActual: completed.weeks[0].actual,
    exportIncomeValues: exportedIncomeValues(forwardFortnight.weeklyPlan),
    uiIncomeValues: incomeValues(forwardFortnight.weeklyPlan),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildProbe(), null, 2));
}
