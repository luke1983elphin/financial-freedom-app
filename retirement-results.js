(function (global) {
  "use strict";

  // Presentation only: consume the existing view model and dollar converter.
  const ages = row => (row?.ages || row?.people || []).map(person => `${person.name || person.id}: Age ${person.age}`).join(" · ");
  const ageValue = row => {
    const people = row?.ages || row?.people || [];
    return people.length === 1 ? `Age ${people[0].age}` : ages(row) || "Not available";
  };
  function presentation(view, inputs, basis) {
    const rows = view.annualRows || [], end = rows.at(-1);
    const shortfall = view.longevity?.firstUnfundedSpending;
    const shortfallRow = rows.find(row => row.calendarYear === shortfall?.calendarYear);
    const rate = global.FFSDollarBasis.inflationPercent(inputs);
    const full = view.keyResults?.accessibleWhenBothFullyRetired?.row;
    const value = (amount, row) => amount == null ? null : global.FFSDollarBasis.displayedValue(amount,
      row?.yearIndex ?? global.FFSDollarBasis.calendarHorizon(row?.calendarYear, inputs, rows), rate, basis);
    return {
      basisLabel: basis === "today" ? "Showing today's dollars" : "Showing future dollars",
      shortfall: Boolean(shortfall?.calendarYear),
      headline: shortfall?.calendarYear
        ? `Your retirement plan has a projected spending shortfall from ${shortfall.calendarYear}.`
        : `Your planned lifestyle is projected to be funded through the end of your forecast in ${end?.calendarYear}.`,
      retirementValue: full ? (view.people?.length === 1 ? ageValue(full) : String(full.calendarYear)) : "Beyond forecast",
      retirementNote: full ? (view.people?.length === 1 ? `Full retirement in ${full.calendarYear}.` : ages(full)) : "Full household retirement is not reached within this forecast.",
      fundedUntil: shortfallRow ? `First shortfall: ${ageValue(shortfallRow)}` : ageValue(end),
      fundedNote: shortfallRow ? `First unfunded year: ${shortfallRow.calendarYear}. See the annual forecast for the spending gap.` : `Forecast ends in ${end?.calendarYear}. Funding beyond this date is not projected.`,
      remaining: value(end?.household?.closingAccessibleInvestmentBalance, end),
      superRemaining: value(end?.household?.totalSuperBalance, end),
      allSuperAccessible: Boolean(end?.people?.length) && end.people.every(person => person.age >= person.superAccessAge),
      endNote: `At forecast end (${end?.calendarYear}). Non-super balance; property excluded.`,
      shortfallAmount: global.FFSDollarBasis.annualSum(rows, row => row.household?.unmetSpending || 0, inputs, basis),
      points: rows.map(row => ({ year: row.calendarYear, ages: ages(row), value: value(row.household?.closingAccessibleInvestmentBalance, row) })),
      exhaustionYear: view.longevity?.accessibleFundsExhausted?.calendarYear ?? null,
      pensionIncluded: rows.some(row => Number(row.household?.estimatedAgePension) > 0),
      pensionEstimated: rows.some(row => row.household?.agePension),
      pensionUnsupported: rows.some(row => row.household?.agePension?.unsupported),
      hasEmploymentIncome: rows.some(row => row.people?.some(person => Number(person.grossEmploymentIncome) > 0)),
    };
  }

  function tagFragment(html, key) {
    const template = document.createElement("template"); template.innerHTML = html;
    for (const node of template.content.children) {
      if (node.dataset.rrSource) continue;
      node.dataset.rrSource = key === "annual"
        ? (node.matches("details") ? "annual" : node.matches("section") ? "pension" : "pension-comparison") : key;
    }
    return template.innerHTML;
  }

  function adjustmentPresentation(adjustment, baseline, inputs, basis) {
    if (adjustment?.isUsingLastValidResult) return { kind: "invalid" };
    const comparison = adjustment?.comparison, impact = adjustment?.impact;
    if (!comparison || !baseline || !impact) return { kind: "unavailable" };
    const changed = Object.values(comparison.valueDeltas || {}).some(value => Number(value) !== 0)
      || (comparison.endAssetsDelta != null && comparison.endAssetsDelta !== 0)
      || comparison.baselineFirstShortfallYear !== comparison.adjustedFirstShortfallYear;
    const comparable = baseline.projectionEndYear === impact.projectionEndYear;
    const convert = value => value == null ? null : global.FFSDollarBasis.displayedValue(value,
      global.FFSDollarBasis.calendarHorizon(impact.projectionEndYear, inputs), global.FFSDollarBasis.inflationPercent(inputs), basis);
    return { kind: changed ? "changed" : "unchanged", funded: !impact.firstShortfallYear,
      endDelta: comparable ? convert(comparison.endAssetsDelta) : null,
      originalEnd: comparable ? convert(baseline.projectionEndAssets) : null,
      adjustedEnd: comparable ? convert(impact.projectionEndAssets) : null,
      originalShortfall: baseline.firstShortfallYear ? `${ageValue({ ages: baseline.firstShortfallAges })} (${baseline.firstShortfallYear})` : "None projected",
      adjustedShortfall: impact.firstShortfallYear ? `${ageValue({ ages: impact.firstShortfallAges })} (${impact.firstShortfallYear})` : "None projected",
      shortfallYearDelta: comparison.firstShortfallYearDelta,
    };
  }

  function redesign(html, context) {
    try { return redesignResults(html, context); }
    catch {
      return '<p class="rr-critical" role="status">The simplified layout is unavailable. Your complete original results remain below.</p>' + html;
    }
  }

  function redesignResults(html, context) {
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
    const source = key => root.querySelector(`[data-rr-source="${key}"]`);
    const originalChildren = [...root.children];
    const header = root.querySelector(":scope > .card-subheading");
    const snapshot = source("snapshot");
    const timelineSection = source("timeline");
    const timeline = timelineSection?.querySelector(".semi-retirement-timeline");
    const longevity = source("longevity");
    const funding = source("funding");
    const retained = source("retained");
    const property = root.querySelector(".semi-retirement-debt-property");
    const adjustments = root.querySelector("[data-semi-adjustments]");
    const comparison = root.querySelector("[data-semi-comparison]");
    const annual = source("annual");
    const assumptions = source("assumptions");
    const passive = source("passive");
    const pension = source("pension");
    const pensionComparison = source("pension-comparison");
    const disclosure = root.querySelector(".semi-retirement-disclosure");
    const notes = root.querySelector(".semi-retirement-notes");
    if (![snapshot, timelineSection, longevity, funding, annual, assumptions, disclosure].every(Boolean)
      || ((view.timeline || []).length && !timeline)) {
      root.prepend(make("p", "rr-critical", "The simplified layout is unavailable. Your complete original results remain below."));
      return template.innerHTML;
    }
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
    const endDate = view.annualRows.at(-1)?.calendarYear;
    grid.append(card("Fully Retired", data.retirementValue, data.retirementNote, "retired"),
      card("Lifestyle Funded Through", data.fundedUntil, data.fundedNote, "funded"),
      card("Non-Super Investments Remaining", amount(data.remaining), `Forecast end: ${endDate}. ${data.basisLabel}. Property excluded; any withdrawal reserve still applies.`, "remaining"),
      card("Superannuation Remaining", amount(data.superRemaining), `Forecast end: ${endDate}. ${data.basisLabel}. ${data.allSuperAccessible ? "At modelled access ages; actual release rules still apply." : "Includes super that may be below access age; not all is withdrawable."}`, "super"));
    const shortfallStatus = make("div", `rr-shortfall-status ${data.shortfall ? "is-warning" : "is-funded"}`);
    shortfallStatus.dataset.rrMetric = "shortfall";
    shortfallStatus.append(make("strong", "", data.shortfall ? `Projected retirement spending shortfall: ${amount(data.shortfallAmount)}.` : "No retirement spending shortfall projected."));
    if (data.shortfall) shortfallStatus.append(make("small", "", basis === "today" ? "Sum of each year's discounted unfunded spending." : "Total unfunded spending across the forecast."));
    outlook.append(grid, shortfallStatus, make("p", "rr-disclaimer", "These are estimates based on your assumptions, not guaranteed financial outcomes."));
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
      const oldImpact = panel("adjustment-detail", "View Adjustment Comparison", "Original scenario compared with the last valid adjusted scenario", [...impact.children].filter(node => node !== status));
      const change = adjustmentPresentation(context.adjustment, context.baseline, inputs, basis);
      impact.dataset.rrImpactState = change.kind;
      impact.replaceChildren(make("h4", "", "Impact of Your Changes"));
      if (change.kind === "unchanged") impact.append(make("p", "", "No changes made yet. Adjust your retirement spending or planned expenses to explore different outcomes."));
      else if (change.kind === "invalid") impact.append(make("p", "rr-critical", "The adjustment needs review. The last valid results remain visible; no new comparison is shown."));
      else if (change.kind === "unavailable") impact.append(make("p", "", "An original scenario comparison is not available. Calculate a valid scenario before exploring adjustment differences."));
      else {
        impact.classList.toggle("rr-impact-warning", !change.funded);
        impact.append(make("p", "rr-impact-status", change.funded ? "Your adjusted plan remains funded through the forecast end." : "Your adjusted plan has a projected spending shortfall."));
        const delta = change.endDelta == null ? "Not comparable" : `${change.endDelta > 0 ? "+" : change.endDelta < 0 ? "−" : ""}${amount(Math.abs(change.endDelta))}`;
        impact.append(card("Change in final investments + super", delta,
          change.endDelta == null ? "Matching original and adjusted forecast-end amounts are not available." : `Original: ${amount(change.originalEnd)}. Adjusted: ${amount(change.adjustedEnd)}. Includes total super, which may not all be accessible. ${data.basisLabel}.`, "change-assets"));
        impact.append(card("Spending shortfall timing", `Adjusted: ${change.adjustedShortfall}`, `Original: ${change.originalShortfall}.`, "change-shortfall"));
        if (change.shortfallYearDelta != null) impact.append(make("p", "", change.shortfallYearDelta === 0 ? "The first shortfall year is unchanged." : `The first shortfall is ${Math.abs(change.shortfallYearDelta)} year(s) ${change.shortfallYearDelta > 0 ? "later" : "earlier"}.`));
        impact.append(make("small", "", "A change in total shortfall dollars is not supplied by the existing comparison. The current shortfall total is shown in Your Retirement Outlook."));
      }
      if (status) impact.append(status);
      impact.append(oldImpact);
      const compareLink = make("button", "btn", "Compare retirement options");
      compareLink.type = "button"; compareLink.dataset.rrOpen = "rr-comparison";
      adjustments.append(compareLink); root.append(adjustments);
    }

    const fundingSection = section("retirement-funding", "How Your Retirement Is Funded");
    const sourceList = make("ul", "rr-sources");
    const has = field => view.annualRows.some(row => Number(row.household?.[field]) > 0);
    if (data.hasEmploymentIncome) sourceList.append(make("li", "", "Employment income supports spending while a household member is still working."));
    if (has("totalAccessibleWithdrawal")) sourceList.append(make("li", "", "Non-super investment withdrawals cover spending not met by income."));
    if (has("totalSuperWithdrawal")) sourceList.append(make("li", "", "Super withdrawals contribute when the model's access conditions are met."));
    if (has("totalPassiveCashIncome") || has("netRentalCashflow")) sourceList.append(make("li", "", "Rental and other passive cash income are included in the existing cashflow calculation; they are not additional investment withdrawals."));
    if (has("otherIncome")) sourceList.append(make("li", "", "Other household income entered in your scenario contributes to cash available for spending."));
    sourceList.append(make("li", "", data.pensionIncluded ? "Estimated Age Pension payments are included in the annual funding model, with tax assessed by the existing model." : "No Age Pension payments are included in this forecast."));
    const sources = [];
    if (data.hasEmploymentIncome) sources.push("employment income");
    if (has("totalAccessibleWithdrawal")) sources.push("non-super investment savings");
    if (has("totalSuperWithdrawal")) sources.push("superannuation");
    if (has("netRentalCashflow")) sources.push("rental income");
    if (has("totalPassiveCashIncome")) sources.push("other passive income");
    if (has("otherIncome")) sources.push("other household income");
    if (data.pensionIncluded) sources.push("estimated Age Pension payments");
    fundingSection.append(make("p", "rr-funding-summary", sources.length
      ? `Your spending is supported by ${new Intl.ListFormat("en-AU", { style: "long", type: "conjunction" }).format(sources)}, depending on your retirement stage.`
      : "No income or investment withdrawals are shown as funding spending in this forecast. Review the spending outcome and annual details."));
    for (const [key, label] of [["accessibleExhaustion", "Non-super investments"], ["superExhaustion", "Superannuation"]]) {
      const event = outcome?.[key];
      if (event) {
        const shortfallYear = view.longevity?.firstUnfundedSpending?.calendarYear;
        const otherFunding = view.annualRows.some(row => row.calendarYear >= event.calendarYear
          && Number(row.household?.totalProjectedLifestyleSpending) > 0
          && (Number(row.household?.netHouseholdCashIncome) > 0
            || Number(row.household?.[key === "accessibleExhaustion" ? "totalSuperWithdrawal" : "totalAccessibleWithdrawal"]) > 0));
        const explanation = shortfallYear
          ? `The first spending shortfall is projected in ${shortfallYear}${shortfallYear < event.calendarYear ? ", before this exhaustion milestone" : shortfallYear === event.calendarYear ? ", the same year" : ", after this exhaustion milestone"}.`
          : otherFunding ? "Other available retirement funds or income continue supporting your lifestyle through the forecast end; no spending shortfall is projected."
            : "No spending shortfall is projected through the forecast end.";
        fundingSection.append(make("p", `rr-exhaustion${shortfallYear ? " is-warning" : " is-information"}`,
          `${label === "Non-super investments" ? "Your non-super investments" : "Your superannuation"} ${event.alreadyZero ? "have no balance in" : "are projected to be used by"} ${event.calendarYear} (${ageValue(event)}). ${explanation}`));
      }
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
    fundingSection.append(panel("funding", "View Detailed Funding Breakdown", "Retirement balances, withdrawals, extra spending, income and tax", [sourceList, snapshot, longevity, funding, passive]));
    fundingSection.append(chart(data, make, amount, state)); root.append(fundingSection);

    const explore = section("retirement-details", "Explore Your Detailed Results", "Open only what you need. Your full forecast and assumptions remain available.");
    explore.classList.add("rr-explore");
    const equity = retained?.querySelectorAll(".semi-retirement-results-grid > article strong")?.[2]?.textContent;
    const propertyNote = make("p", "rr-property-note", "Property equity is not automatically available to fund retirement spending unless a sale or equity-release event is included in your plan.");
    const netWorthNote = make("p", "rr-net-worth-note", "Projected net worth includes modelled non-super assets, total super and other retained assets, less debts. Retained property equity is the property value less its linked loans; it is not additional cash to add to net worth. Non-super investments and super are shown separately because access rules differ.");
    if (view.debtProperty?.propertyCards?.some(item => item.netPropertyCashflow < 0)) property?.append(make("p", "rr-rental-note", "Positive rent can still result in negative property cashflow when loan repayments and property costs exceed cash received. The figures above retain the model's existing treatment of those costs."));
    explore.append(panel("property", "Your Home, Properties & Debts", `Debt-free: ${debtFree.value}. ${debtFree.note || ""}.${equity ? ` Retained asset equity: ${equity} in ${view.retainedAssets.calendarYear} (${view.retainedAssets.reference === "exhaustion" ? "funding exhaustion" : "forecast end"}).` : ""}`, [propertyNote, netWorthNote, property, retained], Boolean(property?.querySelector('[role="alert"], .semi-retirement-debt-warning-list'))));
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

  function chart(data, make, money, state) {
    const figure = make("figure", "rr-chart");
    figure.append(make("h4", "", "Your Non-Super Investments Over Time"),
      make("p", "", "Annual closing balances from the Detailed Annual Forecast. Super, property equity and unallocated cash are excluded; any withdrawal reserve still applies."));
    const points = data.points.filter(point => Number.isFinite(point.value));
    if (!points.length) { figure.append(make("p", "", "No annual investment balances are available.")); return figure; }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.dataset.rrPoints = JSON.stringify(points);
    svg.dataset.rrExhaustion = data.exhaustionYear ?? "";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Non-super annual closing balances. ${data.basisLabel}. Exact amounts and the modelled exhaustion year are described below.`);
    drawChart(svg);
    figure.append(svg, make("figcaption", "rr-basis", `${data.basisLabel} · Calendar year`));
    if (data.exhaustionYear != null) {
      figure.append(make("p", "rr-chart-explanation", `Modelled non-super exhaustion: ${data.exhaustionYear}. Tiny positive balances can look like zero at this scale. The model records this milestone at a zero closing balance with a withdrawal; display rounding does not change its date.`));
      const details = make("details", "rr-panel"); details.dataset.semiDetailState = "rr-exhaustion-balances";
      details.open = Boolean(state["rr-exhaustion-balances"]);
      details.append(make("summary", "", "View balances near exhaustion"));
      const table = make("table", "rr-exact-balances");
      table.append(make("caption", "", `${data.basisLabel}. Positive amounts below one cent are identified explicitly.`));
      const head = make("thead"), headRow = make("tr");
      for (const label of ["Year", "Non-super closing balance"]) { const cell=make("th", "", label); cell.scope="col"; headRow.append(cell); }
      head.append(headRow); table.append(head);
      const body = make("tbody");
      for (const point of points.filter(point => point.year <= data.exhaustionYear).slice(-6)) {
        const row = make("tr"), year = make("th", "", point.year); year.scope="row";
        const exact = point.value > 0 && point.value < .01 ? "Less than $0.01" : new Intl.NumberFormat("en-AU", {style:"currency",currency:"AUD",minimumFractionDigits:2,maximumFractionDigits:2}).format(point.value);
        row.append(year,make("td", "", exact)); body.append(row);
      }
      table.append(body); details.append(table); figure.append(details);
    } else if (points.every(point => point.value === 0)) figure.append(make("p", "rr-chart-explanation", "All recorded non-super closing balances are zero. This alone does not establish a spending shortfall; income and accessible super may still fund the plan."));
    return figure;
  }

  function drawChart(svg) {
    const points = JSON.parse(svg.dataset.rrPoints), compact = global.innerWidth < 600;
    const width = compact ? 350 : 700, left = compact ? 68 : 92, right = width - 28;
    const top = 32, bottom = 202, max = Math.max(0, ...points.map(p => p.value));
    const start = points[0].year, end = points.at(-1).year;
    const x = year => left + (year - start) / Math.max(1, end - start) * (right - left);
    const y = value => bottom - value / (max || 1) * (bottom - top);
    svg.setAttribute("viewBox", `0 0 ${width} 250`);
    svg.classList.toggle("is-mobile-chart", compact); svg.replaceChildren();
    const draw = (tag, attrs, text) => { const node = document.createElementNS(svg.namespaceURI, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); if (text != null) node.textContent = text; svg.append(node); return node; };
    for (const fraction of max === 0 ? [0] : [0, .5, 1]) {
      draw("line", { x1:left, x2:right, y1:y(max*fraction), y2:y(max*fraction), class:"rr-chart-grid" });
      const label = new Intl.NumberFormat("en-AU", {style:"currency",currency:"AUD",notation:"compact",maximumFractionDigits:1}).format(max*fraction);
      draw("text", {x:left-8,y:y(max*fraction)+5,"text-anchor":"end"},label);
    }
    draw("polyline", {points:points.map(p=>`${x(p.year)},${y(p.value)}`).join(" "),class:"rr-chart-line"});
    for(const p of points) {
      const dot=draw("circle",{cx:x(p.year),cy:y(p.value),r:2.5,class:"rr-chart-point","data-year":p.year,"data-value":p.value});
      const title=document.createElementNS(svg.namespaceURI,"title");
      title.textContent=`${p.year} · ${p.ages}: ${p.value > 0 && p.value < .01 ? "Less than $0.01" : new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:2}).format(p.value)}`; dot.append(title);
    }
    const exhaustion = Number(svg.dataset.rrExhaustion);
    if (svg.dataset.rrExhaustion && exhaustion >= start && exhaustion <= end) draw("line",{x1:x(exhaustion),x2:x(exhaustion),y1:top,y2:bottom,class:"rr-chart-exhaustion","data-exhaustion-year":exhaustion});
    const marks = compact ? [start,end] : [...new Set([start,points[Math.floor(points.length/2)].year,end])];
    for(const year of marks) draw("text",{x:x(year),y:232,"text-anchor":"middle"},year);
  }

  function installInteractions() {
    global.addEventListener("resize", () => document.querySelectorAll("svg[data-rr-points]").forEach(drawChart));
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
  global.FFSRetirementResults = { presentation, adjustmentPresentation, tagFragment, redesign, installInteractions };
})(typeof window === "undefined" ? globalThis : window);
