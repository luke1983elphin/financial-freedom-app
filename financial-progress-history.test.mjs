import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
  new URL("../app.js", import.meta.url),
  "utf8",
);
const htmlSource = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(
  new URL("../api/ai-insights.js", import.meta.url),
  "utf8",
);

test("financial progress view is wired into the application shell", () => {
  assert.match(htmlSource, /data-view-panel="progress"/);
  assert.match(htmlSource, /id="financialProgressRoot"/);
  assert.match(htmlSource, /id="financialProgressDashboardCard"/);
  assert.match(htmlSource, /data-view="progress"/);
  assert.match(appSource, /renderFinancialProgress\(result\)/);
  assert.match(appSource, /renderFinancialProgressDashboardCard\(result\)/);
});

test("financial snapshots use a stable plan-scoped storage path and avoid demo saves", () => {
  assert.match(appSource, /FINANCIAL_SNAPSHOT_CALCULATION_VERSION/);
  assert.match(appSource, /currentSnapshotKey\(\)/);
  assert.match(appSource, /function loadFinancialSnapshots\(planId = activePlanId\)/);
  assert.match(appSource, /function saveFinancialSnapshots\(snapshots, message = ""\)/);
  assert.match(appSource, /if \(isDemoActive\(\)\) return \[\];/);
  assert.match(appSource, /Sample Plan history is temporary and was not saved to your personal snapshots/);
  assert.match(appSource, /maybeCreateAutomaticFinancialSnapshot\(result, "report"\)/);
});

test("snapshot import and export preserve progress history without replacing plan data", () => {
  assert.match(appSource, /snapshots: isDemoActive\(\) \? \[\] : loadFinancialSnapshots\(\)/);
  assert.match(appSource, /snapshots: Array\.isArray\(payload\.snapshots\)/);
  assert.match(appSource, /saveFinancialSnapshots\(imported\.snapshots\.map/);
});

test("progress AI route is separate from plan insights and validates structured output", () => {
  assert.match(apiSource, /body\.type === "progress"/);
  assert.match(apiSource, /validateProgressComparison/);
  assert.match(apiSource, /validateProgressInsights/);
  assert.match(apiSource, /callOpenAiProgress/);
  assert.match(apiSource, /Progress Since Your Last Review/);
});

test("financial progress styles include responsive comparison layouts", () => {
  assert.match(cssSource, /\.financial-progress-card/);
  assert.match(cssSource, /\.comparison-row/);
  assert.match(cssSource, /\.progress-ai-card/);
  assert.match(cssSource, /@media \(max-width: 700px\)/);
});
