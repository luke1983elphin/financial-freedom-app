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
      propertyGrowthRatePct: 3,
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
test("sample Base preserves the saved forecast when property rates match and never mutates the plan", () => {
  for (const sample of c.FFS_DATA.samplePlans) {
    const p = plain(sample.plan),
      r = G.calculate(p, G.suggested(p).Base, forecast);
    assert.equal(r.ok, true, sample.name + JSON.stringify(r.errors));
    const base=G.suggested(p).Base;
    const matches=A.properties(p).every(a=>a.value===base.values[a.group==='principal-residence'?'principalResidenceGrowthRatePct':'investmentPropertyGrowthRatePct']);
    if(matches)assert.equal(JSON.stringify(r.result), JSON.stringify(forecast(p)));
    else assert.ok(r.propertyRates.every(a=>a.value===base.values[a.group==='principal-residence'?'principalResidenceGrowthRatePct':'investmentPropertyGrowthRatePct']));
    assert.deepEqual(p,plain(sample.plan));
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
  p.assetItems[2].propertyGrowthRatePct=4.3;
  p.investing.inflationPct = 0;
  assert.equal(
    JSON.stringify(G.overlay(p, G.suggested(p).Base).plan),
    JSON.stringify(p),
  );
});
test("all three overlays preserve unrelated inputs, snapshots and financial-investment overrides", () => {
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
      "incomeItems",
      "expenseItems",
      "liabilityItems",
      "savedScenarios",
      "personal",
      "downsizing",
    ])
      assert.deepEqual(plain(r.plan[key]), plain(p[key]));
    assert.deepEqual(plain(r.plan.assetItems[0]),plain(p.assetItems[0]));
    assert.equal(r.plan.assetItems[2].value,p.assetItems[2].value);
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

const nonHomeTypes = ['investmentProperty','rentalInvestmentProperty','rentalProperty','residentialInvestmentProperty','commercialInvestmentProperty','incomeProducingProperty','otherProperty'];
function propertyFixture(type, timing, override=3) {
  const p=plain(C.emptyPlan());Object.assign(p.personal,{person1Name:'Alex',person1Age:43,fullRetirementAge:65,targetAnnualSpending:0});
  Object.assign(p.investing,{inflationPct:2.5,annualInvestingTarget:0});
  p.assetItems=[{id:'property',name:'Audited property',category:type,value:400000,owner:'person1',...(override===undefined?{}:{capitalGrowthRatePct:override})}];
  // The legacy aggregate mirrors this same canonical holding; it is not a second asset.
  p.assets.otherPropertyValue=400000;
  p.liabilityItems=[{id:'loan',name:'Linked loan',type:'rentalPropertyLoan',linkedAssetId:'property',balance:100000,interestRatePct:0,repayment:0,termYears:30,repaymentType:'interestOnly'}];
  if(timing)p.personal.retirementTiming={people:[{id:'person1',fullRetirementAge:65,hasSemiRetirement:false,alreadyRetired:false}]};
  return p;
}
for(const timing of [false,true])for(const type of nonHomeTypes)test(`Issue 95: ${type}, timing=${timing}, default scenario rates reconcile equity and total wealth`,()=>{
  const p=propertyFixture(type,timing),before=JSON.stringify(p),bands=G.suggested(p);
  const fixed=Object.values(bands).map(s=>G.calculate(p,s,forecast));
  assert.ok(fixed.every(r=>r.ok));
  assert.equal(new Set(fixed.map(r=>r.rows.find(row=>row.year===15).property)).size,3);
  assert.ok(fixed.every(r=>r.propertyRates.find(a=>a.id==='property').treatment==='Scenario rate'));
  for(const scenario of Object.values(bands)){
    const r=G.calculate(p,scenario,forecast);assert.equal(r.ok,true,JSON.stringify(r.errors));
    const row=r.rows.find(row=>row.year===15),rate=scenario.values.investmentPropertyGrowthRatePct;
    const expected=400000*(1+rate/100)**15-100000;
    assert.ok(Math.abs(row.property-expected)<.1,`${row.property} vs ${expected}`);
    assert.equal(row.netWorth,row.property,'one canonical property, one debt, no phantom aggregate');
    assert.equal(C.projectedDebtAtYear(r.result,15),100000);
    assert.equal(r.propertyRates.find(a=>a.id==='property').value,rate);
    const today=G.display(row,2.5,'today'),future=G.display(row,2.5,'future');
    assert.equal(future.property,row.property);assert.equal(today.property,row.property/1.025**15);assert.equal(today.netWorth,today.property);
    if(timing){assert.equal(r.result.retirementProjection.years[14].properties.length,1);assert.equal(r.result.retirementProjection.years[14].properties[0].linkedLoanClosingBalance,100000);}
  }
  assert.equal(JSON.stringify(p),before);
});

test('Issue 95: inherited rental rates respond by default for every non-home investment classification',()=>{
  for(const timing of [false,true])for(const type of nonHomeTypes.filter(t=>t!=='otherProperty')){
    const p=propertyFixture(type,timing);delete p.assetItems[0].capitalGrowthRatePct;
    const values=Object.values(G.suggested(p)).map(s=>{const r=G.calculate(p,s,forecast);assert.equal(r.ok,true);return r.rows.find(row=>row.year===15).property;});
    assert.ok(values[0]<values[1]&&values[1]<values[2],type);
  }
});

test('Issue 95: Other property zero fallback remains in normal forecasts while comparisons use scenario growth',()=>{
  for(const legacyOnly of [false,true]){
    const p=propertyFixture('otherProperty',true);delete p.assetItems[0].capitalGrowthRatePct;
    if(legacyOnly){p.assetItems=[];p.liabilityItems=[];}
    const before=JSON.stringify(p),bands=G.suggested(p);
    for(const s of Object.values(bands)){
      assert.equal(A.properties(p)[0].value,0);
      const fixed=G.calculate(p,s,forecast);assert.equal(fixed.propertyRates[0].value,s.values.investmentPropertyGrowthRatePct);assert.equal(fixed.propertyRates[0].treatment,'Scenario rate');
      s.includeOverrides=true;const changed=G.calculate(p,s,forecast);assert.equal(changed.ok,true,JSON.stringify(changed.errors));
      assert.equal(changed.propertyRates[0].value,s.values.investmentPropertyGrowthRatePct);assert.equal(changed.propertyRates[0].treatment,'Scenario rate');
    }
    assert.equal(JSON.stringify(p),before);
  }
});

test('Issue 95: removed and zero-value canonical properties do not resurrect stale legacy aggregates',()=>{
  for(const mutate of [a=>a.value=0,a=>a.isDeleted=true]){
    const p=propertyFixture('investmentProperty',true);p.liabilityItems=[];mutate(p.assetItems[0]);
    const draft=U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft;
    assert.equal(draft.assets.filter(a=>a.propertyTypeGroup==='investment-property'||a.propertyTypeGroup==='other-property').length,0);
  }
});

test('Issue 95: historical retirement snapshot inputs and outcomes survive corrected live property mapping',()=>{
  const p=propertyFixture('investmentProperty',true);const saved=plain(U.buildSemiRetirementScenarioDefaults(p,C.calculatePlan(p)).draft);
  saved.assets.push({...saved.assets[0],id:'historical-extra',name:'Historical additional holding',openingValue:12345});
  const before=JSON.stringify(saved),outcome=JSON.stringify(U.runSemiRetirementProjection(c.FFSSemiRetirementProjection,saved));
  p.savedScenarios=[{draft:saved}];const s=G.suggested(p).Higher;s.includeOverrides=true;const r=G.calculate(p,s,forecast);
  assert.equal(r.ok,true);assert.equal(JSON.stringify(saved),before);assert.equal(JSON.stringify(U.runSemiRetirementProjection(c.FFSSemiRetirementProjection,saved)),outcome);
  assert.deepEqual(plain(r.plan.savedScenarios),plain(p.savedScenarios));
});

// Independently reconcile the two previously duplicated sample-plan fixtures.
// All other fields (including tax, pensions, debt and funding) must remain exact.
test('Issue 95: full financial fixture changes are only removal of duplicated property wealth',async()=>{
  const {gunzipSync}=await import('node:zlib');const {capture}=await import('../scripts/ux-stage1-parity.mjs');
  const expected=JSON.parse(gunzipSync(readFileSync(new URL('fixtures/ux-stage1-before.pre-issue95.json.gz',import.meta.url))));
  const adjustments={'established-family-wealth-building':690000,'pre-retirement':760000};
  const subtract=(object,keys,value)=>keys.forEach(key=>object[key]=Math.round((object[key]-value)*100)/100);
  const remove=assets=>assets.filter(asset=>(asset.id||asset.assetId)!=='legacy-other-property');
  for(const fixture of expected){const value=adjustments[fixture.name];if(!value)continue;
    fixture.records.draft.assets=remove(fixture.records.draft.assets);
    for(const key of ['retirement','scenario']){
      const outcome=fixture.records[key];outcome.inputs.assets=remove(outcome.inputs.assets);
      for(const row of outcome.result.years){row.assets=remove(row.assets);row.properties=remove(row.properties);subtract(row.household,['totalPropertyValue','totalPropertyEquity','totalNetWorth'],value);}
      subtract(outcome.result.summary,['totalPropertyValueAtEndAge','totalPropertyEquityAtEndAge','totalNetWorthAtEndAge'],value);
      const retained=outcome.result.summary.retainedAssets;retained.assets=remove(retained.assets);subtract(retained,['totalValue','totalNetEquity'],value);
    }
  }
  assert.deepEqual(capture(),expected);
});

test('Issue 95: explicit zero and decimal overrides remain in My Plan while all property comparisons vary',()=>{
  for(const category of [...nonHomeTypes,'home','principalResidence','principal_residence']){
    const p=propertyFixture(category,true);if(['home','principalResidence','principal_residence'].includes(category)){p.assets.homeValue=400000;p.assets.otherPropertyValue=0;p.liabilityItems=[];}
    for(const settings of [{capitalGrowthRatePct:0},{capitalGrowthRate:.03}]){
      delete p.assetItems[0].capitalGrowthRatePct;delete p.assetItems[0].capitalGrowthRate;Object.assign(p.assetItems[0],settings);
      const scenario=G.suggested(p).Higher,original=JSON.stringify(p),fixed=G.calculate(p,scenario,forecast);
      assert.equal(fixed.ok,true);assert.equal(fixed.propertyRates[0].value,5);assert.equal(A.properties(p)[0].value,settings.capitalGrowthRatePct===0?0:3);
      scenario.includeOverrides=true;const varied=G.calculate(p,scenario,forecast);assert.equal(varied.ok,true);assert.equal(varied.propertyRates[0].value,5);assert.equal(JSON.stringify(p),original);
    }
  }
});

test('Issue 95: scenario growth leaves principal-and-interest debt schedules unchanged',()=>{
  for(const timing of [false,true]){
    const p=propertyFixture('investmentProperty',timing);Object.assign(p.liabilityItems[0],{interestRatePct:6,repayment:10000,repaymentFrequency:'annually',repaymentType:'principalAndInterest'});
    const schedules=Object.values(G.suggested(p)).map(s=>{s.includeOverrides=true;const r=G.calculate(p,s,forecast);assert.equal(r.ok,true);return Array.from({length:15},(_,i)=>C.projectedDebtAtYear(r.result,i+1));});
    assert.deepEqual(schedules[0],schedules[1]);assert.deepEqual(schedules[1],schedules[2]);assert.ok(schedules[0][14]<100000);
  }
});

test('Issue 98: Eagle Point, another investment property and land follow scenario property rates with exact matching Base parity',()=>{
  const p=fixture(true);p.assetItems[2].name='259 Eagle Point Road';
  p.assetItems.push({id:'land',name:'Vacant land',category:'otherProperty',value:200000,capitalGrowthRatePct:3},{id:'commercial',name:'Commercial property',category:'commercialInvestmentProperty',value:300000,capitalGrowthRatePct:3});
  p.assets.otherPropertyValue=900000;p.assets.homeValue=800000;
  p.liabilityItems=[{id:'loan',type:'rentalPropertyLoan',linkedAssetId:'rental',balance:100000,interestRatePct:6,repayment:10000,repaymentFrequency:'annually',termYears:30,repaymentType:'principalAndInterest'}];
  const before=JSON.stringify(p),normal=JSON.stringify(forecast(p)),bands=G.suggested(p);
  const base=G.calculate(p,bands.Base,forecast);assert.equal(base.ok,true);assert.equal(JSON.stringify(base.plan),before);assert.equal(JSON.stringify(base.result),normal);
  const results=Object.values(bands).map(s=>G.calculate(p,s,forecast));
  results.forEach((r,index)=>{assert.equal(r.ok,true);assert.ok(r.propertyRates.filter(a=>a.group!=='principal-residence').every(a=>a.value===[1,3,5][index]));assert.equal(r.plan.assetItems[0].expectedTotalReturnPct,8);});
  const values=results.map(r=>r.rows.find(row=>row.year===15).property);assert.ok(values[0]<values[1]&&values[1]<values[2]);
  const debt=results.map(r=>C.projectedDebtAtYear(r.result,15));assert.equal(new Set(debt).size,1);
  const different=G.suggested(p).Higher;different.values.principalResidenceGrowthRatePct=9;different.values.expectedInvestmentReturnPct=12;
  const separated=G.calculate(p,different,forecast);assert.equal(separated.propertyRates.find(a=>a.group==='principal-residence').value,9);assert.ok(separated.propertyRates.filter(a=>a.group!=='principal-residence').every(a=>a.value===5));
  assert.equal(JSON.stringify(p),before);assert.equal(JSON.stringify(forecast(p)),normal);
});

test('Issue 98: financial-investment checkbox changes returns without controlling property growth',()=>{
  const p=fixture(true),s=G.suggested(p).Higher;
  const unchecked=G.calculate(p,s,forecast);s.includeOverrides=true;const checked=G.calculate(p,s,forecast);
  assert.equal(unchecked.plan.assetItems[0].expectedTotalReturnPct,8);assert.equal(checked.plan.assetItems[0].expectedTotalReturnPct,10);
  assert.deepEqual(plain(unchecked.propertyRates),plain(checked.propertyRates));
  assert.deepEqual(plain(unchecked.result.retirementProjection.years.map(r=>r.properties)),plain(checked.result.retirementProjection.years.map(r=>r.properties)));
  assert.equal(p.assetItems[2].propertyGrowthRatePct,3);
});

test('Issue 98: Base uses plan-wide comparison rates when saved individual property rates differ',()=>{
  const p=fixture(true);p.assetItems[2].propertyGrowthRatePct=9;const original=JSON.stringify(p),normal=JSON.stringify(forecast(p));
  const base=G.calculate(p,G.suggested(p).Base,forecast);assert.equal(base.ok,true);assert.equal(base.propertyRates.find(a=>a.id==='rental').value,3);
  assert.notEqual(JSON.stringify(base.plan),original);assert.notEqual(JSON.stringify(base.result),normal);assert.equal(JSON.stringify(p),original);assert.equal(JSON.stringify(forecast(p)),normal);
});

test('Issue 98: matching Base preserves existing Other property override representations exactly',()=>{
  for(const [key,value] of Object.entries({capitalGrowthRatePct:3,propertyGrowthRatePct:3,annualGrowthRatePct:3,assetSpecificGrowthRatePct:3,capitalGrowthRate:.03,propertyGrowthRate:.03})){
    const p=propertyFixture('otherProperty',true);delete p.assetItems[0].capitalGrowthRatePct;p.assetItems[0][key]=value;
    const before=JSON.stringify(p),normal=JSON.stringify(forecast(p)),r=G.calculate(p,G.suggested(p).Base,forecast);
    assert.equal(r.ok,true);assert.equal(JSON.stringify(r.plan),before,key);assert.equal(JSON.stringify(r.result),normal,key);
  }
});
