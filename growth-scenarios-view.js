(function attachGrowthScenariosView(root) {
  "use strict";
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const money = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);
  const names = ["Lower", "Base", "Higher"];
  const metrics = [
    ["investments", "Investments"],
    ["super", "Super"],
    ["home", "Home equity"],
    ["property", "Investment property equity"],
    ["netWorth", "Total net worth"],
  ];
  function mount(
    container,
    { getPlan, getIdentity, forecast, getBasis, onRetirement, isDemo },
  ) {
    const api = root.FFSGrowthScenarios;
    let snapshot,
      signature,
      identity,
      scenarios,
      opened = false,
      year = 10,
      basis,
      results;
    const trigger = make("button", "btn", "Compare growth scenarios");
    trigger.type = "button";
    trigger.dataset.growthOpen = "";
    trigger.setAttribute("aria-expanded", "false");
    const panel = make("section", "growth-panel");
    panel.hidden = true;
    panel.id = "growth-comparison-panel";
    trigger.setAttribute("aria-controls", panel.id);
    container.append(trigger, panel);
    function reset() {
      snapshot = structuredClone(getPlan());
      signature = JSON.stringify(snapshot);
      identity = getIdentity();
      scenarios = api.suggested(snapshot);
      results = null;
    }
    function compute() {
      results = Object.fromEntries(
        names.map((name) => [
          name,
          api.calculate(snapshot, scenarios[name], forecast),
        ]),
      );
    }
    function render() {
      panel.replaceChildren();
      basis = getBasis();
      const heading = make("h2", "", "Compare growth scenarios");
      heading.tabIndex = -1;
      panel.append(heading);
      panel.append(
        make(
          "p",
          "",
          "Illustrative deterministic assumptions, not likelihoods, confidence intervals or financial advice. All edits stay in this comparison session. Base starts with saved plan-wide rates; properties use those comparison rates even if their My Plan individual rates differ. Unsaved Assumptions edits are excluded.",
        ),
      );
      if (isDemo())
        panel.append(
          make(
            "p",
            "fa-notice",
            "Sample plan comparison. Your personal plan is unchanged.",
          ),
        );
      const inflation = root.FFSForecastAssumptions.resolve(snapshot).find(
        (field) => field.id === "inflation",
      ).value;
      panel.append(
        make(
          "p",
          "fa-notice",
          `Showing ${basis === "today" ? "today’s purchasing power" : "future dollars"}. All scenarios use saved inflation (${inflation}%). Use the page’s Today’s Dollars / Future Dollars toggle to change every comparison value.`,
        ),
      );
      const actions = make("div", "forecast-assumptions-actions");
      function button(text, action) {
        const node = make("button", "btn", text);
        node.type = "button";
        node.addEventListener("click", action);
        return node;
      }
      actions.append(
        button("Reset to suggested bands", () => {
          scenarios = api.suggested(snapshot);
          compute();
          render();
          panel.querySelector("h2").focus();
        }),
        button("Reset Base to saved values", () => {
          scenarios.Base = api.suggested(snapshot).Base;
          compute();
          render();
          panel.querySelector("h2").focus();
        }),
        button("Close comparison", () => {
          opened = false;
          panel.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
          trigger.focus();
        }),
      );
      panel.append(actions);
      const overrides = make("details", "growth-overrides");
      overrides.append(
        make("summary", "", "How comparison rates are applied"),
      );
      overrides.append(
        make(
          "p",
          "",
          "Properties automatically use the scenario property growth fields. Individual financial-investment total-return rates stay fixed unless you select the investment-return checkbox. Income yield, cash/reinvestment treatment, taxes and loan settings remain unchanged. Total return already includes yield. A total return below an existing income yield is rejected.",
        ),
      );
      for (const asset of root.FFSForecastAssumptions.investments(
        snapshot,
      ).filter((a) => a.explicit))
        overrides.append(
          make(
            "p",
            "",
            `${asset.name}: fixed total return ${asset.expectedTotalReturnPct}%, income yield ${asset.expectedIncomeYieldPct ?? 0}% (${asset.incomeTreatment}).`,
          ),
        );
      for (const asset of root.FFSForecastAssumptions.properties(snapshot))
        overrides.append(
          make(
            "p",
            "",
            `${asset.name}: My Plan ${asset.value}% · ${asset.source}. Comparison uses ${asset.group === "principal-residence" ? "Principal residence growth" : "Investment property growth"}.`,
          ),
        );
      overrides.append(
        make(
          "p",
          "",
          "The checkbox affects financial investments only; properties never require it. My Plan individual rates and normal retirement forecasts remain unchanged. Home and investment property figures below are equity after modelled debt; property equity is not automatically available for retirement spending.",
        ),
      );
      panel.append(
        make(
          "p",
          "field-help",
          "Properties automatically follow their scenario growth field: homes use Principal residence growth; investment properties and Other property/land use Investment property growth. The effective rates are shown in each scenario. My Plan and saved retirement snapshots keep their own rates.",
        ),
      );
      panel.append(overrides);
      const selector = make("label", "growth-year", "Forecast year "),
        select = make("select", "field-input");
      select.dataset.growthYear = "";
      const available = results.Base.ok
        ? results.Base.rows
        : names.map((n) => results[n]).find((r) => r.ok)?.rows || [];
      if (available.length && !available.some((row) => row.year === year))
        year = available.at(-1).year;
      for (const row of available) {
        const option = make("option", "", `Year ${row.year} · age ${row.age}`);
        option.value = row.year;
        select.append(option);
      }
      select.value = year;
      select.addEventListener("change", () => {
        year = Number(select.value);
        draw();
      });
      selector.append(select);
      panel.append(selector);
      const cards = make("div", "growth-cards"),
        output = make("div", "growth-output");
      panel.append(cards, output);
      for (const name of names) {
        const card = make(
          "section",
          `growth-card growth-${name.toLowerCase()}`,
        );
        card.append(make("h3", "", name));
        card.append(
          make(
            "p",
            "field-help",
            name === "Base"
              ? "Starts at saved plan-wide rates. Base matches the saved forecast when its property rates match the rates used by that forecast. All changes are session-only."
              : `${name === "Lower" ? "−" : "+"}3 percentage points for investments/super; ${name === "Lower" ? "−" : "+"}2 for property, from saved Base. Suggested bands stop at −99.99% where needed to stay above the engine’s −100% limit. Manual edits do not relabel the scenario.`,
          ),
        );
        for (const field of api.fields()) {
          const label = make("label", "", `${field.label} (%)`),
            input = make("input", "field-input");
          input.type = "number";
          input.step = "any";
          input.inputMode = "decimal";
          input.value = scenarios[name].values[field.key];
          input.dataset.growthScenario = name;
          input.dataset.growthField = field.key;
          input.setAttribute("aria-label", `${name} ${field.label} (%)`);
          input.addEventListener("input", () => {
            scenarios[name].values[field.key] =
              input.value.trim() === "" ? NaN : Number(input.value);
            results[name] = api.calculate(snapshot, scenarios[name], forecast);
            draw();
          });
          label.append(input);
          card.append(label);
        }
        const label = make("label", "growth-include"),
          check = make("input");
        check.type = "checkbox";
        check.checked = scenarios[name].includeOverrides;
        check.dataset.growthOverrides = name;
        check.setAttribute(
          "aria-label",
          `${name}: apply scenario return to individual investments`,
        );
        check.addEventListener("change", () => {
          scenarios[name].includeOverrides = check.checked;
          results[name] = api.calculate(snapshot, scenarios[name], forecast);
          draw();
        });
        label.append(
          check,
          document.createTextNode(" Apply scenario return to individual investments"),
        );
        card.append(label);
        const error = make("p", "fa-field-error");
        error.dataset.growthError = name;
        error.setAttribute("role", "alert");
        card.append(error);
        const summary = make("div", "growth-card-result");
        summary.dataset.growthResult = name;
        summary.setAttribute("aria-live", "polite");
        card.append(summary);
        cards.append(card);
      }
      function draw() {
        const displayed = {};
        for (const name of names) {
          const result = results[name],
            card = cards.querySelector(`[data-growth-result="${name}"]`),
            error = cards.querySelector(`[data-growth-error="${name}"]`);
          card.replaceChildren();
          error.textContent = result.ok
            ? ""
            : result.errors.map((e) => e.message).join(" ");
          cards
            .querySelectorAll(`[data-growth-scenario="${name}"]`)
            .forEach((input) =>
              input.setAttribute("aria-invalid", String(!result.ok)),
            );
          if (!result.ok) continue;
          const row = result.rows.find((row) => row.year === year);
          if (!row) {
            error.textContent = "This year is unavailable for this scenario.";
            continue;
          }
          if (name === "Base")
            card.append(
              make(
                "p",
                "fa-state",
                JSON.stringify(result.plan) === JSON.stringify(snapshot)
                  ? "Base matches saved plan"
                  : "Base has session-only edits",
              ),
            );
          displayed[name] = api.display(row, inflation, basis);
          const rates = make("ul", "growth-property-rates");
          rates.setAttribute("aria-label", name + " effective property growth rates");
          for (const property of result.propertyRates) {
            rates.append(make("li", "", property.name + ": " + property.value + "% — " + property.treatment));
          }
          if (result.propertyRates.length) card.append(rates);
          card.append(
            make("p", "", `Year ${year} net worth`),
            make("strong", "growth-total", money(displayed[name].netWorth)),
          );
          const base = results.Base.ok
            ? results.Base.rows.find((r) => r.year === year)
            : null;
          if (base) {
            const diff =
              displayed[name].netWorth -
              api.display(base, inflation, basis).netWorth;
            card.append(
              make(
                "p",
                "",
                `${diff > 0 ? "+" : ""}${money(diff)} relative to Base`,
              ),
            );
          }
          if (result.retirement)
            card.append(
              make(
                "p",
                "field-help",
                `Plan-linked retirement: private funds exhausted ${result.retirement.exhaustedYear ?? "not within projection"}; first unfunded spending ${result.retirement.unfundedYear ?? "not within projection"}.`,
              ),
            );
          else
            card.append(
              make(
                "p",
                "field-help",
                "Retirement funding/exhaustion comparison unavailable for this forecast.",
              ),
            );
        }
        output.replaceChildren();
        const chart = make("div", "growth-chart");
        chart.setAttribute("role", "img");
        chart.setAttribute(
          "aria-label",
          `Year ${year} total net worth comparison; exact values are in the comparison results below.`,
        );
        const max = Math.max(
          1,
          ...Object.values(displayed).map((row) => Math.abs(row.netWorth)),
        );
        for (const name of names) {
          if (!displayed[name]) continue;
          const row = make("div", "growth-bar-row"),
            label = make("span", "", name),
            bar = make("meter");
          bar.min = Math.min(
            0,
            ...Object.values(displayed).map((row) => row.netWorth),
          );
          bar.max = max;
          bar.value = displayed[name].netWorth;
          bar.setAttribute(
            "aria-label",
            `${name} total net worth ${money(bar.value)}`,
          );
          row.append(label, bar, make("span", "", money(bar.value)));
          chart.append(row);
        }
        output.append(chart);
        const scroll = make("div", "growth-table-scroll"),
          table = make("table", "growth-table");
        scroll.tabIndex = 0;
        scroll.setAttribute("role", "region");
        scroll.setAttribute(
          "aria-label",
          "Growth comparison table",
        );
        table.append(
          make(
            "caption",
            "",
            `Year ${year} · ${basis === "today" ? "today’s dollars" : "future dollars"} · property values are equity`,
          ),
        );
        const head = make("thead"),
          hr = make("tr");
        for (const label of ["Measure", ...names]) {
          const th = make("th", "", label);
          th.scope = "col";
          hr.append(th);
        }
        head.append(hr);
        table.append(head);
        const body = make("tbody");
        for (const [key, label] of metrics) {
          const tr = make("tr"),
            th = make("th", "", label);
          th.scope = "row";
          tr.append(th);
          for (const name of names)
            tr.append(
              make(
                "td",
                "",
                displayed[name] ? money(displayed[name][key]) : "Unavailable",
              ),
            );
          body.append(tr);
        }
        table.append(body);
        scroll.append(table);
        output.append(scroll);
        const mobileResults = make("section", "growth-result-cards");
        mobileResults.setAttribute("aria-label", `Year ${year} scenario comparison`);
        mobileResults.append(make("p", "growth-results-basis", `Year ${year} · ${basis === "today" ? "today’s dollars" : "future dollars"} · property values are equity`));
        for (const name of names) {
          const card = make("article", `growth-result-card growth-result-${name.toLowerCase()}`);
          card.dataset.growthMobileScenario = name;
          card.append(make("h3", "", name));
          const values = make("dl");
          for (const [key, label] of metrics) {
            const row = make("div"); row.dataset.growthMobileMetric = key;
            row.append(make("dt", "", label), make("dd", "", displayed[name] ? money(displayed[name][key]) : "Unavailable"));
            values.append(row);
          }
          card.append(values); mobileResults.append(card);
        }
        output.append(mobileResults);

      }
      draw();
      panel.append(
        make(
          "p",
          "field-help",
          "Saved retirement snapshots keep their own rates and are not rerun here. Exhaustion and unfunded spending are different outcomes. Comparison results are not added to plan PDFs.",
        ),
      );
      panel.append(button("Open Retirement Planning", onRetirement));
    }
    trigger.addEventListener("click", () => {
      opened = !opened;
      panel.hidden = !opened;
      trigger.setAttribute("aria-expanded", String(opened));
      if (opened) {
        sync();
        if (!results) compute();
        render();
        panel.querySelector("h2").focus();
      }
    });
    function sync() {
      if (
        signature !== JSON.stringify(getPlan()) ||
        identity !== getIdentity()
      ) {
        reset();
        if (opened) {
          compute();
          render();
        }
      } else if (opened && (!results || basis !== getBasis())) {
        if (!results) compute();
        render();
      }
    }
    reset();
    return { sync };
  }
  root.FFSGrowthScenariosView = Object.freeze({ mount });
})(globalThis);
