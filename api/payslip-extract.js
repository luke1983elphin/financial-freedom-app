const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const DEFAULT_MODEL = process.env.OPENAI_PAYSLIP_MODEL || "gpt-4.1-mini";
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
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

function cleanFilename(value) {
  return String(value || "payslip").replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 120) || "payslip";
}

function dataUrlParts(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2].replace(/\s+/g, "") };
}

function outputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

function parseJsonText(text) {
  const raw = String(text || "").trim();
  const unfenced = raw.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  return JSON.parse(unfenced);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normaliseFrequency(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["weekly", "week"].includes(text)) return "weekly";
  if (["fortnightly", "fortnight", "biweekly"].includes(text)) return "fortnightly";
  if (["monthly", "month"].includes(text)) return "monthly";
  if (["quarterly", "quarter"].includes(text)) return "quarterly";
  if (["annually", "annual", "yearly", "year"].includes(text)) return "annually";
  return "";
}

function normalisePayslip(value) {
  if (!value || typeof value !== "object") return null;
  const grossPay = numberOrNull(value.grossPay);
  if (!grossPay || grossPay <= 0) return null;
  return {
    grossPay,
    payFrequency: normaliseFrequency(value.payFrequency),
    paygWithholding: numberOrNull(value.paygWithholding),
    employerSuper: numberOrNull(value.employerSuper),
    salarySacrificeSuper: numberOrNull(value.salarySacrificeSuper),
    preTaxDeductions: numberOrNull(value.preTaxDeductions),
    postTaxDeductions: numberOrNull(value.postTaxDeductions),
    stslWithholding: numberOrNull(value.stslWithholding),
    netPay: numberOrNull(value.netPay),
  };
}

function extractionPrompt() {
  return [
    "Read this Australian employee payslip and extract only the current pay-period amounts.",
    "Return JSON only. Do not include names, addresses, employer identifiers, bank details, tax file numbers, membership numbers, employee IDs or free-text notes.",
    "Use this exact object shape:",
    "{",
    '  "grossPay": number|null,',
    '  "payFrequency": "weekly"|"fortnightly"|"monthly"|"quarterly"|"annually"|"",',
    '  "paygWithholding": number|null,',
    '  "employerSuper": number|null,',
    '  "salarySacrificeSuper": number|null,',
    '  "preTaxDeductions": number|null,',
    '  "postTaxDeductions": number|null,',
    '  "stslWithholding": number|null,',
    '  "netPay": number|null',
    "}",
    "Important rules:",
    "- Use the gross earnings for this pay period, not year-to-date totals.",
    "- Employer super means employer/SG super for this pay period, not employee salary sacrifice.",
    "- salarySacrificeSuper is employee pre-tax sacrifice to super only.",
    "- preTaxDeductions is other pre-tax packaging/deductions and must exclude salarySacrificeSuper.",
    "- postTaxDeductions is the total other post-tax deductions or employee contributions.",
    "- If a field cannot be identified confidently, use null or an empty payFrequency.",
    "- Do not infer a value from net pay arithmetic when it is not shown.",
  ].join("\n");
}

async function extractWithOpenAi({ mimeType, base64, filename }) {
  const content = [{ type: "input_text", text: extractionPrompt() }];
  if (mimeType === "application/pdf") {
    content.push({ type: "input_file", filename, file_data: base64 });
  } else {
    content.push({ type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PAYSLIP_EXTRACT_TIMEOUT_MS || 30000));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        store: false,
        temperature: 0,
        max_output_tokens: 500,
        input: [{
          role: "user",
          content,
        }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 429
        ? "Payslip reading is busy. Please try again shortly."
        : "The payslip reading service is unavailable. Please try again later.");
      error.status = response.status;
      throw error;
    }
    const text = outputText(payload);
    if (!text) return null;
    return normalisePayslip(parseJsonText(text));
  } finally {
    clearTimeout(timeout);
  }
}

export default async function payslipExtractHandler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 503, { error: "Payslip upload is not configured yet. Enter the salary manually for now." });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, error.message === "Request too large." ? 413 : 400, { error: error.message || "Invalid request." });
  }
  if (Buffer.byteLength(JSON.stringify(body || {}), "utf8") > MAX_REQUEST_BYTES) {
    return sendJson(res, 413, { error: "Payslip file is too large." });
  }

  const parts = dataUrlParts(body.dataUrl);
  const mimeType = String(body.mimeType || parts?.mimeType || "").toLowerCase();
  if (!parts || !ALLOWED_MIME_TYPES.has(mimeType) || parts.mimeType.toLowerCase() !== mimeType) {
    return sendJson(res, 400, { error: "Choose a PDF, JPG, PNG or WebP payslip." });
  }

  let payslip;
  try {
    payslip = await extractWithOpenAi({
      mimeType,
      base64: parts.base64,
      filename: cleanFilename(body.filename),
    });
  } catch (error) {
    if (error.name === "AbortError") return sendJson(res, 408, { error: "Payslip reading timed out. Please try again." });
    return sendJson(res, error.status === 429 ? 429 : 502, { error: error.message || "The payslip could not be read." });
  }
  if (!payslip) {
    return sendJson(res, 422, { error: "We could not confidently read this payslip. Enter the salary manually or try another payslip." });
  }
  return sendJson(res, 200, { payslip });
}
