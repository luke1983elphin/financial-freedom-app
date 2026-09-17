import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const runnerPath = fileURLToPath(new URL("./run-tests.mjs", import.meta.url));

function createTempHarness(name) {
  const dir = path.join(tmpdir(), `ffs-runner-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runHarness(root, suites, options = {}) {
  const manifest = path.join(root, "suites.json");
  writeFileSync(manifest, JSON.stringify({ suites }, null, 2));
  return new Promise((resolve, reject) => {
    const argv = ["--manifest", manifest, "--root", root, "--timeout-ms", String(options.timeoutMs || 2000)];
    if (options.skipDiscovery !== false) argv.push("--skip-discovery");
    const worker = new Worker(runnerPath, {
      argv,
      stdout: true,
      stderr: true,
    });
    let stdout = "";
    let stderr = "";
    worker.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    worker.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const timeout = setTimeout(async () => {
      await worker.terminate();
      reject(new Error("Self-test runner harness timed out."));
    }, options.harnessTimeoutMs || 8000);
    worker.on("error", reject);
    worker.on("exit", (code) => resolve({ code, stdout, stderr }));
    worker.on("exit", () => clearTimeout(timeout));
  });
}

test("R2 runner propagates assertion failure and still executes a later independent suite", async () => {
  const root = createTempHarness("failure-propagation");
  const marker = path.join(root, "later-marker.txt");
  try {
    writeFileSync(path.join(root, "failing.test.mjs"), "import test from 'node:test'; import assert from 'node:assert/strict'; test('intentional fail', () => assert.equal(1, 2));\n");
    writeFileSync(path.join(root, "later.test.mjs"), `import test from 'node:test'; import assert from 'node:assert/strict'; import { writeFileSync } from 'node:fs'; test('later suite still runs', () => { writeFileSync(${JSON.stringify(marker)}, 'executed'); assert.equal(2, 2); });\n`);
    const result = await runHarness(root, [
      { id: "intentional-failing-suite", file: "failing.test.mjs" },
      { id: "later-independent-suite", file: "later.test.mjs" },
    ]);
    assert.notEqual(result.code, 0);
    assert.match(result.stdout, /intentional-failing-suite/);
    assert.match(result.stdout, /later-independent-suite/);
    assert.equal(existsSync(marker), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails a passing suite when the Worker exits non-zero and still executes a later suite", async () => {
  const root = createTempHarness("nonzero-worker-exit");
  const marker = path.join(root, "after-nonzero-exit-marker.txt");
  try {
    writeFileSync(path.join(root, "exit-code.test.mjs"), "import test from 'node:test'; test('passing', () => {}); process.exitCode = 7;\n");
    writeFileSync(path.join(root, "later.test.mjs"), `import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('later suite still runs after non-zero worker exit', () => writeFileSync(${JSON.stringify(marker)}, 'executed'));\n`);
    const result = await runHarness(root, [
      { id: "nonzero-worker-exit", file: "exit-code.test.mjs" },
      { id: "after-nonzero-worker-exit", file: "later.test.mjs" },
    ]);
    assert.notEqual(result.code, 0);
    assert.equal(existsSync(marker), true);
    assert.match(`${result.stdout}\n${result.stderr}`, /non-zero exit code 7/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails a passing suite when the Worker exits after an unhandled rejection and still executes a later suite", async () => {
  const root = createTempHarness("unhandled-rejection");
  const marker = path.join(root, "after-unhandled-rejection-marker.txt");
  try {
    writeFileSync(path.join(root, "unhandled.test.mjs"), "import test from 'node:test'; test('passing', () => { Promise.reject(new Error('deliberate unhandled rejection')); });\n");
    writeFileSync(path.join(root, "later.test.mjs"), `import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('later suite still runs after unhandled rejection', () => writeFileSync(${JSON.stringify(marker)}, 'executed'));\n`);
    const result = await runHarness(root, [
      { id: "unhandled-rejection", file: "unhandled.test.mjs" },
      { id: "after-unhandled-rejection", file: "later.test.mjs" },
    ]);
    assert.notEqual(result.code, 0);
    assert.equal(existsSync(marker), true);
    assert.match(`${result.stdout}\n${result.stderr}`, /deliberate unhandled rejection|non-zero exit code 1|asynchronous activity/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails when an expected suite file is missing", async () => {
  const root = createTempHarness("missing-suite");
  try {
    const result = await runHarness(root, [{ id: "missing-suite", file: "missing.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Expected suite file is missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails when a test import is broken", async () => {
  const root = createTempHarness("broken-import");
  try {
    writeFileSync(path.join(root, "broken.test.mjs"), "import './does-not-exist.mjs';\nimport test from 'node:test';\ntest('unreachable', () => {});\n");
    const result = await runHarness(root, [{ id: "broken-import", file: "broken.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Cannot find module|ERR_MODULE_NOT_FOUND/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails when a suite declares no tests", async () => {
  const root = createTempHarness("zero-tests");
  try {
    writeFileSync(path.join(root, "empty.test.mjs"), "export const value = 1;\n");
    const result = await runHarness(root, [{ id: "zero-tests", file: "empty.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /zero executed tests/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails when test declarations are not actually registered", async () => {
  const root = createTempHarness("false-registered-test");
  try {
    writeFileSync(path.join(root, "hidden.test.mjs"), "import test from 'node:test'; if (false) test('never registered', () => {});\n");
    const result = await runHarness(root, [{ id: "hidden-test", file: "hidden.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /zero executed tests/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner treats premature suite exit as incomplete and continues later suites", async () => {
  const root = createTempHarness("premature-exit");
  const marker = path.join(root, "after-exit-marker.txt");
  try {
    writeFileSync(path.join(root, "exit.test.mjs"), "process.exit(0);\n");
    writeFileSync(path.join(root, "later.test.mjs"), `import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('later suite still executes after premature exit', () => writeFileSync(${JSON.stringify(marker)}, 'executed'));\n`);
    const result = await runHarness(root, [
      { id: "premature-exit", file: "exit.test.mjs" },
      { id: "after-exit", file: "later.test.mjs" },
    ]);
    assert.notEqual(result.code, 0);
    assert.equal(existsSync(marker), true);
    assert.match(result.stderr, /exited before reporting completion/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner times out an event-loop-blocking suite from the parent", async () => {
  const root = createTempHarness("blocking-suite");
  const marker = path.join(root, "after-timeout-marker.txt");
  try {
    writeFileSync(path.join(root, "blocking.test.mjs"), "import test from 'node:test'; test('blocks forever', () => { while (true) {} });\n");
    writeFileSync(path.join(root, "later.test.mjs"), `import test from 'node:test'; import { writeFileSync } from 'node:fs'; test('later suite executes after timeout', () => writeFileSync(${JSON.stringify(marker)}, 'executed'));\n`);
    const result = await runHarness(root, [
      { id: "blocking-suite", file: "blocking.test.mjs", timeoutMs: 200 },
      { id: "after-timeout", file: "later.test.mjs", timeoutMs: 2000 },
    ], { timeoutMs: 200, harnessTimeoutMs: 5000 });
    assert.notEqual(result.code, 0);
    assert.equal(existsSync(marker), true);
    assert.match(result.stderr, /parent-controlled timeout/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails all-skipped suites as incomplete coverage", async () => {
  const root = createTempHarness("all-skipped");
  try {
    writeFileSync(path.join(root, "skipped.test.mjs"), "import test from 'node:test'; test('skipped by policy', { skip: true }, () => {});\n");
    const result = await runHarness(root, [{ id: "all-skipped", file: "skipped.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /only skipped\/todo\/cancelled tests/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 runner fails a mixed passing and skipped suite under the default no-skip policy", async () => {
  const root = createTempHarness("mixed-skipped");
  try {
    writeFileSync(path.join(root, "mixed.test.mjs"), "import test from 'node:test'; test('passing coverage', () => {}); test('skipped required coverage', { skip: true }, () => {});\n");
    const result = await runHarness(root, [{ id: "mixed-skipped", file: "mixed.test.mjs" }]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /requires zero skipped\/todo\/cancelled tests/);
    assert.match(result.stdout, /1 passed, 0 failed, 1 skipped, 0 todo, 0 cancelled/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 inventory rejects misplaced, unregistered, missing and duplicate tests", async () => {
  const root = createTempHarness("inventory");
  try {
    mkdirSync(path.join(root, "tests"), { recursive: true });
    writeFileSync(path.join(root, "tests", "registered.test.mjs"), "import test from 'node:test'; test('registered', () => {});\n");
    writeFileSync(path.join(root, "tests", "unregistered.test.mjs"), "import test from 'node:test'; test('unregistered', () => {});\n");
    writeFileSync(path.join(root, "accidentally-root.test.mjs"), "import test from 'node:test'; test('misplaced root test', () => {});\n");
    const result = await runHarness(root, [
      { id: "registered", file: "tests/registered.test.mjs" },
      { id: "duplicate-id", file: "tests/registered.test.mjs" },
      { id: "duplicate-id", file: "tests/missing.test.mjs" },
    ], { skipDiscovery: false });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Misplaced active test outside tests\//);
    assert.match(result.stderr, /Discovered active test is not registered: tests\/unregistered\.test\.mjs/);
    assert.match(result.stderr, /Expected suite file is missing: tests\/missing\.test\.mjs/);
    assert.match(result.stderr, /Duplicate suite id: duplicate-id/);
    assert.match(result.stderr, /Duplicate suite file: tests\/registered\.test\.mjs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
