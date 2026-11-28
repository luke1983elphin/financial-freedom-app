/* Connect the quick comparison to the current plan's live cashflow summary. */
(function () {
  "use strict";

  const actions = document.getElementById("whatIfActions");
  const summary = document.getElementById("setupSummary");
  const baseline = document.getElementById("whatIfCashflowBaseline");
  const link = baseline?.querySelector("a");
  const amount = baseline?.querySelector("strong");
  if (!actions || !summary || !link || !amount) return;

  const surplusLabel = "Current available cash surplus";

  function syncComparison() {
    for (const option of actions.querySelectorAll('select[data-scenario-target="incomeItemId"] option[value]:not([value=""])')) {
      const label = option.textContent.replace(/ — (?:person\d+|joint|household) \([^()]+\)$/, "");
      if (label !== option.textContent) option.textContent = label;
    }

    const label = [...summary.querySelectorAll(".setup-summary-row > span")]
      .find(item => item.textContent === "Final projected cash surplus" || item.textContent === surplusLabel);
    const row = label?.parentElement;
    const value = row?.querySelector("strong")?.textContent;
    if (row) {
      label.textContent = surplusLabel;
      row.id = "currentAvailableCashSurplus";
      row.tabIndex = -1;
    }

    const savedBase = [...actions.children].some(item =>
      item.textContent.startsWith("Reviewing this scenario against its saved base plan."));
    baseline.hidden = !actions.querySelector("[data-what-if]") || !value || savedBase;
    amount.textContent = value || "";
  }

  link.addEventListener("click", event => {
    const target = document.getElementById("currentAvailableCashSurplus");
    const setupNav = document.getElementById("setupNavButton");
    if (!target || !setupNav) return;
    event.preventDefault();
    setupNav.click();
    requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center" });
    });
  });

  const observer = new MutationObserver(syncComparison);
  observer.observe(actions, { childList: true });
  observer.observe(summary, { childList: true });
  syncComparison();
}());
