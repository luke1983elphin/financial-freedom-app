import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(root, "stage-b-screenshots");
mkdirSync(screenshotsDir, { recursive: true });

const context = { console };
context.globalThis = context;
vm.runInNewContext(readFileSync(join(root, "calculator.js"), "utf8"), context);
vm.runInNewContext(readFileSync(join(root, "semiRetirementProjection.js"), "utf8"), context);
vm.runInNewContext(readFileSync(join(root, "semiRetirementUi.js"), "utf8"), context);

const ENGINE = context.FFSSemiRetirementProjection;
const UI = context.FFSSemiRetirementUi;

function mergeDeep(base, override) {
  if (Array.isArray(override)) return override.map((item) => mergeDeep({}, item));
  if (!override || typeof override !== "object") return override;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) output[key] = value.map((item) => mergeDeep({}, item));
    else if (value && typeof value === "object" && base?.[key] && typeof base[key] === "object" && !Array.isArray(base[key])) output[key] = mergeDeep(base[key], value);
    else output[key] = value;
  }
  return output;
}

function person(overrides = {}) {
  return mergeDeep({
    id: "person1",
    name: "Alex",
    currentAge: 50,
    currentGrossEmploymentIncome: 0,
    annualIncomeGrowthRate: 0,
    semiRetirementAge: 51,
    semiRetirementGrossIncome: 0,
    fullRetirementAge: 52,
    superAccessAge: 60,
    openingSuperBalance: 0,
    superReturnBeforeRetirement: 0,
    superReturnAfterRetirement: 0,
    superAnnualFeesRate: 0,
    employerSuperRate: 0,
    existingAdditionalConcessionalContributions: 0,
    additionalContributionsStopAge: 52,
    stslOpeningBalance: 0,
    hasPrivateHealthCover: true,
  }, overrides);
}

function baseInput(overrides = {}) {
  return mergeDeep({
    projectionStartYear: 2026,
    projectionEndAge: 56,
    inflationRate: 0,
    household: {
      currentLifestyleSpending: 0,
      semiRetirementLifestyleSpending: 0,
      fullRetirementLifestyleSpending: 0,
      otherAnnualIncome: 0,
      annualLoanPrincipalRepayments: 0,
    },
    accessibleInvestments: {
      openingBalance: 200000,
      annualReturnRate: 0,
      annualFeesRate: 0,
      currentAnnualContributions: 0,
    },
    assets: [
      { id: "rental", name: "12 Smith Street", type: "rentalInvestmentProperty", openingValue: 500000, annualGrowthRate: 0.04 },
    ],
    liabilities: [
      { id: "home", name: "Home Loan", type: "homeLoan", openingBalance: 120000, openingOffsetBalance: 20000, interestRatePct: 0, repaymentAmount: 20000, repaymentFrequency: "annually", remainingTermYears: 10 },
      { id: "car", name: "Vehicle Loan", type: "vehicleLoan", openingBalance: 15000, interestRatePct: 0, repaymentAmount: 5000, repaymentFrequency: "annually", remainingTermYears: 5 },
      { id: "rental-loan", name: "Investment Property Loan", type: "rentalPropertyLoan", linkedAssetId: "rental", openingBalance: 100000, interestRatePct: 0, repaymentAmount: 10000, repaymentFrequency: "annually", remainingTermYears: 15 },
    ],
    propertyIncome: [
      { id: "rent", name: "12 Smith Street rent", linkedAssetId: "rental", linkedLoanIds: ["rental-loan"], annualIncome: 18000, rentalCashflowTreatment: "afterInterest" },
    ],
    people: [
      person(),
      person({ id: "person2", name: "Sam", currentAge: 48, semiRetirementAge: 51, fullRetirementAge: 53 }),
    ],
    scenario: {
      semiRetirementAccessibleWithdrawal: 0,
      fullRetirementAnnualSpending: 0,
      minimumAccessibleBalance: 0,
      minimumEstateBalanceAtEndAge: 0,
    },
  }, overrides);
}

function project(overrides = {}) {
  const inputs = baseInput(overrides);
  const result = ENGINE.projectRetirementScenario(inputs);
  if (!result.validation.isValid) throw new Error(JSON.stringify(result.validation.errors));
  const viewModel = UI.buildSemiRetirementResultsViewModel(result, inputs, inputs);
  return { inputs, result, viewModel };
}

function money(value) {
  const rounded = Math.round(Number(value || 0));
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(rounded);
}

function signedMoney(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "-"}${money(Math.abs(amount))}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function metric(label, value, note = "") {
  return `<article class="semi-retirement-metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}</article>`;
}

function debtCard(card) {
  const impact = card.repaymentDropAfterPayoff
    ? `<small>Based on current repayment assumptions, household debt repayments fall by ${money(card.repaymentDropAfterPayoff.drop)} after payoff.</small>`
    : "";
  return `<article class="semi-retirement-metric-card semi-retirement-debt-card ${card.hasNegativeAmortisation ? "is-warning" : ""}">
    <span>${escapeHtml(card.typeLabel || "Debt")}</span>
    <strong>${escapeHtml(card.name)}</strong>
    <div class="semi-retirement-person-values">
      <span>Current balance</span><b>${money(card.currentBalance)}</b>
      <span>Balance at retirement</span><b>${money(card.balanceAtRetirement)}</b>
      <span>Annual repayment</span><b>${money(card.annualRepayment)}</b>
      <span>Expected payoff</span><b>${card.payoff?.calendarYear ? escapeHtml(card.payoff.calendarYear) : "Not projected"}</b>
      ${card.linkedPropertyName ? `<span>Linked property</span><b>${escapeHtml(card.linkedPropertyName)}</b>` : ""}
      ${card.payoffIsBalloon ? `<span>Final repayment</span><b>${money(card.payoff?.amount)}</b>` : ""}
    </div>
    ${impact}
  </article>`;
}

function propertyCard(card) {
  return `<article class="semi-retirement-metric-card semi-retirement-property-card ${card.cashflowTone === "warning" ? "is-warning" : "is-positive"}">
    <span>${escapeHtml(card.milestoneLabel)}</span>
    <strong>${escapeHtml(card.name)}</strong>
    <div class="semi-retirement-person-values">
      <span>Projected property value</span><b>${money(card.projectedPropertyValue)}</b>
      <span>Linked property debt</span><b>-${money(card.linkedPropertyDebt)}</b>
      <span>Projected property equity</span><b>${money(card.projectedPropertyEquity)}</b>
      <span>Rental cash income</span><b>${money(card.rentalCashIncome)} p.a.</b>
      <span>Net property cashflow</span><b>${signedMoney(card.netPropertyCashflow)} p.a.</b>
    </div>
    <small>Property equity contributes to projected net worth but is not treated as available retirement spending unless a future property sale is modelled.</small>
  </article>`;
}

function annualDetail(row) {
  const liabilities = (row.liabilities || []).filter((item) => Number(item.openingBalance || item.closingBalance || item.interest || item.totalRepayment || item.capitalisedInterest || item.balloonRepayment) > 0);
  const properties = row.properties || [];
  return `<section class="semi-retirement-results-section">
    <div class="semi-retirement-section-heading"><h4>Expanded annual detail</h4><p>${row.calendarYear} · debt and property values from the annual projection row.</p></div>
    <div class="semi-retirement-results-grid">
      ${liabilities.map((item) => `<article class="semi-retirement-metric-card semi-retirement-debt-card">
        <span>Debt detail</span><strong>${escapeHtml(item.name)}</strong>
        <div class="semi-retirement-person-values">
          <span>Opening balance</span><b>${money(item.openingBalance)}</b>
          ${item.offsetBalanceUsed ? `<span>Offset used</span><b>${money(item.offsetBalanceUsed)}</b>` : ""}
          <span>Interest</span><b>${money(item.interest)}</b>
          <span>Scheduled repayment</span><b>${money(item.regularRepayment)}</b>
          ${item.balloonRepayment ? `<span>Balloon repayment</span><b>${money(item.balloonRepayment)}</b>` : ""}
          <span>Principal repaid</span><b>${money(item.principalRepaid)}</b>
          ${item.capitalisedInterest ? `<span>Capitalised interest</span><b>${money(item.capitalisedInterest)}</b>` : ""}
          <span>Closing balance</span><b>${money(item.closingBalance)}</b>
        </div>
      </article>`).join("")}
      ${properties.map((item) => `<article class="semi-retirement-metric-card semi-retirement-property-card">
        <span>Property detail</span><strong>${escapeHtml(item.name)}</strong>
        <div class="semi-retirement-person-values">
          <span>Opening value</span><b>${money(item.openingValue)}</b>
          <span>Growth</span><b>${money(item.growth)}</b>
          <span>Closing value</span><b>${money(item.closingValue)}</b>
          <span>Rental cash income</span><b>${money(item.rentalCashIncome)}</b>
          <span>Loan interest</span><b>${money(item.loanInterest)}</b>
          <span>Loan principal</span><b>${money(item.loanPrincipal)}</b>
          <span>Net property cashflow</span><b>${signedMoney(item.netPropertyCashflow)}</b>
          <span>Linked loan balance</span><b>${money(item.linkedLoanBalance)}</b>
          <span>Property equity</span><b>${money(item.propertyEquity)}</b>
        </div>
      </article>`).join("")}
    </div>
  </section>`;
}

function pageHtml() {
  const { viewModel, result } = project();
  const shortfall = project({
    accessibleInvestments: { openingBalance: 50000, annualReturnRate: 0, annualFeesRate: 0, currentAnnualContributions: 0 },
    household: { fullRetirementLifestyleSpending: 100000 },
    liabilities: [],
    propertyIncome: [],
    scenario: { fullRetirementAnnualSpending: 100000 },
  }).viewModel.debtProperty;
  const debtProperty = viewModel.debtProperty;
  const row = result.years.find((item) => item.calendarYear === debtProperty.propertyCards[0].selectedYear) || result.years[0];
  return `<!doctype html>
  <html lang="en-AU">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Stage B Debt & Property Screenshots</title>
      <link rel="stylesheet" href="${pathToFileURL(join(root, "styles.css")).href}">
      <style>
        body { margin: 0; background: #f5f7fb; color: #0f2742; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .shot-page { max-width: 1180px; margin: 0 auto; padding: 32px 20px; }
        .shot-section { min-height: 720px; padding: 28px 0; scroll-margin-top: 0; }
        .shot-title { margin: 0 0 18px; font-size: 28px; line-height: 1.15; font-weight: 900; }
        .semi-retirement-result-card { display: block; }
        @media (max-width: 640px) {
          .shot-page { padding: 18px 12px; }
          .shot-section { min-height: 820px; padding: 18px 0; }
          .shot-title { font-size: 22px; }
        }
      </style>
    </head>
    <body>
      <main class="shot-page">
        <section id="home-loan" class="shot-section">
          <h1 class="shot-title">Desktop · household with home loan</h1>
          <section class="semi-retirement-results-section semi-retirement-debt-property">
            <div class="semi-retirement-section-heading"><h4>Debt & Property</h4><p>What debts remain while the household semi-retires, and when do they disappear?</p></div>
            <div class="semi-retirement-results-grid compact">
              ${debtProperty.milestoneDebt.map((item) => metric(item.label, money(item.value), item.row?.calendarYear || "")).join("")}
            </div>
            <div class="semi-retirement-results-grid">
              ${debtProperty.debtCards.map(debtCard).join("")}
            </div>
          </section>
        </section>
        <section id="rental-property" class="shot-section">
          <h1 class="shot-title">Desktop · rental / investment property</h1>
          <section class="semi-retirement-results-section semi-retirement-debt-property">
            <div class="semi-retirement-section-heading"><h4>Rental / Investment Property</h4><p>Property equity and rental cashflow are shown separately from accessible retirement assets.</p></div>
            <div class="semi-retirement-results-grid">
              ${debtProperty.propertyCards.map(propertyCard).join("")}
            </div>
          </section>
        </section>
        <section id="cashflow-change" class="shot-section">
          <h1 class="shot-title">Desktop · debt payoff cashflow change</h1>
          <section class="semi-retirement-results-section">
            <div class="semi-retirement-section-heading"><h4>Debt payoff impact</h4><p>Repayment reductions are derived from adjacent annual projection rows.</p></div>
            <div class="semi-retirement-results-grid">
              ${debtProperty.debtCards.filter((card) => card.repaymentDropAfterPayoff).map(debtCard).join("")}
            </div>
          </section>
        </section>
        <section id="shortfall-property-equity" class="shot-section">
          <h1 class="shot-title">Desktop · shortfall with property equity remaining</h1>
          <section class="semi-retirement-results-section">
            <article class="semi-retirement-metric-card is-warning">
              <span>Accessible investments exhausted</span>
              <strong>${shortfall.accessibleExhaustionPropertyEquity?.calendarYear || "Projected"}</strong>
              <small>Projected property equity at that time: ${money(shortfall.accessibleExhaustionPropertyEquity?.propertyEquity)}. Property equity is not automatically used to fund spending in this scenario.</small>
            </article>
          </section>
        </section>
        <section id="mobile-summary" class="shot-section">
          <h1 class="shot-title">Mobile · debt/property summary</h1>
          <section class="semi-retirement-results-section semi-retirement-debt-property">
            <div class="semi-retirement-section-heading"><h4>Debt & Property</h4><p>Stacked summary cards avoid horizontal overflow on phones.</p></div>
            <div class="semi-retirement-results-grid compact">
              ${debtProperty.milestoneDebt.slice(0, 3).map((item) => metric(item.label, money(item.value), item.row?.calendarYear || "")).join("")}
            </div>
            <div class="semi-retirement-results-grid">
              ${debtProperty.debtCards.slice(0, 2).map(debtCard).join("")}
            </div>
          </section>
        </section>
        <section id="mobile-detail" class="shot-section">
          <h1 class="shot-title">Mobile · expanded property/debt detail</h1>
          ${annualDetail(row)}
        </section>
      </main>
    </body>
  </html>`;
}

const fixturePath = join(screenshotsDir, "stage-b-screenshot-fixture.html");
writeFileSync(fixturePath, pageHtml(), "utf8");

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error("No Chrome or Edge executable found for screenshots.");
const chromeProfileDir = join(screenshotsDir, "chrome-profile");
mkdirSync(chromeProfileDir, { recursive: true });

const shots = [
  ["stage-b-desktop-home-loan.png", "home-loan", "1440,900"],
  ["stage-b-desktop-rental-property.png", "rental-property", "1440,900"],
  ["stage-b-desktop-debt-payoff-cashflow-change.png", "cashflow-change", "1440,900"],
  ["stage-b-desktop-shortfall-property-equity.png", "shortfall-property-equity", "1440,900"],
  ["stage-b-mobile-debt-property-summary.png", "mobile-summary", "390,844"],
  ["stage-b-mobile-expanded-property-debt-detail.png", "mobile-detail", "390,844"],
];

for (const [name, hash, size] of shots) {
  const target = join(screenshotsDir, name);
  const url = `${pathToFileURL(fixturePath).href}#${hash}`;
  const result = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--no-first-run",
    `--user-data-dir=${chromeProfileDir}`,
    `--window-size=${size}`,
    `--screenshot=${target}`,
    url,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Screenshot failed for ${name}: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`);
  }
}

console.log(`Generated ${shots.length} Stage B screenshots in ${screenshotsDir}`);
