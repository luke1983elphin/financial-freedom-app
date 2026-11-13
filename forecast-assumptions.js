(function attachForecastAssumptions(root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const get = (object, path) => path.split(".").reduce((item, key) => item?.[key], object);
  const set = (object, path, value) => {
    const keys = path.split("."), last = keys.pop();
    const parent = keys.reduce((item, key) => item[key] ||= {}, object);
    parent[last] = value;
  };
  const fields = Object.freeze([
    { id: "investment", key: "expectedInvestmentReturnPct", label: "Investment return", group: "essential", note: "Total annual return for investments without their own rate. Includes growth and income; individual investment settings take priority." },
    { id: "super", key: "expectedSuperReturnPct", label: "Superannuation return", group: "essential", note: "Used for your plan's super forecast. New retirement projections start with this rate before retirement and one percentage point less afterwards, with a minimum of zero." },
    { id: "home", key: "principalResidenceGrowthRatePct", label: "Principal residence growth", group: "essential", property: "home", note: "Growth in your home's value. Property equity is not automatically available to pay for retirement." },
    { id: "property", key: "investmentPropertyGrowthRatePct", label: "Investment property growth", group: "essential", property: "investment", note: "Growth in property value, not rental income. An individual property's growth assumption takes priority." },
    { id: "inflation", key: "inflationPct", label: "Inflation", group: "essential", note: "Raises future retirement spending and modelled rental cash income. Also converts future amounts into today's purchasing power." },
    { id: "wages", key: "wageGrowthPct", label: "Wage growth", group: "advanced", note: "Used when your plan has saved retirement timing. The older wealth-building forecast keeps wages fixed." },
    { id: "withdrawal", key: "safeWithdrawalRatePct", label: "Illustrative safe withdrawal rate", group: "advanced", note: "Estimates financial freedom targets and income illustrations; it is not a guaranteed safe rate or the detailed retirement spending rule. An entered zero uses the existing 4% fallback." }
  ].map(Object.freeze));
  function propertyPaths(kind) {
    const names = kind === "home" ? ["principalResidenceGrowth", "homeGrowth"] : ["investmentPropertyGrowth", "propertyGrowth"];
    return ["Pct", ""].flatMap(suffix => ["investing", "assumptions"].flatMap(section => names.map(name => ({ path: `${section}.${name}Rate${suffix}`, scale: suffix ? 1 : 100 }))));
  }
  function propertySource(plan, kind) {
    return propertyPaths(kind).find(item => {
      const raw = get(plan, item.path);
      return raw != null && raw !== "" && (Number(raw) || 0) * item.scale >= -100;
    });
  }
  function defaultValue(field) {
    const calc = root.FFSCalculator;
    if (field.property) return (field.property === "home" ? calc.DEFAULT_PRINCIPAL_RESIDENCE_GROWTH_RATE : calc.DEFAULT_INVESTMENT_PROPERTY_GROWTH_RATE) * 100;
    return calc.emptyPlan().investing[field.key];
  }
  function resolve(plan = {}) {
    const calc = root.FFSCalculator;
    return fields.map(field => {
      const source = field.property ? propertySource(plan, field.property) : own(plan.investing, field.key) ? { path: `investing.${field.key}`, scale: 1 } : null;
      const value = field.property
        ? (field.property === "home" ? calc.principalResidenceGrowthRateForAsset(plan) : calc.propertyGrowthRateForAsset(plan)) * 100
        : source ? (Number(get(plan, source.path)) || 0) : defaultValue(field);
      return { ...field, value: Number(value.toFixed(10)), effective: field.id === "withdrawal" && value <= 0 ? defaultValue(field) : value,
        path: source?.path || `investing.${field.key}`, scale: source?.scale || 1,
        source: source ? (source.path === `investing.${field.key}` ? "Saved plan" : "Imported plan setting") : "App default",
        editable: field.id !== "wages" || Boolean(plan.personal?.retirementTiming?.people?.length) };
    });
  }
  function investments(plan = {}) {
    return (plan.assetItems || []).filter(asset => root.FFSCalculator.isActiveFinancialRecord(asset)
      && root.FFSCalculator.assetCapabilities(asset.category, asset).supportsFinancialInvestmentReturn).map(asset => ({
        id: asset.id, name: asset.name || "Investment", explicit: asset.investmentReturnMode === "totalReturn",
        supportsIncome: root.FFSCalculator.assetCapabilities(asset.category, asset).supportsInvestmentIncomeYield,
        expectedTotalReturnPct: asset.investmentReturnMode === "totalReturn" ? asset.expectedTotalReturnPct : resolve(plan).find(f=>f.id === "investment").value,
        expectedIncomeYieldPct: asset.expectedIncomeYieldPct, incomeTreatment: asset.incomeTreatment,
      }));
  }
  function properties(plan = {}) {
    const retirement = Boolean(plan.personal?.retirementTiming?.people?.length);
    const projected = root.FFSSemiRetirementUi.buildSemiRetirementScenarioDefaults(root.FFSCalculator.clonePlan(plan), {}).draft.assets;
    return (plan.assetItems || []).filter(asset => root.FFSCalculator.isActiveFinancialRecord(asset)
      && root.FFSCalculator.assetCapabilities(asset.category).supportsPropertyGrowth).map(asset => {
        const snapshot = projected.find(item=>item.id===asset.id);
        const individual = propertyOverrideKeys(asset).length > 0;
        const main = (asset.category === "home" ? root.FFSCalculator.principalResidenceGrowthRateForAsset(plan) : root.FFSCalculator.propertyGrowthRateForAsset(plan, asset)) * 100;
        const supportedMainKeys = ["propertyGrowthRatePct","capitalGrowthRatePct","expectedGrowthRatePct","growthRatePct","propertyGrowthRate","capitalGrowthRate","expectedGrowthRate","growthRate"];
        const applicable = retirement ? snapshot?.growthRateSource === "asset-specific" : asset.category !== "home" && supportedMainKeys.some(key=>own(asset,key));
        return {id:asset.id,name:asset.name || "Property",value:Number((retirement && snapshot ? snapshot.annualGrowthRatePct : main).toFixed(10)),
          source:applicable ? "Individual property setting" : "Plan default",canReset:individual && applicable,
          note: individual && !applicable ? `A separate property setting is retained for retirement projections (${snapshot?.annualGrowthRatePct ?? "not available"}%). It is not used by this plan's current forecast.` : ""};
      });
  }
  // Recognise existing fields; never add an inheritance flag or change the schema.
  function propertyOverrideKeys(asset) {
    return ["principalResidenceGrowth", "homeGrowth", "propertyGrowth", "capitalGrowth", "expectedGrowth", "growth", "assetSpecificGrowth", "annualGrowth"]
      .flatMap(name => [`${name}RatePct`, `${name}Rate`]).filter(key => own(asset, key));
  }
  function draft(plan) {
    return { values: Object.fromEntries(resolve(plan).map(field => [field.key, field.value])),
      assets: Object.fromEntries(investments(plan).filter(asset=>asset.explicit).map(asset => [asset.id, {
        expectedTotalReturnPct: asset.expectedTotalReturnPct, expectedIncomeYieldPct: asset.expectedIncomeYieldPct, incomeTreatment: asset.incomeTreatment,
      }])), resetProperties: [] };
  }
  function apply(plan, input, baseline = draft(plan)) {
    const next = clone(plan), errors = [], changed = [];
    for (const field of resolve(plan)) {
      const value = input.values?.[field.key];
      if (Object.is(value, baseline.values[field.key])) continue;
      if (!field.editable) { errors.push({key:field.key,message:"Save your retirement timing before changing wage growth here."}); continue; }
      if (typeof value !== "number" || !Number.isFinite(value)) errors.push({key:field.key,message:"Enter a finite percentage."});
      else if (value <= -100 || (field.id === "withdrawal" && value < 0)) errors.push({key:field.key,message:field.id === "withdrawal" ? "Enter zero or a positive withdrawal rate." : "Enter a rate greater than -100%."});
      else { set(next, field.path, value / field.scale); changed.push(field.key); }
    }
    for (const asset of investments(plan).filter(a=>a.explicit)) {
      const values = input.assets?.[asset.id], before = baseline.assets?.[asset.id];
      if (!values || !before) continue;
      const record = next.assetItems.find(item=>item.id===asset.id);
      const updates = Object.keys(before).filter(key=>!Object.is(values[key],before[key]));
      if (!updates.length) continue;
      for (const key of updates) {
        if (key !== "expectedTotalReturnPct" && !asset.supportsIncome) errors.push({key:`${asset.id}.${key}`,message:"Income settings are not supported for this investment."});
        if (key !== "incomeTreatment" && (typeof values[key] !== "number" || !Number.isFinite(values[key]))) errors.push({key:`${asset.id}.${key}`,message:"Enter a finite percentage."});
        record[key] = values[key];
      }
      for (const message of root.FFSCalculator.investmentReturnValidation(record)) errors.push({key:`${asset.id}.expectedTotalReturnPct`,message});
      changed.push(`asset:${asset.id}`);
    }
    for (const id of input.resetProperties || []) {
      const asset = next.assetItems?.find(item=>item.id===id);
      if (!asset || !properties(plan).some(item=>item.id===id && item.canReset)) { errors.push({key:"property",message:"This property override is not used by the current forecast. Review it in Retirement Planning."}); continue; }
      for (const key of propertyOverrideKeys(asset)) delete asset[key];
      changed.push(`property:${id}`);
    }
    return errors.length ? {ok:false,errors} : {ok:true,plan:next,changed};
  }
  function defaultsPreview(plan, input) {
    return resolve(plan).filter(field=>field.editable).map(field => ({key:field.key,label:field.label,from:input.values[field.key],to:defaultValue(field)}));
  }
  const api = Object.freeze({fields,resolve,investments,properties,draft,apply,defaultsPreview});
  root.FFSForecastAssumptions = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
