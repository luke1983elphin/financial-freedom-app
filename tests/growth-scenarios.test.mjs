import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const c = { console, structuredClone };
c.globalThis = c;
c.window = c;
for (const file of [
  "calculator.js",
  "agePensionEstimate.js",
  "semiRetirementProjection.js",
  "semiRetirementUi.js",
  "v2-data.js",
  "forecast-assumptions.js",
  "dollar-basis.js",
  "growth-scenarios.js",
])
  vm.runInNewContext(
    readFileSync(new URL("../" + file, import.meta.url), "utf8"),
    c,
  );
const G = c.FFSGrowthScenarios,
  C = c.FFSCalculator,
  U = c.FFSSemiRetirementUi,
  A = c.FFSForecastAssumptions;
const plain = (v) =>
  v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const forecast = (p) => U.applyRetirementForecast(p, C.calculatePlan(p));
function fixture(timing = false) {
  const p = plain(C.emptyPlan());
  Object.assign(p.personal, {
    person1Age: 43,
    person2Age: 0,
    fullRetirementAge: 65,
    targetAnnualSpending: 40000,
  });
  p.assets.superPerson1 = 200000;
  p.assetItems = [
    {
      id: "shares",
      name: "Shares",
      category: "shares",
      owner: "person1",
      value: 500000,
      investmentReturnMode: "totalReturn",
      expectedTotalReturnPct: 8,
      expectedIncomeYieldPct: 3,
      incomeTreatment: "cash",
    },
    { id: "home", category: "home", value: 800000 },
    {
      id: "rental",
      category: "rentalInvestmentProperty",
      value: 400000,
      propertyGrowthRatePct: 4,
    },
  ];
  p.incomeItems = [
    {
      id: "salary",
      type: "salaryWages",
      owner: "person1",
      amount: 100000,
      frequency: "annually",
    },
    {
      id: "dividend",
      type: "dividends",
      owner: "person1",
      amount: 99999,
      linkedAssetId: "shares",
      frequency: "annually",
    },
  ];
  p.expenseItems = [
    { id: "living", category: "living", amount: 40000, frequency: "annually" },
  ];
  if (timing)
    p.personal.retirementTiming = {
      people: [
        {
          id: "person1",
          fullRetirementAge: 65,
          hasSemiRetirement: false,
          alreadyRetired: false,
        },
      ],
    };
  return p;
}
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
for (const timing of [false, true])
  test(`Base preserves complete forecast bit for bit, timing=${timing}`, () => {
    const p = fixture(timing),
      before = JSON.stringify(p),
      normal = JSON.stringify(forecast(p));
    freeze(p);
    const r = G.calculate(p, G.suggested(p).Base, forecast);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(JSON.stringify(r.plan), before);
    assert.equal(JSON.stringify(r.result), normal);
    assert.equal(JSON.stringify(p), before);
    assert.equal(Boolean(r.retirement), timing);
  });
test("all sample plans preserve full unadjusted Base results", () => {
  for (const sample of c.FFS_DATA.samplePlans) {
    const p = plain(sample.plan),
      r = G.calculate(p, G.suggested(p).Base, forecast);
    assert.equal(r.ok, true, sample.name + JSON.stringify(r.errors));
    assert.equal(JSON.stringify(r.result), JSON.stringify(forecast(p)));
  }
});
test("bands are offsets to effective values, including aliases and explicit zero", () => {
  const p = fixture();
  p.investing.expectedInvestmentReturnPct = 0;
  p.investing.expectedSuperReturnPct = 0;
  p.assumptions = { homeGrowthRate: 0, propertyGrowthRate: 0.043 };
  const s = G.suggested(p);
  assert.equal(s.Base.values.principalResidenceGrowthRatePct, 0);
  assert.equal(s.Lower.values.expectedInvestmentReturnPct, -3);
  assert.equal(s.Higher.values.expectedSuperReturnPct, 3);
  assert.equal(s.Higher.values.investmentPropertyGrowthRatePct, 6.3);
  const r = G.overlay(p, s.Higher);
  assert.equal(r.ok, true);
  assert.equal(r.plan.assumptions.homeGrowthRate, 0.02);
  assert.equal(r.plan.assumptions.propertyGrowthRate, 0.063);
  assert.equal(p.assumptions.homeGrowthRate, 0);
});
test("unchanged imported assumptions retain exact representation", () => {
  const p = fixture();
  p.assumptions = { propertyGrowthRate: 0.043, homeGrowthRatePct: 0 };
  p.investing.inflationPct = 0;
  assert.equal(
    JSON.stringify(G.overlay(p, G.suggested(p).Base).plan),
    JSON.stringify(p),
  );
});
test("all three overlays preserve unrelated inputs, snapshots and fixed overrides", () => {
  const p = fixture(true);
  p.savedScenarios = [
    {
      draft: plain(
        U.buildSemiRetirementScenarioDefaults(p, C.calculatePlan(p)).draft,
      ),
    },
  ];
  const before = JSON.stringify(p);
  for (const scenario of Object.values(G.suggested(p))) {
    const r = G.overlay(p, scenario);
    assert.equal(r.ok, true);
    for (const key of [
      "assetItems",
      "incomeItems",
      "expenseItems",
      "liabilityItems",
      "savedScenarios",
      "personal",
      "downsizing",
    ])
      assert.deepEqual(plain(r.plan[key]), plain(p[key]));
    assert.equal(r.plan.investing.inflationPct, p.investing.inflationPct);
  }
  assert.equal(JSON.stringify(p), before);
});
test("every global rate reaches the existing plan-linked dependency", () => {
  const p = fixture(true);
  delete p.assetItems[2].propertyGrowthRatePct;
  delete p.assetItems[0].investmentReturnMode;
  const base = G.calculate(p, G.suggested(p).Base, forecast);
  for (const [field, key] of [
    ["expectedInvestmentReturnPct", "investments"],
    ["expectedSuperReturnPct", "super"],
    ["principalResidenceGrowthRatePct", "home"],
    ["investmentPropertyGrowthRatePct", "property"],
  ]) {
    const s = G.suggested(p).Base;
    s.values[field] += 2;
    const r = G.calculate(p, s, forecast);
    assert.equal(r.ok, true);
    assert.notEqual(r.rows[5][key], base.rows[5][key], field);
  }
});
test("opt-in includes explicit investment and applicable property rates without changing yield or tax treatment", () => {
  for (const treatment of ["cash", "reinvest"]) {
    const p = fixture(true);
    p.assetItems[0].incomeTreatment = treatment;
    const s = G.suggested(p).Higher;
    s.includeOverrides = true;
    const r = G.calculate(p, s, forecast);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    const a = r.plan.assetItems[0];
    assert.equal(a.expectedTotalReturnPct, 10);
    assert.equal(a.expectedIncomeYieldPct, 3);
    assert.equal(a.incomeTreatment, treatment);
    assert.equal(r.plan.assetItems[2].propertyGrowthRatePct, undefined);
    assert.equal(C.investmentReturnAmounts(a).totalReturn, 50000);
    assert.equal(C.investmentReturnAmounts(a).taxableIncome, 15000);
    assert.equal(
      C.investmentReturnAmounts(a).cashIncome,
      treatment === "cash" ? 15000 : 0,
    );
    assert.equal(
      C.calculatePlan(r.plan).annualPassiveIncome,
      treatment === "cash" ? 15000 : 0,
    );
    assert.equal(r.plan.incomeItems[1].amount, 99999);
  }
});
test("home overrides remain fixed when unused by legacy forecast and can be included for plan-linked forecasts", () => {
  for (const timing of [false, true]) {
    const p = fixture(timing);
    p.assetItems[1].propertyGrowthRatePct = 9;
    const s = G.suggested(p).Higher;
    s.includeOverrides = true;
    const r = G.overlay(p, s);
    assert.equal(r.ok, true);
    assert.equal(
      r.plan.assetItems[1].propertyGrowthRatePct,
      timing ? undefined : 9,
    );
  }
});
test("invalid, unsupported and overflowing scenarios produce errors without mutation", () => {
  const p = fixture(),
    before = JSON.stringify(p);
  for (const v of [NaN, Infinity, "", null, -100, 1e300]) {
    const s = G.suggested(p).Base;
    s.values.expectedSuperReturnPct = v;
    assert.equal(G.calculate(p, s, forecast).ok, false, String(v));
  }
  const s = G.suggested(p).Base;
  s.values.inflationPct = 7;
  assert.equal(G.overlay(p, s).ok, false);
  const q = G.suggested(p).Base;
  q.includeOverrides = true;
  q.values.expectedInvestmentReturnPct = 2;
  assert.equal(G.calculate(p, q, forecast).ok, false);
  assert.equal(JSON.stringify(p), before);
});
test("all card/table/chart display amounts use identical saved inflation and completed-year horizon", () => {
  for (const inflation of [0, 2.5]) {
    const p = fixture(true);
    p.investing.inflationPct = inflation;
    for (const scenario of Object.values(G.suggested(p))) {
      const r = G.calculate(p, scenario, forecast);
      assert.equal(r.ok, true);
      const row = r.rows[9],
        today = G.display(row, inflation, "today"),
        future = G.display(row, inflation, "future");
      assert.deepEqual(plain(future), plain(row));
      for (const key of [
        "investments",
        "super",
        "home",
        "property",
        "netWorth",
      ])
        assert.equal(today[key], row[key] / (1 + inflation / 100) ** row.year);
    }
  }
});
test("suggested offsets stop at the adapter lower boundary and preserve an unchanged Base", () => {
  const p = fixture();
  p.investing.expectedInvestmentReturnPct = -99;
  const s = G.suggested(p);
  assert.equal(s.Base.values.expectedInvestmentReturnPct, -99);
  assert.equal(s.Lower.values.expectedInvestmentReturnPct, -99.99);
  assert.equal(G.overlay(p, s.Lower).ok, true);
});
test("a rejected plan-linked scenario cannot silently fall back to legacy forecasts", () => {
  const p = fixture(true),
    s = G.suggested(p).Higher;
  const fakeForecast = (next) =>
    next.investing.expectedSuperReturnPct === p.investing.expectedSuperReturnPct
      ? forecast(next)
      : C.calculatePlan(next);
  const r = G.calculate(p, s, fakeForecast);
  assert.equal(r.ok, false);
  assert.match(
    r.errors[0].message,
    /unsupported by the plan-linked retirement/,
  );
});
