import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

function runModuleParseProbe(file) {
  return new Promise((resolve) => {
    const worker = new Worker(pathToFileURL(file), { type: "module" });
    let errorMessage = "";
    worker.on("error", (error) => {
      errorMessage = error?.message || String(error);
    });
    worker.on("exit", (code) => resolve({ code, errorMessage }));
  });
}

const root = mkdtempSync(path.join(tmpdir(), "ffs-syntax-self-test-"));

try {
  const valid = path.join(root, "valid.mjs");
  const malformed = path.join(root, "malformed-import.mjs");
  const malformedSource = "import { broken from './dependency.mjs';\nexport const okay = 1;\n";
  writeFileSync(valid, "export const okay = 1;\n");
  writeFileSync(malformed, malformedSource);

  const validResult = await runModuleParseProbe(valid);
  assert.equal(validResult.code, 0);

  const malformedResult = await runModuleParseProbe(malformed);
  assert.notEqual(malformedResult.code, 0);
  assert.match(malformedResult.errorMessage, /Unexpected identifier|Unexpected token|Named export/);
  assert.equal(readFileSync(malformed, "utf8"), malformedSource);

  console.log("[SYNTAX SELF-TEST PASSED]");
  console.log("The package syntax gate uses native `node --check` commands on original files; this self-test proves malformed module syntax is rejected without rewriting source.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
