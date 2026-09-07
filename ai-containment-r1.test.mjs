import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import aiInsightsHandler from "../api/ai-insights.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const ENV_KEYS = [
  "AI_INSIGHTS_SERVER_ENABLED",
  "NEXT_PUBLIC_ENABLE_AI_INSIGHTS",
  "OPENAI_API_KEY",
  "OPENAI_AI_INSIGHTS_MODEL",
  "AI_INSIGHTS_TIMEOUT_MS",
];

const validPlanSummary = {
  household: { person1Age: 42, person2Age: 40, dependants: 2 },
  goals: {
    targetRetirementAge: 58,
    targetAnnualRetirementSpending: 90000,
    targetFiCapitalCalculatedByApp: 2250000,
  },
  income: {
    combinedGrossIncome: 210000,
    estimatedCombinedNetIncome: 150000,
  },
  expenses: {
    annualLifestyleExpenses: 85000,
    mortgageRepayments: 36000,
    calculatedAnnualSurplus: 29000,
  },
  assets: {
    totalAssetsCalculatedByApp: 950000,
    investmentsOutsideSuper: 175000,
    superannuation: 310000,
  },
  liabilities: {
    homeLoan: 520000,
    otherDebts: 0,
  },
  currentProjections: {
    estimatedFinancialFreedomAge: 57,
    targetFiCapitalCalculatedByApp: 2250000,
  },
  assumptions: {
    investmentReturn: 0.07,
    inflation: 0.025,
  },
};

const validProgressComparison = {
  comparisonPeriod: { fromDate: "2026-01-01", toDate: "2026-09-06" },
  historical: { netWorth: 700000 },
  current: { netWorth: 760000 },
  movements: { netWorth: 60000 },
};

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload) {
      this.body = String(payload || "");
      this.json = this.body ? JSON.parse(this.body) : null;
    },
  };
}

async function request(method, body, options = {}) {
  const res = createResponse();
  const req = {
    method,
    body,
    headers: options.headers || {},
    url: options.url || "/api/ai-insights",
  };
  await aiInsightsHandler(req, res);
  return res;
}

async function withEnvironment(values, fn) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined) process.env[key] = value;
  });
  try {
    return await fn();
  } finally {
    ENV_KEYS.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

function installProviderMock(responseContent) {
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify(responseContent),
              },
            },
          ],
        };
      },
    };
  };
  return {
    get calls() {
      return calls;
    },
    restore() {
      globalThis.fetch = previousFetch;
    },
  };
}

function installThrowingProviderMock() {
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("Provider should not be called while AI is disabled.");
  };
  return {
    get calls() {
      return calls;
    },
    restore() {
      globalThis.fetch = previousFetch;
    },
  };
}

test("R1 AI generation fails closed for unset, false, empty and unsupported server enablement values", async () => {
  const cases = [
    { label: "unset", env: {} },
    { label: "explicit false", env: { AI_INSIGHTS_SERVER_ENABLED: "false" } },
    { label: "empty", env: { AI_INSIGHTS_SERVER_ENABLED: "" } },
    { label: "unsupported yes", env: { AI_INSIGHTS_SERVER_ENABLED: "yes" } },
    { label: "unsupported one", env: { AI_INSIGHTS_SERVER_ENABLED: "1" } },
    { label: "unsupported uppercase", env: { AI_INSIGHTS_SERVER_ENABLED: "TRUE" } },
    { label: "leading whitespace", env: { AI_INSIGHTS_SERVER_ENABLED: " true" } },
    { label: "trailing whitespace", env: { AI_INSIGHTS_SERVER_ENABLED: "true " } },
    { label: "tab and newline whitespace", env: { AI_INSIGHTS_SERVER_ENABLED: "\ttrue\n" } },
  ];
  for (const item of cases) {
    const provider = installThrowingProviderMock();
    await withEnvironment({ ...item.env, OPENAI_API_KEY: "test-key", NEXT_PUBLIC_ENABLE_AI_INSIGHTS: "true" }, async () => {
      const res = await request("POST", { planSummary: validPlanSummary });
      assert.equal(res.statusCode, 503, item.label);
      assert.equal(res.json.code, "AI_INSIGHTS_DISABLED", item.label);
      assert.match(res.json.error, /currently unavailable/i, item.label);
    });
    assert.equal(provider.calls, 0, item.label);
    provider.restore();
  }
});

test("R1 disabled POST is rejected before the handler reads the request body or stream", async () => {
  const provider = installThrowingProviderMock();
  let bodyReads = 0;
  let streamReads = 0;
  await withEnvironment({
    AI_INSIGHTS_SERVER_ENABLED: "false",
    OPENAI_API_KEY: "test-key",
  }, async () => {
    const res = createResponse();
    const req = {
      method: "POST",
      headers: {},
      url: "/api/ai-insights",
      get body() {
        bodyReads += 1;
        throw new Error("Disabled requests must not read req.body.");
      },
      on() {
        streamReads += 1;
        throw new Error("Disabled requests must not subscribe to the request stream.");
      },
    };
    await aiInsightsHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json.code, "AI_INSIGHTS_DISABLED");
  });
  assert.equal(bodyReads, 0);
  assert.equal(streamReads, 0);
  assert.equal(provider.calls, 0);
  provider.restore();
});

test("R1 API key, body, query and header values cannot enable AI when the server flag is disabled", async () => {
  const provider = installThrowingProviderMock();
  await withEnvironment({
    AI_INSIGHTS_SERVER_ENABLED: "false",
    NEXT_PUBLIC_ENABLE_AI_INSIGHTS: "true",
    OPENAI_API_KEY: "test-key",
  }, async () => {
    const res = await request("POST", {
      enabled: true,
      enableAi: true,
      AI_INSIGHTS_SERVER_ENABLED: "true",
      NEXT_PUBLIC_ENABLE_AI_INSIGHTS: "true",
      planSummary: validPlanSummary,
    }, {
      url: "/api/ai-insights?enabled=true&AI_INSIGHTS_SERVER_ENABLED=true",
      headers: {
        "x-enable-ai": "true",
        "x-ai-insights-enabled": "true",
      },
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.json.code, "AI_INSIGHTS_DISABLED");
  });
  assert.equal(provider.calls, 0);
  provider.restore();
});

test("R1 direct progress requests and repeated disabled requests never call the provider", async () => {
  const provider = installThrowingProviderMock();
  await withEnvironment({
    AI_INSIGHTS_SERVER_ENABLED: "false",
    OPENAI_API_KEY: "test-key",
  }, async () => {
    const first = await request("POST", { type: "progress", progressComparison: validProgressComparison });
    const second = await request("POST", { planSummary: validPlanSummary });
    const third = await request("POST", { type: "progress", progressComparison: validProgressComparison });
    assert.equal(first.statusCode, 503);
    assert.equal(second.statusCode, 503);
    assert.equal(third.statusCode, 503);
  });
  assert.equal(provider.calls, 0);
  provider.restore();
});

test("R1 availability endpoint reports disabled without requiring an API key or calling the provider", async () => {
  const provider = installThrowingProviderMock();
  await withEnvironment({}, async () => {
    const res = await request("GET");
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.enabled, false);
    assert.match(res.json.message, /currently unavailable/i);
  });
  assert.equal(provider.calls, 0);
  provider.restore();
});

test("R1 current baseline has no separate root legacy AI route bypass", () => {
  assert.equal(existsSync(new URL("../ai-insights.js", import.meta.url)), false);
});

test("R1 front end treats the server configuration endpoint as authoritative", () => {
  assert.match(appSource, /enabled: false,\s*\n\s*configLoaded: false/);
  assert.doesNotMatch(appSource, /Boolean\(window\.FFS_ENABLE_AI_INSIGHTS\)/);
  assert.match(appSource, /if \(!aiInsightsConfig\.enabled\) \{\s*\n\s*aiInsightsUi\.error/);
  assert.match(appSource, /AI insights are currently unavailable\. You can continue using the financial planning tools\./);
});

test("R1 enabled path remains available only with explicit server flag and mocked provider", async () => {
  const insightsProvider = installProviderMock({
    generatedAt: "2026-09-06T00:00:00.000Z",
    overallPosition: { rating: "Stable", summary: "The fictional household is tracking steadily based on supplied app figures." },
    strengths: [{ title: "Positive surplus", explanation: "The app-calculated surplus gives this fictional household options." }],
    pressurePoints: [{ title: "Mortgage debt", explanation: "The household still carries mortgage debt.", importance: "Medium" }],
    rankedOpportunities: [{ rank: 1, title: "Review contributions", explanation: "Model higher contributions in the app.", potentialImpact: "Medium", complexity: "Low", tradeOffs: ["Less short-term cash."] }],
    suggestedScenarios: [],
    actionPlan: { next30Days: ["Review assumptions."], next12Months: ["Model a contribution change."], longerTerm: ["Review yearly."] },
    missingInformation: [],
    importantConsiderations: ["Fictional test only."],
  });
  await withEnvironment({
    AI_INSIGHTS_SERVER_ENABLED: "true",
    OPENAI_API_KEY: "test-key",
  }, async () => {
    const res = await request("POST", { planSummary: validPlanSummary });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.insights.overallPosition.rating, "Stable");
  });
  assert.equal(insightsProvider.calls, 1);
  insightsProvider.restore();

  const progressProvider = installProviderMock({
    generatedAt: "2026-09-06T00:00:00.000Z",
    summary: "The fictional household improved its net worth.",
    keyImprovements: ["Net worth increased."],
    areasToReview: ["Review spending."],
    progressTowardGoals: ["Progress is visible."],
    nextReviewActions: ["Check assumptions."],
  });
  await withEnvironment({
    AI_INSIGHTS_SERVER_ENABLED: "true",
    OPENAI_API_KEY: "test-key",
  }, async () => {
    const res = await request("POST", { type: "progress", progressComparison: validProgressComparison });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.progressInsights.summary, "The fictional household improved its net worth.");
  });
  assert.equal(progressProvider.calls, 1);
  progressProvider.restore();
});
