import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { ACTIVE_TEST_SUITES, DEFAULT_SUITE_TIMEOUT_MS } from "./test-suites.mjs";
import { normalisePath, validateTestInventory } from "./test-inventory.mjs";

const args = process.argv.slice(2);

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || "";
}

function readOptions(name) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === name && args[index + 1]) values.push(args[index + 1]);
  });
  return values;
}

const root = path.resolve(readOption("--root") || process.cwd());
const suiteFilters = readOptions("--suite");
const groupFilters = readOptions("--group");
const manifestPath = readOption("--manifest");
const skipDiscovery = args.includes("--skip-discovery");
const timeoutMs = Number(readOption("--timeout-ms") || process.env.FFS_TEST_TIMEOUT_MS || DEFAULT_SUITE_TIMEOUT_MS);
const workerPath = new URL("./run-test-suite-worker.mjs", import.meta.url);

async function loadSuites() {
  if (!manifestPath) return ACTIVE_TEST_SUITES;
  const resolved = path.resolve(root, manifestPath);
  if (!existsSync(resolved)) throw new Error(`Test manifest not found: ${resolved}`);
  if (resolved.endsWith(".json")) return JSON.parse(readFileSync(resolved, "utf8")).suites || [];
  const module = await import(pathToFileURL(resolved).href);
  return module.ACTIVE_TEST_SUITES || module.default || [];
}

function selectedSuites(allSuites) {
  let selected = allSuites;
  if (groupFilters.length) {
    const groups = new Set(groupFilters);
    selected = selected.filter((suite) => (suite.groups || []).some((group) => groups.has(group)));
  }
  if (suiteFilters.length) {
    const ids = new Set(suiteFilters);
    selected = selected.filter((suite) => ids.has(suite.id));
    for (const id of ids) {
      if (!allSuites.some((suite) => suite.id === id)) throw new Error(`Unknown suite id: ${id}`);
    }
  }
  if (!selected.length) throw new Error("No test suites selected.");
  return selected;
}

function runSuite(suite) {
  const timeoutForSuite = Number(suite.timeoutMs || timeoutMs);
  const nodeArgs = Array.isArray(suite.nodeArgs) ? suite.nodeArgs : [];
  return new Promise((resolve) => {
    const worker = new Worker(workerPath, {
      workerData: { root, suite },
      stdout: true,
      stderr: true,
      execArgv: nodeArgs,
    });
    let stdout = "";
    let stderr = "";
    let completion = null;
    let settled = false;
    let didTimeout = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeout = setTimeout(async () => {
      didTimeout = true;
      await worker.terminate();
      finish({
        id: suite.id,
        file: normalisePath(suite.file),
        passed: 0,
        failed: 1,
        skipped: 0,
        todo: 0,
        cancelled: 0,
        total: 1,
        started: 0,
        completedTests: 0,
        completed: false,
        timedOut: true,
        stdout,
        stderr,
        errors: [`Suite exceeded parent-controlled timeout of ${timeoutForSuite}ms.`],
      });
    }, timeoutForSuite);

    worker.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    worker.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    worker.on("message", (message) => {
      if (message?.type === "suite-complete") completion = message.summary;
    });
    worker.on("error", (error) => {
      completion = {
        id: suite.id,
        file: normalisePath(suite.file),
        passed: 0,
        failed: 1,
        skipped: 0,
        todo: 0,
        cancelled: 0,
        total: 1,
        started: 0,
        completedTests: 0,
        completed: false,
        errors: [error?.message || String(error)],
      };
    });
    worker.on("exit", (code) => {
      clearTimeout(timeout);
      if (didTimeout) return;
      if (!completion) {
        completion = {
          id: suite.id,
          file: normalisePath(suite.file),
          passed: 0,
          failed: 1,
          skipped: 0,
          todo: 0,
          cancelled: 0,
          total: 1,
          started: 0,
          completedTests: 0,
          completed: false,
          errors: [`Suite worker exited before reporting completion (exit code ${code}).`],
        };
      }
      finish({
        ...completion,
        file: normalisePath(completion.file || suite.file),
        stdout,
        stderr,
        workerExitCode: code,
        processErrors: code === 0 ? [] : [
          [
            `Suite worker exited with non-zero exit code ${code}.`,
            stderr.trim() ? `Worker stderr: ${stderr.trim().slice(0, 4000)}` : "",
          ].filter(Boolean).join(" "),
        ],
        timedOut: false,
      });
    });
  });
}

try {
  const allSuites = await loadSuites();
  const inventory = validateTestInventory(allSuites, { root, skipDiscovery });
  const inventoryFailures = inventory.failures;
  if (inventoryFailures.length) {
    console.error("\n[INVENTORY FAILED]");
    inventoryFailures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  const suites = selectedSuites(allSuites);
  const results = [];
  console.log(`[TEST RUNNER] Executing ${suites.length} suite(s) from ${root}`);
  for (const suite of suites) {
    const file = normalisePath(suite.file);
    console.log(`[SUITE START] ${suite.id} -> ${file}`);
    const result = await runSuite(suite);
    results.push(result);
    const suiteErrors = [...(result.errors || []), ...(result.processErrors || [])];
    const status = result.failed > 0 || suiteErrors.length || result.workerExitCode !== 0 ? "FAIL" : "PASS";
    console.log(`[SUITE ${status}] ${suite.id}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped, ${result.todo} todo, ${result.cancelled} cancelled`);
    for (const error of suiteErrors) console.error(`[SUITE ERROR] ${suite.id}: ${error}`);
  }
  const totals = results.reduce((sum, result) => ({
    passed: sum.passed + result.passed,
    failed: sum.failed + result.failed,
    skipped: sum.skipped + result.skipped,
    todo: sum.todo + result.todo,
    cancelled: sum.cancelled + result.cancelled,
    total: sum.total + result.total,
  }), { passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0, total: 0 });
  const incomplete = results.filter((result) => !result.completed || result.timedOut || result.errors?.length || result.processErrors?.length || result.workerExitCode !== 0);
  console.log("[TEST RUNNER SUMMARY]");
  console.log(JSON.stringify({
    selectedSuites: suites.length,
    completedSuites: results.length - incomplete.length,
    failedSuites: results.filter((result) => result.failed > 0 || result.errors?.length || result.processErrors?.length || result.workerExitCode !== 0).map(({ id, file, errors, processErrors, workerExitCode }) => ({ id, file, errors, processErrors, workerExitCode })),
    totals,
    suiteResults: results.map(({ id, file, passed, failed, skipped, todo, cancelled, total, completed, timedOut, errors, processErrors, workerExitCode }) => ({
      id,
      file,
      passed,
      failed,
      skipped,
      todo,
      cancelled,
      total,
      completed,
      timedOut,
      workerExitCode,
      errors,
      processErrors,
    })),
    timeoutMs,
    note: "Each suite runs in an isolated Worker using Node's test runner with isolation disabled inside that Worker. The parent verifies per-suite completion and enforces timeouts.",
  }, null, 2));
  if (totals.failed > 0 || incomplete.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(`[RUNNER ERROR] ${error.message}`);
  process.exit(1);
}
