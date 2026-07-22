const MAX_REQUEST_BYTES = 90 * 1024;
const DEFAULT_MODEL = process.env.OPENAI_AI_INSIGHTS_MODEL || "gpt-4o-mini";
const DEFAULT_MAX_GENERATIONS = Number(process.env.AI_INSIGHTS_MAX_GENERATIONS || 5);
const DEFAULT_COOLDOWN_MS = Number(process.env.AI_INSIGHTS_COOLDOWN_MS || 60000);
const DISCLAIMER = "This report provides general educational information and scenario guidance based on the information and assumptions entered into the app. It does not take into account all matters that may be relevant to your circumstances and does not constitute personal financial product, taxation, legal or credit advice. Projections are estimates only and actual outcomes may vary. Consider obtaining advice from an appropriately licensed professional before acting on financial decisions.";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function isEnabled() {
  return String(process.env.NEXT_PUBLIC_ENABLE_AI_INSIGHTS || "").toLowerCase() === "true";
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error("Invalid JSON request."));
    }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
        reject(new Error("Request too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });
    req.on("error", reject);
  });
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sanitize(value, key = "") {
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitize(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((clean, [entryKey, entryValue]) => {
      if (/(name|email|address|account|tfn|taxfile|phone|note)/i.test(entryKey)) return clean;
      clean[entryKey] = sanitize(entryValue, entryKey);
      return clean;
    }, {});
  }
  if (typeof value === "number") return safeNumber(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().slice(0, 220);
    if (/@/.test(trimmed)) return "[removed]";
    return trimmed;
  }
  return value ?? null;
}

function validatePlanSummary(summary) {
  if (!summary || typeof summary !== "object") return "Missing financial plan summary.";
  const requiredObjects = ["household", "goals", "income", "expenses", "assets", "liabilities", "currentProjections", "assumptions"];
  const missing = requiredObjects.filter((key) => !summary[key] || typeof summary[key] !== "object");
  if (missing.length) return `Missing summary sections: ${missing.join(", ")}.`;
  if (!safeNumber(summary.goals.targetAnnualRetirementSpending)) return "Missing annual lifestyle spending.";
  if (!safeNumber(summary.income.combinedGrossIncome)) return "Missing household income.";
  if (!safeNumber(summary.expenses.annualLifestyleExpenses)) return "Missing annual lifestyle expenses.";
  if (!safeNumber(summary.assets.totalAssetsCalculatedByApp)) return "Missing asset information.";
  if (!safeNumber(summary.currentProjections.targetFiCapitalCalculatedByApp || summary.goals.targetFiCapitalCalculatedByApp)) return "Missing Financial Freedom target calculation.";
  return "";
}

function normaliseStringList(items, limit = 8) {
  return Array.isArray(items)
    ? items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function normaliseObjects(items, mapper, limit = 8) {
  return Array.isArray(items) ? items.map(mapper).filter(Boolean).slice(0, limit) : [];
}

function validateInsights(report) {
  if (!report || typeof report !== "object") return null;
  const rating = ["Strong", "Stable", "Needs Attention", "Insufficient Information"].includes(report.overallPosition?.rating)
    ? report.overallPosition.rating
    : "Stable";
  const summary = String(report.overallPosition?.summary || "").trim();
  if (!summary) return null;
  const strengths = normaliseObjects(report.strengths, (item) => ({
    title: String(item?.title || "").trim(),
    explanation: String(item?.explanation || "").trim(),
  })).filter((item) => item.title && item.explanation);
  const pressurePoints = normaliseObjects(report.pressurePoints, (item) => ({
    title: String(item?.title || "").trim(),
    explanation: String(item?.explanation || "").trim(),
    importance: ["High", "Medium", "Low"].includes(item?.importance) ? item.importance : "Medium",
  })).filter((item) => item.title && item.explanation);
  const rankedOpportunities = normaliseObjects(report.rankedOpportunities, (item, index) => ({
    rank: Number(item?.rank) || index + 1,
    title: String(item?.title || "").trim(),
    explanation: String(item?.explanation || "").trim(),
    potentialImpact: ["High", "Medium", "Low"].includes(item?.potentialImpact) ? item.potentialImpact : "Medium",
    complexity: ["Low", "Medium", "High"].includes(item?.complexity) ? item.complexity : "Medium",
    tradeOffs: normaliseStringList(item?.tradeOffs, 5),
  })).filter((item) => item.title && item.explanation);
  const suggestedScenarios = normaliseObjects(report.suggestedScenarios, (item) => ({
    title: String(item?.title || "").trim(),
    reason: String(item?.reason || "").trim(),
    scenarioInputs: normaliseStringList(item?.scenarioInputs, 5),
    disclaimer: String(item?.disclaimer || "").trim(),
  })).filter((item) => item.title && item.reason);
  if (!strengths.length && !pressurePoints.length && !rankedOpportunities.length) return null;
  return {
    generatedAt: new Date().toISOString(),
    overallPosition: { rating, summary },
    strengths,
    pressurePoints,
    rankedOpportunities,
    suggestedScenarios,
    actionPlan: {
      next30Days: normaliseStringList(report.actionPlan?.next30Days, 6),
      next12Months: normaliseStringList(report.actionPlan?.next12Months, 6),
      longerTerm: normaliseStringList(report.actionPlan?.longerTerm, 6),
    },
    missingInformation: normaliseStringList(report.missingInformation, 8),
    importantConsiderations: normaliseStringList(report.importantConsiderations, 8),
    disclaimer: DISCLAIMER,
  };
}

function systemPrompt() {
  return [
    "You are generating private beta Financial Freedom Insights for an Australian household financial modelling app.",
    "Use clear Australian English. Be supportive, practical and plain-spoken.",
    "Interpret only the calculations and figures supplied by the app. Do not invent retirement ages, projections, probabilities, tax savings, products or investment returns.",
    "Do not recommend specific shares, ETFs, managed funds, super funds, lenders, insurance products or credit products.",
    "Do not present yourself as a licensed financial adviser. This is educational scenario guidance only.",
    "Use cautious wording such as 'based on the figures entered', 'the app's current projection indicates', 'you may wish to explore', and 'a scenario worth modelling is'.",
    "Acknowledge missing or uncertain information. Explain trade-offs. Suggest scenarios the user can model in the existing app without changing their inputs.",
    "Return only valid JSON matching the requested schema. No Markdown.",
  ].join(" ");
}

function userPrompt(planSummary) {
  return JSON.stringify({
    task: "Generate structured Financial Freedom Insights from this anonymous app-calculated plan summary.",
    responseSchema: {
      generatedAt: "ISO date string",
      overallPosition: { rating: "Strong | Stable | Needs Attention | Insufficient Information", summary: "string" },
      strengths: [{ title: "string", explanation: "string" }],
      pressurePoints: [{ title: "string", explanation: "string", importance: "High | Medium | Low" }],
      rankedOpportunities: [{ rank: 1, title: "string", explanation: "string", potentialImpact: "High | Medium | Low", complexity: "Low | Medium | High", tradeOffs: ["string"] }],
      suggestedScenarios: [{ title: "string", reason: "string", scenarioInputs: ["string"], disclaimer: "string" }],
      actionPlan: { next30Days: ["string"], next12Months: ["string"], longerTerm: ["string"] },
      missingInformation: ["string"],
      importantConsiderations: ["string"],
      disclaimer: DISCLAIMER,
    },
    planSummary,
  });
}

async function callOpenAi(planSummary) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.AI_INSIGHTS_TIMEOUT_MS || 30000));
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(planSummary) },
        ],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 429
        ? "The private beta usage limit is busy. Please try again shortly."
        : "The AI review service was not available. Please try again later.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return validateInsights(JSON.parse(content));
  } finally {
    clearTimeout(timeout);
  }
}

export default async function aiInsightsHandler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      enabled: isEnabled(),
      maxGenerations: DEFAULT_MAX_GENERATIONS,
      cooldownMs: DEFAULT_COOLDOWN_MS,
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!isEnabled()) return sendJson(res, 404, { error: "AI Insights is not enabled for this beta." });
  if (!process.env.OPENAI_API_KEY) return sendJson(res, 500, { error: "AI Insights is not configured yet." });

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Invalid request." });
  }
  if (Buffer.byteLength(JSON.stringify(body || {}), "utf8") > MAX_REQUEST_BYTES) {
    return sendJson(res, 413, { error: "Request too large." });
  }
  const planSummary = sanitize(body.planSummary);
  const validationError = validatePlanSummary(planSummary);
  if (validationError) return sendJson(res, 400, { error: validationError });

  try {
    let insights = await callOpenAi(planSummary);
    if (!insights) insights = await callOpenAi(planSummary);
    if (!insights) return sendJson(res, 502, { error: "The AI response could not be read safely. Please try again." });
    return sendJson(res, 200, { insights });
  } catch (error) {
    if (error.name === "AbortError") return sendJson(res, 408, { error: "The AI review timed out. Please try again." });
    return sendJson(res, error.status === 429 ? 429 : 502, { error: error.message || "The AI review could not be generated." });
  }
}
