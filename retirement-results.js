(function (global) {
  "use strict";

  // Presentation only: consume the existing view model and dollar converter.
  const ages = row => (row?.ages || row?.people || []).map(person => `${person.name || person.id}: age ${person.age}`).join(" · ");
  function presentation(view, inputs, basis) {
    const rows = view.annualRows || [], end = rows.at(-1);
    const shortfall = view.longevity?.firstUnfundedSpending;
    const shortfallRow = rows.find(row => row.calendarYear === shortfall?.calendarYear);
    const rate = global.FFSDollarBasis.inflationPercent(inputs);
    const value = (amount, row) => amount == null ? null : global.FFSDollarBasis.displayedValue(amount,
      row?.yearIndex ?? global.FFSDollarBasis.calendarHorizon(row?.calendarYear, inputs, rows), rate, basis);
    return {
      basisLabel: basis === "today" ? "Showing today's dollars" : "Showing future dollars",
      shortfall: Boolean(shortfall?.calendarYear),
      headline: shortfall?.calendarYear
        ? `Your retirement plan has a projected spending shortfall from ${shortfall.calendarYear}.`
        : `Your planned lifestyle is projected to be funded through the end of your forecast in ${end?.calendarYear}.`,
      fundedUntil: shortfall?.calendarYear ? `Before ${shortfall.calendarYear}` : String(end?.calendarYear ?? "Not available"),
      fundedNote: shortfallRow ? `First shortfall: ${ages(shortfallRow)}. See the annual forecast for that year's funding gap.` : `${ages(end)}. Forecast end, not a guarantee beyond this date.`,
      remaining: value(end?.household?.closingAccessibleInvestmentBalance, end),
      superRemaining: value(end?.household?.totalSuperBalance, end),
      allSuperAccessible: Boolean(end?.people?.length) && end.people.every(person => person.age >= person.superAccessAge),
      endNote: `At forecast end (${end?.calendarYear}). Non-super balance; property excluded.`,
      shortfallAmount: global.FFSDollarBasis.annualSum(rows, row => row.household?.unmetSpending || 0, inputs, basis),
      points: rows.map(row => ({ year: row.calendarYear, ages: ages(row), value: value(row.household?.closingAccessibleInvestmentBalance, row) })),
      pensionIncluded: rows.some(row => Number(row.household?.estimatedAgePension) > 0),
      pensionEstimated: rows.some(row => row.household?.agePension),
      pensionUnsupported: rows.some(row => row.household?.agePension?.unsupported),
      hasEmploymentIncome: rows.some(row => row.people?.some(person => Number(person.grossEmploymentIncome) > 0)),
    };
  }

  function redesign(html, context) {
    const { view, inputs, basis, money, state, outcome, debtFree } = context;
    const template = document.createElement("template");
    template.innerHTML = html;
    const root = template.content.querySelector("[data-semi-results-dashboard]");
    if (!root || !view?.isAvailable) return html;
    const data = presentation(view, inputs, basis);
    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    };
    const amount = value => value == null ? "Not available" : money(value);
    const section = (id, title, intro) => {
      const node = make("section", "rr-section"); node.id = id;
      node.append(make("h3", "", title));
      if (intro) node.append(make("p", "rr-intro", intro));
      return node;
    };
    const card = (label, value, note, key) => {
      const node = make("article", "rr-card"); node.dataset.rrMetric = key;
      node.append(make("span", "", label), make("strong", "", value), make("small", "", note));
      return node;
    };
    const panel = (key, title, description, nodes, critical = false) => {
      const node = make("details", "rr-panel");
      node.dataset.semiDetailState = `rr-${key}`;
      node.open = critical || Boolean(state[`rr-${key}`]);
      const summary = make("summary");
      const text = make("span"); text.append(make("strong", "", title));
      if (description) text.append(make("small", "", description));
      summary.append(text);
      const body = make("div", "rr-panel-body"); body.append(...nodes.filter(Boolean));
      node.append(summary, body); return node;
    };
    const findSection = title => [...root.querySelectorAll(":scope > section")].find(node => node.querySelector("h4")?.textContent === title);
    const originalChildren = [...root.children];
    const header = root.querySelector(":scope > .card-subheading");
    const snapshot = root.querySelector(".semi-retirement-snapshot");
    const timeline = root.querySelector(".semi-retirement-timeline");
    const timelineSection = timeline?.closest("section");
    const longevity = findSection("Funding Outlook");
    const funding = findSection("Transition / Semi-Retirement Funding");
    const retained = root.querySelector(".retained-assets");
    const property = root.querySelector(".semi-retirement-debt-property");
    const adjustments = root.querySelector("[data-semi-adjustments]");
    const comparison = root.querySelector("[data-semi-comparison]");
    const annual = root.querySelector(".semi-retirement-annual-projection");
    const assumptions = [...root.children].find(node => node.tagName === "DETAILS" && node.querySelector("summary strong")?.textContent === "Assumptions");
    const passive = [...root.children].find(node => node.tagName === "DETAILS" && node.querySelector("summary strong")?.textContent === "Income & tax");
    const pension = findSection("Estimated Age Pension");
    const pensionComparison = pension?.previousElementSibling?.textContent.includes("without. First unfunded year") ? pension.previousElementSibling : null;
    const disclosure = root.querySelector(".semi-retirement-disclosure");
    const notes = root.querySelector(".semi-retirement-notes");
    const consumed = new Set([header, snapshot, timelineSection, longevity, funding, retained, property, adjustments, comparison, annual, assumptions, passive, pension, pensionComparison, disclosure, notes]);
    root.replaceChildren(); root.classList.add("retirement-redesign");

    const outlook = section("retirement-outlook", "Your Retirement Outlook");
    outlook.classList.add(data.shortfall ? "rr-warning" : "rr-success");
    outlook.setAttribute("tabindex", "-1");
    const toolbar = make("div", "rr-toolbar");
    toolbar.append(make("span", "rr-basis", data.basisLabel));
    const save = header?.querySelector("[data-save-stage-g-scenario]"); if (save) toolbar.append(save);
    outlook.prepend(toolbar);
    outlook.append(make("p", "rr-headline", data.headline));
    const grid = make("div", "rr-summary-grid");
    const selectedTiming = snapshot?.querySelector(".semi-retirement-snapshot-grid .semi-retirement-metric-card strong")?.textContent || "Not available";
    const reachedRetirement = Boolean(view.keyResults?.accessibleWhenBothFullyRetired?.row);
    const timing = reachedRetirement ? selectedTiming : "Beyond forecast";
    grid.append(card("Fully Retired At", timing, reachedRetirement ? "Selected retirement ages; income stops as modelled." : `Selected: ${selectedTiming}. Full household retirement is not reached within this forecast.`, "retired"),
      card("Lifestyle Funded Until", data.fundedUntil, data.fundedNote, "funded"),
      card("Retirement Investments Remaining", amount(data.remaining), data.endNote, "remaining"),
      card("Retirement Spending Shortfall", data.shortfall ? amount(data.shortfallAmount) : "None projected",
        data.shortfall ? (basis === "today" ? "Sum of each year's discounted unfunded spending." : "Total unfunded spending across the forecast.") : "No unfunded spending within this forecast.", "shortfall"));
    const superNote = make("small", "rr-super-balance", `Super: ${amount(data.superRemaining)}. ${data.allSuperAccessible ? "At assumed access age." : "May include super below access age."}`);
    grid.querySelector('[data-rr-metric="remaining"]').append(superNote);
    outlook.append(grid, make("p", "rr-disclaimer", "These are estimates based on your assumptions, not guaranteed financial outcomes."));
    const edit = snapshot?.querySelector("[data-semi-action='edit-inputs']"); if (edit) outlook.append(edit);
    root.append(outlook);

    const journey = section("retirement-journey", "Your Retirement Journey", "Key dates from your scenario. Each person's ages and super access assumptions are shown separately.");
    const events = [];
    for (const group of timeline?.children || []) {
      for (const event of group.querySelectorAll(":scope > ul > li")) {
        const item = make("li", group.className);
        const description = make("div");
        description.append(...[...event.childNodes].map(node => node.cloneNode(true)));
        item.append(group.firstElementChild.cloneNode(true), description);
        const title = item.querySelector(".semi-retirement-timeline-title");
        if (title) title.textContent = title.textContent.replace(/^Modelled: /, "");
        events.push(item);
      }
    }
    const list = make("ol", "rr-journey"); list.append(...events.slice(0, 6)); journey.append(list);
    if (events.length > 6) {
      const all = make("ol", "rr-journey"); all.append(...events.slice(6));
      journey.append(panel("milestones", "View All Milestones", `${events.length - 6} more events in chronological order`, [all]));
    }
    if (!events.length) journey.append(make("p", "", "No milestones were reached within this forecast."));
    root.append(journey);

    if (adjustments) {
      adjustments.id = "retirement-adjustments"; adjustments.classList.add("rr-section");
      adjustments.querySelector("h4").textContent = "What if you changed your retirement plan?";
      adjustments.querySelector(".card-subheading p").textContent = "Explore how different spending choices could affect your retirement.";
      const indicator = make("p", "rr-basis", `${data.basisLabel}. Spending inputs stay in today's dollars.`);
      adjustments.querySelector(".card-subheading").after(indicator);
      const impact = adjustments.querySelector("[data-semi-adjustment-impact]");
      const endAssets = [...impact.querySelectorAll(":scope > div")].find(node => node.querySelector("span")?.textContent === "Assets at projection end");
      if (endAssets && context.adjustment?.impact) {
        const end = view.annualRows.at(-1);
        const convert = value => global.FFSDollarBasis.displayedValue(value, end.yearIndex ?? global.FFSDollarBasis.calendarHorizon(end.calendarYear, inputs), global.FFSDollarBasis.inflationPercent(inputs), basis);
        endAssets.querySelector("strong").textContent = amount(convert(context.adjustment.impact.projectionEndAssets));
        const delta = endAssets.querySelector(".semi-retirement-impact-delta");
        const difference = context.adjustment.comparison?.endAssetsDelta;
        if (delta && difference != null) delta.textContent = `${difference < 0 ? "-" : "+"}${amount(Math.abs(convert(difference)))}`;
      }
      // Preserve the original comparison deltas and pending/error live region in detail.
      const status = impact.querySelector("[data-semi-adjustment-status]");
      const oldImpact = panel("adjustment-detail", "View adjustment comparison", "Change from the original scenario", [...impact.children].filter(node => node !== status));
      impact.replaceChildren(make("strong", "", data.shortfall ? "Projected shortfall" : "Funded through forecast end"),
        card("Lifestyle funded until", data.fundedUntil, data.fundedNote, "adjusted-funded"),
        card("Retirement investments remaining", amount(data.remaining), "Non-super investments at forecast end.", "adjusted-remaining"),
        card("Retirement spending shortfall", data.shortfall ? amount(data.shortfallAmount) : "None projected", "Across the forecast.", "adjusted-shortfall"), status, oldImpact);
      const compareLink = make("button", "btn", "Compare retirement options");
      compareLink.type = "button"; compareLink.dataset.rrOpen = "rr-comparison";
      adjustments.append(compareLink); root.append(adjustments);
    }

    const fundingSection = section("retirement-funding", "How Your Retirement Is Funded",
      "Income received and withdrawals from savings are different. The forecast uses the existing funding order and each person's super access assumptions.");
    const sourceList = make("ul", "rr-sources");
    const has = field => view.annualRows.some(row => Number(row.household?.[field]) > 0);
    if (data.hasEmploymentIncome) sourceList.append(make("li", "", "Employment income supports spending while a household member is still working."));
    if (has("totalAccessibleWithdrawal")) sourceList.append(make("li", "", "Non-super investment withdrawals cover spending not met by income."));
    if (has("totalSuperWithdrawal")) sourceList.append(make("li", "", "Super withdrawals contribute when the model's access conditions are met."));
    if (has("totalPassiveCashIncome") || has("netRentalCashflow")) sourceList.append(make("li", "", "Rental and other passive cash income are included in the existing cashflow calculation; they are not additional investment withdrawals."));
    if (has("otherIncome")) sourceList.append(make("li", "", "Other household income entered in your scenario contributes to cash available for spending."));
    sourceList.append(make("li", "", data.pensionIncluded ? "Estimated Age Pension payments are included in the annual funding model, with tax assessed by the existing model." : "No Age Pension payments are included in this forecast."));
    fundingSection.append(sourceList);
    for (const [key, label] of [["accessibleExhaustion", "Non-super investments"], ["superExhaustion", "Superannuation"]]) {
      const event = outcome?.[key];
      if (event) fundingSection.append(make("p", "rr-exhaustion", `${label}: ${event.alreadyZero ? "none available at" : "projected to be exhausted in"} ${event.calendarYear} (${ages(event)}). This is separate from a spending shortfall; see the annual funding details.`));
    }
    const totalExhausted = view.longevity?.allRetirementFundsExhausted;
    if (totalExhausted?.calendarYear) fundingSection.append(make("p", "rr-exhaustion", `Total eligible retirement funds are projected to be exhausted in ${totalExhausted.calendarYear}. Retained property and super below access age are not available retirement cash.`));
    if (inputs.scenario?.surplusDestination === "accessible-investments") fundingSection.append(make("p", "", "Surplus income is assumed to be reinvested."));
    if (longevity) longevity.querySelector("h4").textContent = "Investment availability and spending gaps";
    if (funding) {
      funding.querySelector("h4").textContent = "Funding during the transition to retirement";
      funding.querySelectorAll(".semi-retirement-metric-card > span").forEach(label => {
        if (label.textContent === "Amount needed from investments") label.textContent = "Investment Withdrawals Required";
        if (label.textContent === "Money left over") {
          label.textContent = "Surplus income assumption";
          const value = label.nextElementSibling;
          if (value?.textContent === "Add to investments") value.textContent = "Surplus income is assumed to be reinvested.";
        }
      });
    }
    if (snapshot) {
      snapshot.querySelector(".semi-retirement-outlook-header").remove();
      snapshot.classList.remove("semi-retirement-outlook", "is-positive", "is-warning");
    }
    fundingSection.append(panel("funding", "View Detailed Funding Breakdown", "Retirement balances, withdrawals, extra spending, income and tax", [snapshot, longevity, funding, passive]));
    fundingSection.append(chart(data, make, amount)); root.append(fundingSection);

    const explore = section("retirement-details", "Explore Your Detailed Results", "Open only what you need. Your full forecast and assumptions remain available.");
    explore.classList.add("rr-explore");
    const equity = retained?.querySelectorAll(".semi-retirement-results-grid > article strong")?.[2]?.textContent;
    const propertyNote = make("p", "rr-property-note", "Property equity is not automatically available to fund retirement spending unless a sale or equity-release event is included in your plan.");
    explore.append(panel("property", "Your Home, Properties & Debts", `Debt-free: ${debtFree.value}. ${debtFree.note || ""}.${equity ? ` Retained asset equity: ${equity} in ${view.retainedAssets.calendarYear} (${view.retainedAssets.reference === "exhaustion" ? "funding exhaustion" : "forecast end"}).` : ""}`, [propertyNote, property, retained], Boolean(property?.querySelector('[role="alert"], .semi-retirement-debt-warning-list'))));
    const pensionNote = make("p", "", "Eligibility is assumed where supported, not confirmed. The annual amounts below are before-tax estimates; only modelled payments are included in funding. Review the Age Pension inputs for residency, eligibility, SAPTO and other assumptions.");
    explore.append(panel("pension", "Age Pension Estimate", data.pensionIncluded ? "Payments are projected and included in funding." : data.pensionUnsupported ? "Unsupported circumstances: no pension included." : data.pensionEstimated ? "Estimated payments are zero; none included in funding." : "Not enabled; no pension included in funding.", [pensionNote, pensionComparison, pension]));
    if (comparison) comparison.querySelector("h4").textContent = "Compare Retirement Options";
    explore.append(panel("comparison", "Compare Retirement Options", "Temporary comparisons, saved scenarios and PDF exports", [comparison], Boolean(comparison?.querySelector('[role="alert"]'))));
    if (annual) {
      annual.querySelector("summary strong").textContent = "Detailed Annual Forecast";
      annual.dataset.semiDetailState = "rr-annual"; annual.open = Boolean(state["rr-annual"]);
      annual.classList.add("rr-panel"); explore.append(annual);
    }
    if (assumptions) {
      assumptions.querySelector("summary strong").textContent = "Assumptions Used";
      assumptions.dataset.semiDetailState = "rr-assumptions"; assumptions.open = Boolean(state["rr-assumptions"]);
      assumptions.classList.add("rr-panel"); explore.append(assumptions);
    }
    const remaining = originalChildren.filter(node => !consumed.has(node));
    // Correct the old blanket exclusion only in this retirement result. Main-plan
    // reports have separate pension semantics and are not touched.
    if (data.pensionIncluded) remaining.forEach(node => {
      if (node.textContent.includes("Age Pension not included.")) node.textContent = "Estimated Age Pension payments are included in this retirement scenario. See Age Pension Estimate for assumptions and annual amounts.";
    });
    const critical = (view.warnings || []).some(text => /invalid|unsupported|could not|cannot|failed/i.test(text));
    explore.append(panel("information", "Important Information", `${view.warnings?.length || 0} projection notes · disclosures and limitations`, [...remaining, notes, disclosure], critical));
    if (critical) outlook.append(make("p", "rr-critical", "Some assumptions or funding conditions need attention. Important Information is expanded below."));
    root.append(explore);
    // Stable keys preserve independent expansion across scenario recalculation.
    root.querySelectorAll("details").forEach((details, index) => {
      if (!details.dataset.semiDetailState) {
        const key = `rr-nested-${details.closest('[data-semi-detail-state]')?.dataset.semiDetailState || "detail"}-${index}`;
        details.dataset.semiDetailState = key; details.open = Boolean(state[key]);
      }
    });
    return template.innerHTML;
  }

  function chart(data, make, money) {
    const figure = make("figure", "rr-chart");
    figure.append(make("h4", "", "Your Retirement Investments Over Time"),
      make("p", "", "Non-super investment closing balances, matching the annual forecast. Super, retained property equity and unallocated cash are not added to this line. Any reserved balance remains subject to your withdrawal assumptions."));
    const points = data.points.filter(point => Number.isFinite(point.value));
    if (!points.length) { figure.append(make("p", "", "No annual investment balances are available.")); return figure; }
    const max = Math.max(1, ...points.map(p => p.value)), start = points[0].year, end = points.at(-1).year;
    const x = year => 92 + (year - start) / Math.max(1, end - start) * 570;
    const y = value => 206 - value / max * 160;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 700 250"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Non-super investment closing balances from ${start} to ${end}. ${data.basisLabel}. Exact values are in Detailed Annual Forecast.`);
    const draw = (tag, attrs, text) => { const node = document.createElementNS(svg.namespaceURI, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); if (text != null) node.textContent = text; svg.append(node); return node; };
    for (const fraction of [0, 0.5, 1]) {
      draw("line", { x1: 92, x2: 662, y1: y(max * fraction), y2: y(max * fraction), class: "rr-chart-grid" });
      const axisAmount = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", notation: "compact", maximumFractionDigits: 1 }).format(max * fraction);
      draw("text", { x: 84, y: y(max * fraction) + 4, "text-anchor": "end" }, axisAmount);
    }
    draw("polyline", { points: points.map(p => `${x(p.year)},${y(p.value)}`).join(" "), class: "rr-chart-line" });
    for (const p of points) { const dot = draw("circle", { cx: x(p.year), cy: y(p.value), r: 2.5, class: "rr-chart-point", "data-year": p.year, "data-value": p.value }); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${p.year} · ${p.ages}: ${money(p.value)}`; dot.append(title); }
    for (const year of [...new Set([start, points[Math.floor(points.length / 2)].year, end])]) draw("text", { x: x(year), y: 232, "text-anchor": "middle" }, year);
    figure.append(svg, make("figcaption", "rr-basis", `${data.basisLabel} · Calendar year`)); return figure;
  }

  function installInteractions() {
    document.addEventListener("click", event => {
      const action = event.target.closest("[data-semi-action]")?.dataset.semiAction;
      if (["compare", "demo-comparisons", "export-comparison-pdf"].includes(action) || event.target.closest("[data-semi-comparison]")) {
        const comparison = document.querySelector('[data-semi-detail-state="rr-comparison"]');
        if (comparison) comparison.open = true;
      }
      if (event.target.closest('[data-semi-action="calculate"]')) global.requestAnimationFrame(() => {
        const outlook = document.getElementById("retirement-outlook");
        if (outlook) { outlook.focus({ preventScroll: true }); outlook.scrollIntoView({ block: "start", behavior: "smooth" }); }
      });
      const button = event.target.closest("[data-rr-open]");
      if (button) {
        const details = document.querySelector(`[data-semi-detail-state="${button.dataset.rrOpen}"]`);
        if (details) { details.open = true; details.querySelector("summary").focus(); details.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }
    });
    let printState = [];
    global.addEventListener("beforeprint", () => {
      printState = [...document.querySelectorAll(".retirement-redesign details")].map(node => [node, node.open]);
      printState.forEach(([node]) => { node.open = true; });
    });
    global.addEventListener("afterprint", () => { printState.forEach(([node, open]) => { node.open = open; }); printState = []; });
  }
  global.FFSRetirementResults = { presentation, redesign, installInteractions };
})(typeof window === "undefined" ? globalThis : window);
