import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import vm from "node:vm";
import payslip, { extractWithOpenAi } from "../api/payslip-extract.js";
import insights, { callOpenAi, callOpenAiProgress } from "../api/ai-insights.js";
import { explicitlyEnabled, validateRequest, protectRequest, readJsonBody, boundedTimeout } from "../api/_lib/ai-policy.js";

const response = () => ({ setHeader() {}, end(value) { this.body = JSON.parse(value); } });
const validRequest = () => ({ method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", authorization: `Bearer ${"x".repeat(32)}` }, body: {} });
async function sandbox(fn) {
  const previous = { ...process.env }, fetch = globalThis.fetch;
  Object.assign(process.env, { AI_ALLOWED_ORIGINS: "https://example.test", AI_PRIVATE_ACCESS_TOKEN: "x".repeat(32), AI_LIMIT_REDIS_REST_URL: "https://redis.example.test", AI_LIMIT_REDIS_REST_TOKEN: "synthetic", OPENAI_API_KEY: "synthetic" });
  try { await fn(); } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous); globalThis.fetch = fetch;
  }
}
test("both routes reject before body access or any network call, even with keys and flags", async () => sandbox(async () => {
  globalThis.fetch = () => { throw new Error("Network must not be reached"); };
  for (const value of [undefined, "", "false", "TRUE", "yes", "1", " true", "true ", "true"]) {
    assert.equal(explicitlyEnabled(value), value === "true");
    for (const key of ["AI_INSIGHTS_SERVER_ENABLED", "PAYSLIP_EXTRACT_SERVER_ENABLED"]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    for (const handler of [payslip, insights]) {
      const res = response();
      await handler({ method: "POST", get body() { throw new Error("Must not read body"); } }, res);
      assert.equal(res.statusCode, 503);
      assert.match(res.body.error, /unavailable/);
      assert.doesNotMatch(JSON.stringify(res.body), /API_KEY|TOKEN|redis|configuration/);
    }
  }
}));
test("future policy rejects origins, methods, content types, lengths and missing access", async () => sandbox(async () => {
  for (const origin of [undefined, "null", "https://evil.test", "https://example.test.evil.test", "http://example.test"]) {
    const req = validRequest(); req.headers.origin = origin;
    assert.throws(() => validateRequest(req, 100), { status: 403 });
  }
  const req = validRequest(); req.method = "PUT";
  assert.throws(() => validateRequest(req, 100), { status: 405 });
  req.method = "POST"; req.headers["content-type"] = "text/plain";
  assert.throws(() => validateRequest(req, 100), { status: 415 });
  req.headers["content-type"] = "application/json"; req.headers["content-length"] = "101";
  assert.throws(() => validateRequest(req, 100), { status: 413 });
  delete req.headers["content-length"]; delete req.headers.authorization;
  await assert.rejects(protectRequest(req, 100), { status: 401 });
  delete process.env.AI_PRIVATE_ACCESS_TOKEN;
  await assert.rejects(protectRequest(validRequest(), 100), { status: 503 });
}));
test("JSON validation bounds objects, strings and chunked multibyte uploads", async () => {
  for (const body of [null, [], "null", "[]", "{bad"]) await assert.rejects(readJsonBody({ body }, 100), { status: 400 });
  for (const body of [JSON.stringify({ data: "x".repeat(101) }), { data: "x".repeat(101) }]) await assert.rejects(readJsonBody({ body }, 100), { status: 413 });
  await assert.rejects(readJsonBody(Readable.from([Buffer.from("é".repeat(60))]), 100), { status: 413 });
  assert.deepEqual(await readJsonBody(Readable.from([Buffer.from('{"ok":'), Buffer.from('true}')]), 100), { ok: true });
});
test("atomic distributed budget exhausts across calls and fails closed on storage failure", async () => sandbox(async () => {
  let count = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://redis.example.test/");
    const command = JSON.parse(init.body);
    assert.equal(command[0], "EVAL"); assert.match(command[1], /INCR.*EXPIRE/);
    assert.ok(init.signal);
    return { ok: true, json: async () => ({ result: ++count }) };
  };
  for (let i = 0; i < 20; i++) await protectRequest(validRequest(), 100);
  await assert.rejects(protectRequest(validRequest(), 100), { status: 429 });
  globalThis.fetch = async () => { throw new Error("secret provider details"); };
  await assert.rejects(protectRequest(validRequest(), 100), { status: 503, message: /unavailable/ });
  delete process.env.AI_LIMIT_REDIS_REST_URL;
  await assert.rejects(protectRequest(validRequest(), 100), { status: 503 });
}));
test("coaching provider calls are bounded, non-storing and preserve valid output parsing", async () => sandbox(async () => {
  let count = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.store, false); assert.equal(body.max_tokens, 2000); assert.ok(init.signal);
    count++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ overallPosition: { summary: "Example" }, strengths: [{ title: "Example", explanation: "Example" }], summary: "Progress" }) } }] }) };
  };
  assert.equal((await callOpenAi({})).overallPosition.summary, "Example");
  assert.equal((await callOpenAiProgress({})).summary, "Progress");
  assert.equal(count, 2);
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: "secret" } }) });
  await assert.rejects(callOpenAi({}), error => !error.message.includes("secret"));
  assert.equal(boundedTimeout("Infinity"), 30000); assert.equal(boundedTimeout(-1), 1000);
}));
test("PDF cleanup runs after success, provider rejection and malformed output", async () => sandbox(async () => {
  for (const outcome of ["success", "failure", "malformed", "abort"]) {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init.method]); assert.ok(init.signal);
      if (url.endsWith("/files")) return { ok: true, json: async () => ({ id: "synthetic-file" }) };
      if (init.method === "DELETE") return { ok: true };
      assert.equal(JSON.parse(init.body).store, false);
      if (outcome === "abort") throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      return { ok: outcome !== "failure", status: 500, json: async () => ({ output_text: outcome === "malformed" ? "bad" : '{"grossPay":1000}' }) };
    };
    const run = () => extractWithOpenAi({ mimeType: "application/pdf", base64: "cGRm", filename: "payslip.pdf" });
    if (outcome === "success") assert.equal((await run()).grossPay, 1000); else await assert.rejects(run());
    assert.deepEqual(calls.at(-1), ["https://api.openai.com/v1/files/synthetic-file", "DELETE"]);
  }
}));
test("financial-year notices distinguish supported, partial and future rules without changing numbers", () => {
  const ctx = {}; vm.runInNewContext(readFileSync(new URL("../calculator.js", import.meta.url), "utf8"), ctx);
  const c = ctx.FFSCalculator;
  const notices = year => c.carriedForwardRuleNotices([c.resolveFinancialYearConfig(year)]).join(" ");
  assert.equal(notices("2026-27"), "");
  assert.match(notices("2027-28"), /2026-27 settings for Medicare levy, Medicare levy surcharge, study loan repayments, superannuation/);
  assert.doesNotMatch(notices("2027-28"), /income tax/);
  assert.match(notices("2030-31"), /2027-28 settings for income tax/);
  assert.match(notices("2030-31"), /2026-27 settings for Medicare/);
  const before = JSON.stringify(c.individualTaxBreakdown(100000, { financialYear: "2030-31" }));
  notices("2030-31");
  assert.equal(JSON.stringify(c.individualTaxBreakdown(100000, { financialYear: "2030-31" })), before);
});
