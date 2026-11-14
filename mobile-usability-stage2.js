(function attachMobileUsabilityStage2(root) {
  "use strict";
  const metadataLabels = new Set([
    "saved plan snapshot",
    "snapshot name",
    "scenario name",
    "scenario notes",
    "notes",
    "saved at",
    "updated at",
  ]);
  function financialChanges(changes = []) {
    return changes.filter(
      (change) =>
        !metadataLabels.has(
          String(change.label || "")
            .trim()
            .toLowerCase(),
        ),
    );
  }
  function spendingError(value) {
    if (String(value).trim() === "" || !Number.isFinite(Number(value)))
      return "Enter a finite annual spending amount.";
    if (Number(value) < 0) return "Annual spending cannot be negative.";
    return "";
  }
  function currencyHtml(html) {
    return html.replace(/<input\b[^>]*type="number"[^>]*>/g, (input) => {
      const next = input
        .replace(/\sstep="[^"]*"/, "")
        .replace(/\smin="[^"]*"/, "");
      return next.replace(/>$/, ' min="0" step="any" required>');
    });
  }
  function inputDifferences(current, saved, path = "") {
    if (JSON.stringify(current) === JSON.stringify(saved)) return [];
    if (
      (current && typeof current === "object") ||
      (saved && typeof saved === "object")
    ) {
      const keys = [
        ...new Set([
          ...Object.keys(current || {}),
          ...Object.keys(saved || {}),
        ]),
      ];
      return keys
        .filter(
          (key) =>
            (path !== "" || !["meta", "planSchemaVersion"].includes(key)) &&
            (path !== "reportSettings" || !["engagement", "aiInsights"].includes(key)),
        )
        .flatMap((key) =>
          inputDifferences(
            current?.[key],
            saved?.[key],
            path ? `${path}.${key}` : key,
          ),
        );
    }
    return [{ path, current, saved }];
  }
  function inputLabel(path, current = {}, saved = {}) {
    const parts = path.split(".");
    const titles = { personal:"Household", assets:"Assets", liabilities:"Debts", investing:"Investment assumptions", assumptions:"Forecast assumptions", assetItems:"Asset", incomeItems:"Income", expenseItems:"Expense", liabilityItems:"Debt", goalItems:"Goal", people:"Person", reportSettings:"Plan settings" };
    const words = text => text.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/Pct$/, " (%)").replace(/^./, value=>value.toUpperCase());
    const labels = [titles[parts[0]] || words(parts[0])];
    let index = 1;
    if (/^\d+$/.test(parts[1] || "")) {
      const record = saved[parts[0]]?.[parts[1]] || current[parts[0]]?.[parts[1]];
      labels.push(record?.name || `Item ${Number(parts[1])+1}`); index = 2;
    }
    const fields = { targetAnnualSpending:"Annual spending target ($)", value:"Value ($)", amount:"Amount ($)", balance:"Balance ($)", repayment:"Repayment ($)", expectedInvestmentReturnPct:"Investment return (%)", expectedSuperReturnPct:"Super return (%)", inflationPct:"Inflation (%)" };
    return [...labels,...parts.slice(index).map(part=>fields[part] || words(part))].join(" · ");
  }
  function decorateComparison(container, baseLabel = "Current Plan") {
    if (!container) return;
    for (const row of container.querySelectorAll(
      ".what-if-forecast-row:not(.what-if-forecast-head)",
    )) {
      if (row.hasAttribute("data-stage2-comparison")) continue;
      row.dataset.stage2Comparison = "";
      [...row.children].slice(1).forEach((cell, index) => {
        const value = document.createElement("span");
        value.className = "stage2-comparison-value";
        while (cell.firstChild) value.append(cell.firstChild);
        const label = document.createElement("small");
        label.className = "stage2-comparison-label";
        label.textContent = [baseLabel, "Adjusted Plan", "Difference"][
          index
        ];
        cell.append(label, value);
      });
    }
  }
  root.FFSMobileUsabilityStage2 = Object.freeze({
    financialChanges,
    spendingError,
    currencyHtml,
    inputDifferences,
    inputLabel,
    decorateComparison,
  });
})(globalThis);
