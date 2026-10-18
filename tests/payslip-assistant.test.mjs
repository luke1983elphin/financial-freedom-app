import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import payslipExtractHandler from "../api/payslip-extract.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../api/payslip-extract.js", import.meta.url), "utf8");

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = String(value || ""); },
  };
}

test("salary card keeps packaging optional and compact", () => {
  assert.match(appSource, /I use salary sacrifice or salary packaging/);
  assert.match(appSource, /salary-package-row/);
  assert.match(appSource, /Employer super stays based on gross qualifying earnings/);
  assert.match(cssSource, /\.salary-package-controls/);
  assert.match(cssSource, /\.salary-take-home-summary\.has-sacrifice/);
});

test("salary card exposes optional payslip assistant with confirmation step", () => {
  assert.match(appSource, /Use a recent payslip/);
  assert.match(appSource, /Nothing changes until you confirm/);
  assert.match(appSource, /data-payslip-confirm/);
  assert.match(appSource, /applyPayslipToSalary/);
  assert.match(appSource, /STSL withholding/);
});

test("payslip endpoint is POST-only", async () => {
  const res = mockResponse();
  await payslipExtractHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).error, "Method not allowed.");
});

test("payslip endpoint does not operate without server API configuration", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = mockResponse();
    await payslipExtractHandler({ method: "POST", body: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.match(JSON.parse(res.body).error, /currently unavailable/i);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("payslip extraction is requests non-storage and excludes identifiers from output (not input redaction)", () => {
  assert.match(apiSource, /store:\s*false/);
  assert.match(apiSource, /Do not include names, addresses, employer identifiers, bank details, tax file numbers/);
  assert.match(apiSource, /current pay-period amounts/);
});


test("payslip assistant supports drag and drop as well as browsing", () => {
  assert.match(appSource, /data-payslip-dropzone/);
  assert.match(appSource, /Drag & drop payslip here/);
  assert.match(appSource, /document\.addEventListener\("dragover"/);
  assert.match(appSource, /document\.addEventListener\("drop"/);
  assert.match(cssSource, /\.payslip-dropzone\.is-dragging/);
});

test("PDF payslips use temporary file upload and cleanup", () => {
  assert.match(apiSource, /purpose", "user_data"/);
  assert.match(apiSource, /input_file", file_id:/);
  assert.match(apiSource, /deleteTemporaryFile/);
  assert.doesNotMatch(apiSource, /input_file", filename, file_data:/);
});
