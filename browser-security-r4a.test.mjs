import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

function loadSecurity() {
  const context = { console, URL, TextEncoder };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("security.js"), context, { filename: "security.js" });
  return context.FFSSecurity;
}

const SECURITY = loadSecurity();
const attacks = [
  '<svg onload=alert(1)>',
  '<img src=x onerror=alert(1)>',
  '\"><script>alert(1)</script>',
  'javascript:alert(1)',
  '</textarea><script>alert(1)</script>',
  '\"><iframe srcdoc="<script>alert(1)</script>">',
  '& < > " \'',
  `Long ${"x".repeat(2000)}`,
  'Unicode café 中文 😀',
  '\u202Etxt.exe',
  'line one\nline two\u0007',
];

test("R4A-A/B/O runtime HTML uses only local scripts and local utility CSS", () => {
  const html = read("index.html");
  assert.equal(SECURITY.auditRuntimeHtml(html, []).externalScripts.length, 0);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/i);
  assert.match(html, /href="tailwind-static\.css"/);
  assert.match(html, /src="security\.js"/);
});

test("R4A security self-test detects Tailwind CDN and unexpected script hosts", () => {
  assert.throws(() => SECURITY.auditRuntimeHtml('<script src="https://cdn.tailwindcss.com"></script>'), /Tailwind/);
  assert.throws(() => SECURITY.auditRuntimeHtml('<script src="https://evil.example/app.js"></script>'), /Unexpected/);
});

test("R4A-D/E user-controlled text is context escaped and remains inert markup", () => {
  for (const attack of attacks) {
    const escaped = SECURITY.escapeHtml(attack);
    assert.doesNotMatch(escaped, /<(?:script|svg|img|iframe|textarea)\b/i);
    assert.doesNotMatch(escaped, /<|>/);
  }
  assert.equal(SECURITY.escapeHtml('& < > " \''), "&amp; &lt; &gt; &quot; &#39;");
});

test("R4A-F URL validation rejects executable schemes", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "//evil.example/path"]) {
    assert.equal(SECURITY.safeUrl(value), null);
  }
  assert.equal(SECURITY.safeUrl("https://example.com/help"), "https://example.com/help");
  assert.equal(SECURITY.safeUrl("/reports"), "/reports");
});

test("R4A-G prototype-pollution keys are rejected without mutating prototypes", () => {
  delete Object.prototype.r4aPolluted;
  const malicious = '{"plan":{"__proto__":{"r4aPolluted":true}}}';
  assert.throws(() => SECURITY.parseJsonImport(malicious), /prohibited key/);
  assert.equal(Object.prototype.r4aPolluted, undefined);
  for (const key of ["constructor", "prototype"]) {
    assert.throws(() => SECURITY.parseJsonImport(`{"${key}":{}}`), /prohibited key/);
  }
});

test("R4A-H invalid imports are rejected before existing state can be replaced", () => {
  const currentPlan = Object.freeze({ id: "existing-good-plan", amount: 42 });
  let activePlan = currentPlan;
  try {
    SECURITY.parseJsonImport("{invalid");
    activePlan = { id: "should-not-run" };
  } catch (error) {
    assert.match(error.message, /valid JSON/);
  }
  assert.equal(activePlan, currentPlan);
});

test("R4A-I oversized and deeply nested imports fail clearly", () => {
  assert.throws(() => SECURITY.parseJsonImport(`{"value":"${"x".repeat(2048)}"}`, { maxBytes: 1024 }), /too large/);
  let nested = "0";
  for (let index = 0; index < 45; index += 1) nested = `{"x":${nested}}`;
  assert.throws(() => SECURITY.parseJsonImport(nested, { maxDepth: 40 }), /deeply/);
});

test("R4A import validation rejects unsupported versions, extreme numbers and invalid dates", () => {
  assert.throws(() => SECURITY.assertSupportedVersion(2, { maximum: 1 }), /not supported/);
  assert.throws(() => SECURITY.parseJsonImport('{"amount":1e20}'), /invalid numeric/);
  assert.throws(() => SECURITY.assertValidIsoDate("not-a-date", "Export date"), /invalid/);
});

test("R4A-N normal plan JSON round trip preserves ordinary data", () => {
  const payload = { type: "financial-freedom-plan-export", schemaVersion: 1, plan: { personal: { person1Name: "Fictional User" }, assets: { cash: 12345 } }, scenarios: [] };
  assert.deepEqual(JSON.parse(JSON.stringify(SECURITY.parseJsonImport(JSON.stringify(payload)))), payload);
});

test("R4A filename sanitisation prevents traversal, controls and executable extensions", () => {
  assert.equal(SECURITY.safeFilename("../../Plan\u0000<script>", "json"), "Plan-script.json");
  assert.throws(() => SECURITY.safeFilename("Plan", "exe"), /Unsupported/);
  assert.ok(SECURITY.safeFilename("x".repeat(500), "pdf").length <= 84);
});

test("R4A-K CSP and response headers include the critical protections", () => {
  const config = JSON.parse(read("vercel.json"));
  const headers = new Map(config.headers[0].headers.map((item) => [item.key.toLowerCase(), item.value]));
  assert.doesNotThrow(() => SECURITY.validateCsp(headers.get("content-security-policy-report-only")));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
});

test("R4A CSP self-test rejects missing critical directives and unsafe-eval", () => {
  assert.throws(() => SECURITY.validateCsp("default-src 'self'; script-src 'self'; style-src 'self'"), /missing/);
  assert.throws(() => SECURITY.validateCsp("default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"), /unsafe-eval/);
});

test("R4A-C finite local utility asset contains representative responsive and dynamic classes", () => {
  const css = read("tailwind-static.css");
  for (const selector of [".hidden", ".bg-white\\/90", ".sm\\:text-6xl", ".lg\\:grid-cols-\\[250px_1fr\\]", ".xl\\:grid-cols-3"]) {
    assert.ok(css.includes(selector), `Missing ${selector}`);
  }
});

test("R4A-J report-facing attack strings have no active tags after HTML escaping", () => {
  const report = attacks.map((value) => `<h3>${SECURITY.escapeHtml(value)}</h3>`).join("");
  assert.doesNotMatch(report, /<(?:script|svg|img|iframe|textarea)\b/i);
  assert.equal((report.match(/<h3>/g) || []).length, attacks.length);
});

test("R4A file-size boundary accepts a realistic maximum and rejects the next byte", () => {
  const text = JSON.stringify({ value: "x".repeat(4096) });
  const exact = SECURITY.byteLength(text);
  assert.doesNotThrow(() => SECURITY.parseJsonImport(text, { maxBytes: exact }));
  assert.throws(() => SECURITY.parseJsonImport(text, { maxBytes: exact - 1 }), /too large/);
});
