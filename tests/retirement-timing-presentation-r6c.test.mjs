import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementProjection.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../semiRetirementUi.js", import.meta.url), "utf8"), context);

const CALC = context.FFSCalculator;
const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function baseDraft() {
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Taylor";
  plan.personal.person2Name = "Morgan";
  plan.personal.person1Age = 40;
  plan.personal.person2Age = 38;
  plan.personal.fullRetirementAge = 60;
  plan.personal.targetAnnualSpending = 70000;
  plan.assets.cash = 50000;
  plan.assets.sharesEtfs = 110000;
  plan.assets.superPerson1 = 150000;
  plan.assets.superPerson2 = 120000;
  plan.incomeItems = [
    { id: "salary-taylor", name: "Taylor salary", type: "salaryWages", owner: "person1", amount: 3500, frequency: "fortnightly" },
    { id: "salary-morgan", name: "Morgan salary", type: "salaryWages", owner: "person2", amount: 2800, frequency: "fortnightly" },
  ];
  plan.expenseItems = [
    { id: "living", name: "Living expenses", category: "living", amount: 63700, frequency: "annually" },
  ];
  const result = CALC.calculatePlan(plan);
  return UI.buildSemiRetirementScenarioDefaults(plan, result).draft;
}

function project(mutator = () => {}) {
  const draft = baseDraft();
  mutator(draft);
  const inputs = UI.scenarioDraftToProjectionInputs(draft);
  const projection = ENGINE.projectRetirementScenario(inputs);
  const beforeViewModel = JSON.stringify(projection);
  const viewModel = UI.buildSemiRetirementResultsViewModel(projection, inputs, draft);
  return { draft, inputs, projection, beforeViewModel, viewModel };
}

test("R6C-1 to R6C-3 person view model retains canonical retirement timing by id", () => {
  const projection = {
    years: [{ people: [
      { id: "person2", name: "Morgan", age: 38, fullRetirementAge: null },
      { id: "person1", name: "Taylor", age: 40, semiRetirementAge: null },
    ] }],
  };
  const draft = { people: [
    { id: "person1", hasSemiRetirement: true, semiRetirementAge: 55, fullRetirementAge: 60, superAccessAge: 60 },
    { id: "person2", hasSemiRetirement: false, semiRetirementAge: 62, fullRetirementAge: 62, superAccessAge: 61 },
  ] };
  const inputs = { people: [
    { id: "person1", semiRetirementAge: 55, fullRetirementAge: 60, superAccessAge: 60 },
    { id: "person2", semiRetirementAge: 62, fullRetirementAge: 62, superAccessAge: 61 },
  ] };
  const people = UI.personListFromProjection(projection, draft, inputs);
  const taylor = people.find((person) => person.id === "person1");
  const morgan = people.find((person) => person.id === "person2");
  assert.deepEqual(
    { hasSemiRetirement: taylor.hasSemiRetirement, semiRetirementAge: taylor.semiRetirementAge, fullRetirementAge: taylor.fullRetirementAge, superAccessAge: taylor.superAccessAge },
    { hasSemiRetirement: true, semiRetirementAge: 55, fullRetirementAge: 60, superAccessAge: 60 },
  );
  assert.deepEqual(
    { hasSemiRetirement: morgan.hasSemiRetirement, semiRetirementAge: morgan.semiRetirementAge, fullRetirementAge: morgan.fullRetirementAge, superAccessAge: morgan.superAccessAge },
    { hasSemiRetirement: false, semiRetirementAge: 62, fullRetirementAge: 62, superAccessAge: 61 },
  );
});

test("R6C view model retains existing safe index fallback", () => {
  const projection = { years: [{ people: [{ id: "legacy-person", name: "Legacy", age: 50 }] }] };
  const draft = { people: [{ hasSemiRetirement: true, semiRetirementAge: 56, fullRetirementAge: 61, superAccessAge: 60 }] };
  const inputs = { people: [{ semiRetirementAge: 56, fullRetirementAge: 61, superAccessAge: 60 }] };
  const [person] = UI.personListFromProjection(projection, draft, inputs);
  assert.equal(person.hasSemiRetirement, true);
  assert.equal(person.semiRetirementAge, 56);
  assert.equal(person.fullRetirementAge, 61);
  assert.equal(person.superAccessAge, 60);
});

test("R6C-A single person shows full retirement and valid no-phase fallback", () => {
  const { viewModel } = project((draft) => {
    draft.people = [draft.people[0]];
    draft.people[0].currentAge = 40;
    draft.people[0].hasSemiRetirement = false;
    draft.people[0].semiRetirementAge = 60;
    draft.people[0].fullRetirementAge = 60;
  });
  assert.equal(viewModel.retirementTiming.fullRetirementValue, "Age 60");
  assert.equal(viewModel.retirementTiming.hasElectedPersonalSemiRetirement, false);
  assert.equal(viewModel.retirementTiming.hasHouseholdTransition, false);
});

test("R6C-B same-age couple retiring together has no household transition", () => {
  const { viewModel } = project((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 40;
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
    });
  });
  assert.equal(viewModel.retirementTiming.fullRetirementValue, "Age 60");
  assert.equal(viewModel.retirementTiming.hasHouseholdTransition, false);
});

test("R6C-C Taylor and Morgan staggered calendar retirement creates a household transition", () => {
  const { projection, viewModel } = project((draft) => {
    draft.people[0].currentAge = 40;
    draft.people[1].currentAge = 38;
    draft.people.forEach((person) => {
      person.hasSemiRetirement = false;
      person.semiRetirementAge = 60;
      person.fullRetirementAge = 60;
    });
  });
  const transitionRows = projection.years.filter((row) => row.householdPhase === "semi-retirement");
  const fullRetirementRow = projection.years.find((row) => row.householdPhase === "full-retirement");
  assert.ok(transitionRows.length > 0);
  assert.equal(viewModel.retirementTiming.hasElectedPersonalSemiRetirement, false);
  assert.equal(viewModel.retirementTiming.hasHouseholdTransition, true);
  assert.equal(viewModel.retirementTiming.householdTransition.startYear, transitionRows[0].calendarYear);
  assert.equal(viewModel.retirementTiming.householdTransition.endYear, fullRetirementRow.calendarYear);
  assert.equal(viewModel.retirementTiming.fullRetirementValue, "Age 60");
  assert.notEqual(viewModel.retirementTiming.householdTransition.value, "No household transition");
});

test("R6C-D one elected personal semi-retirement displays only that person's timing", () => {
  const { viewModel } = project((draft) => {
    draft.people[0].hasSemiRetirement = true;
    draft.people[0].semiRetirementAge = 55;
    draft.people[0].fullRetirementAge = 60;
    draft.people[1].hasSemiRetirement = false;
    draft.people[1].semiRetirementAge = 60;
    draft.people[1].fullRetirementAge = 60;
  });
  assert.equal(viewModel.retirementTiming.hasElectedPersonalSemiRetirement, true);
  assert.equal(viewModel.retirementTiming.personalSemiRetirementValue, "Taylor age 55");
});

test("R6C-E both elected personal semi-retirement timings are shown", () => {
  const { viewModel } = project((draft) => {
    draft.people[0].hasSemiRetirement = true;
    draft.people[0].semiRetirementAge = 55;
    draft.people[0].fullRetirementAge = 60;
    draft.people[1].hasSemiRetirement = true;
    draft.people[1].semiRetirementAge = 57;
    draft.people[1].fullRetirementAge = 62;
  });
  assert.equal(viewModel.retirementTiming.personalSemiRetirementValue, "Taylor age 55 / Morgan age 57");
});

test("R6C-F different full-retirement ages display per-person timing", () => {
  const { viewModel } = project((draft) => {
    draft.people.forEach((person) => {
      person.currentAge = 40;
      person.hasSemiRetirement = false;
    });
    draft.people[0].fullRetirementAge = 60;
    draft.people[0].semiRetirementAge = 60;
    draft.people[1].fullRetirementAge = 62;
    draft.people[1].semiRetirementAge = 62;
  });
  assert.equal(viewModel.retirementTiming.fullRetirementValue, "Taylor age 60 / Morgan age 62");
});

test("R6C-G genuinely missing timing uses safe fallback", () => {
  const timing = UI.buildRetirementTimingPresentation({ years: [] }, [
    { id: "person1", name: "Taylor", hasSemiRetirement: false, semiRetirementAge: null, fullRetirementAge: null },
  ]);
  assert.equal(timing.fullRetirementValue, "Not modelled");
  assert.equal(timing.personalSemiRetirementValue, "None selected");
  assert.equal(timing.hasHouseholdTransition, false);
});

test("R6C-8 household transition detection agrees with authoritative projection rows", () => {
  const { projection, viewModel } = project();
  const expected = projection.years.some((row) => row.householdPhase === "semi-retirement");
  assert.equal(viewModel.retirementTiming.hasHouseholdTransition, expected);
});

test("R6C-9 funding presentation covers elective and staggered transition years", () => {
  assert.match(appSource, /<h4>Transition \/ Semi-Retirement Funding<\/h4>/);
  assert.match(appSource, /including elected semi-retirement and staggered retirement dates/);
});

test("R6C snapshot renderer consumes the corrected timing presentation", () => {
  assert.match(appSource, /const timing = viewModel\.retirementTiming \|\| \{\}/);
  assert.match(appSource, /Household retirement transition/);
  assert.match(appSource, /Semi-retirement choice/);
});

test("R6C-11 building the presentation view model does not mutate projection arithmetic", () => {
  const { projection, beforeViewModel } = project();
  assert.equal(JSON.stringify(projection), beforeViewModel);
});
