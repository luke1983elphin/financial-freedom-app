import { createHash, timingSafeEqual } from "node:crypto";

// A code-review gate, not an environment toggle. Public access and privacy
// dependencies in docs/PRIVACY-BOUNDARY.md must be resolved before changing it.
export const AI_RELEASE_READY = false;
export const unavailable = "AI features are currently unavailable. Please continue with manual entry and financial planning.";
export const explicitlyEnabled = value => value === "true";
export const boundedTimeout = value => Math.min(30000, Math.max(1000, Number(value) || 30000));

export function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateRequest(req, maxBytes) {
  if (req.method !== "POST") throw requestError(405, "Method not allowed.");
  const origins = (process.env.AI_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(s => {
    try { const url = new URL(s); return url.protocol === "https:" && url.origin === s; } catch { return false; }
  });
  if (!origins.includes(req.headers?.origin)) throw requestError(403, "Request origin is not allowed.");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers?.["content-type"] || "")) {
    throw requestError(415, "Use application/json.");
  }
  const length = req.headers?.["content-length"];
  if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > maxBytes)) {
    throw requestError(413, "Request too large.");
  }
}

// Private operator pilot only: never embed this token in the public browser.
// A public/signed-in product still needs its own reviewed access design.
export function authenticate(req) {
  const expected = process.env.AI_PRIVATE_ACCESS_TOKEN;
  if (!expected || expected.length < 32) throw requestError(503, unavailable);
  const actual = req.headers?.authorization || "";
  const digest = value => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(actual), digest(`Bearer ${expected}`))) throw requestError(401, "Access is required.");
}

// Atomic shared budget for BOTH routes and ALL instances; no local fallback.
// Fixed first-request window, capped at 20 calls/hour (each request: one generation).
export async function consumeBudget() {
  const endpoint = process.env.AI_LIMIT_REDIS_REST_URL;
  const token = process.env.AI_LIMIT_REDIS_REST_TOKEN;
  if (!endpoint || !token) throw requestError(503, unavailable);
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n";
    const response = await fetch(url, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify(["EVAL", script, "1", "financial-freedom:ai:hourly-budget"]),
    });
    const payload = await response.json();
    if (!response.ok || payload.error || !Number.isInteger(payload.result) || payload.result < 1) throw new Error();
    if (payload.result > 20) throw requestError(429, "AI usage limit reached. Please try again later.");
  } catch (error) {
    if (error.status === 429) throw error;
    throw requestError(503, unavailable);
  }
}

export async function protectRequest(req, maxBytes) {
  validateRequest(req, maxBytes);
  authenticate(req);
  await consumeBudget();
}

export async function readJsonBody(req, maxBytes) {
  let raw = req.body;
  if (raw === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) throw requestError(413, "Request too large.");
      chunks.push(bytes);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  let body;
  try {
    const encoded = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (Buffer.byteLength(encoded || "", "utf8") > maxBytes) throw requestError(413, "Request too large.");
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    if (error.status === 413) throw error;
    throw requestError(400, "Invalid JSON request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw requestError(400, "Invalid JSON request.");
  return body;
}
