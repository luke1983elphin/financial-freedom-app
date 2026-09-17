import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { scanSecrets } from "./scan-secrets.mjs";

function createFixture(name) {
  return mkdtempSync(path.join(tmpdir(), `ffs-secret-scan-${name}-`));
}

function withFixture(name, callback) {
  const root = createFixture(name);
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

withFixture("clean", (root) => {
  writeFileSync(path.join(root, ".env.example"), "OPENAI_API_KEY=\nAI_INSIGHTS_SERVER_ENABLED=false\n");
  writeFileSync(path.join(root, "app.js"), "console.log('safe fixture');\n");
  const result = scanSecrets(root);
  assert.equal(result.findings.length, 0);
});

withFixture("dotenv", (root) => {
  writeFileSync(path.join(root, ".env"), "OPENAI_API_KEY=sk-" + "a".repeat(32) + "\n");
  const result = scanSecrets(root);
  assert.ok(result.findings.some((finding) => finding.pattern === "prohibited-credential-file" && finding.file === ".env"));
  assert.ok(result.findings.some((finding) => finding.pattern === "openai-api-key" && finding.file === ".env"));
});

withFixture("npmrc-key", (root) => {
  writeFileSync(path.join(root, ".npmrc"), "//registry.npmjs.org/:_authToken=fabricated-token-for-test-only\n");
  const privateKeyMarker = "-----BEGIN " + "PRIVATE KEY-----\nfake\n-----END " + "PRIVATE KEY-----\n";
  writeFileSync(path.join(root, "certificate.pem"), privateKeyMarker);
  const result = scanSecrets(root);
  assert.ok(result.findings.some((finding) => finding.pattern === "prohibited-credential-file" && finding.file === ".npmrc"));
  assert.ok(result.findings.some((finding) => finding.pattern === "prohibited-credential-file" && finding.file === "certificate.pem"));
  assert.ok(result.findings.some((finding) => finding.pattern === "private-key" && finding.file === "certificate.pem"));
});

console.log("[SECRET SCAN SELF-TEST PASSED]");
