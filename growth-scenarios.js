(function attachGrowthScenarios(root) {
  "use strict";
  const copy = (value) => structuredClone(value);
  const fields = () =>
    root.FFSForecastAssumptions.fields.filter((field) =>
      ["investment", "super", "home", "property"].includes(field.id),
    );
  function savedValues(plan) {
    return Object.fromEntries(
      root.FFSForecastAssumptions.resolve(plan)
        .filter((field) => fields().some((f) => f.id === field.id))
        .map((field) => [field.key, field.value]),
    );
  }
  function suggested(plan) {
    const base = savedValues(plan);
    return Object.fromEntries(
      ["Lower", "Base", "Higher"].map((name, index) => [
        name,
        {
          values: Object.fromEntries(
            fields().map((field) => {
              const offset =
                base[field.key] + (index - 1) * (field.property ? 2 : 3);
              // The assumptions adapter requires changed rates to be above -100%.
              return [
                field.key,
                index === 1 ? base[field.key] : Math.max(-99.99, offset),
              ];
            }),
          ),
          includeOverrides: false,
        },
      ]),
    );
  }
  function overlay(plan, scenario) {
    const api = root.FFSForecastAssumptions,
      baseline = api.draft(plan),
      draft = copy(baseline);
    if (
      !scenario ||
      Object.keys(scenario).some(
        (key) => !["values", "includeOverrides"].includes(key),
      ) ||
      typeof scenario.includeOverrides !== "boolean" ||
      !scenario.values ||
      Object.keys(scenario.values).some(
        (key) => !fields().some((field) => field.key === key),
      )
    )
      return {
        ok: false,
        errors: [{ message: "Unsupported growth scenario settings." }],
      };
    for (const field of fields())
      draft.values[field.key] = scenario.values[field.key];
    if (scenario.includeOverrides) {
      for (const asset of api.investments(plan).filter((item) => item.explicit))
        draft.assets[asset.id].expectedTotalReturnPct =
          scenario.values.expectedInvestmentReturnPct;
      draft.resetProperties = api
        .properties(plan)
        .filter((item) => item.canReset)
        .map((item) => item.id);
    }
    return api.apply(plan, draft, baseline);
  }
  function calculate(plan, scenario, forecast) {
    const applied = overlay(plan, scenario);
    if (!applied.ok) return applied;
    try {
      const result = forecast(copy(applied.plan));
      // A rejected retirement overlay must not silently switch just one card to
      // the legacy forecast while the other cards use plan-linked retirement.
      if (
        plan.personal?.retirementTiming?.people?.length &&
        !result.retirementProjection &&
        forecast(copy(plan)).retirementProjection
      ) {
        throw new Error(
          "These assumptions are unsupported by the plan-linked retirement forecast. Review them in Retirement Planning.",
        );
      }
      const rows = result.netWorthProjection.map((row, index) => {
        const wealth = result.financialFreedomProgressProjection[index];
        return {
          year: row.year,
          age: row.age,
          investments: result.investmentProjection[index]?.closingBalance,
          super: result.superProjection[index]?.closingBalance,
          home: wealth?.principalResidenceEquity,
          property: wealth?.investmentPropertyEquity,
          netWorth: row.closingBalance,
        };
      });
      // The legacy engine sanitizes non-finite arithmetic to zero. Reject a new
      // rate whose compounding cannot be represented, rather than show that zero.
      const horizon = Math.max(...rows.map((row) => row.year));
      const saved = savedValues(plan);
      if (
        fields().some(
          (field) =>
            !Object.is(scenario.values[field.key], saved[field.key]) &&
            !Number.isFinite(
              Math.pow(1 + scenario.values[field.key] / 100, horizon),
            ),
        )
      )
        throw new Error("These rates exceed the supported forecast range.");
      if (
        !rows.length ||
        rows.some((row) =>
          Object.values(row).some((value) => !Number.isFinite(value)),
        )
      )
        throw new Error("These rates exceed the supported forecast range.");
      const retirement = result.retirementProjection?.summary;
      return {
        ok: true,
        plan: applied.plan,
        result,
        rows,
        retirement: retirement
          ? {
              exhaustedYear: retirement.allRetirementFundsExhaustedYear,
              unfundedYear: retirement.firstUnfundedSpendingYear,
            }
          : null,
      };
    } catch (error) {
      return {
        ok: false,
        errors: [
          { message: error.message || "Unable to calculate this scenario." },
        ],
      };
    }
  }
  function display(row, inflation, basis) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        ["year", "age"].includes(key)
          ? value
          : root.FFSDollarBasis.displayedValue(
              value,
              row.year,
              inflation,
              basis,
            ),
      ]),
    );
  }
  root.FFSGrowthScenarios = Object.freeze({
    fields,
    savedValues,
    suggested,
    overlay,
    calculate,
    display,
  });
})(globalThis);
