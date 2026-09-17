import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const CANONICAL_TEST_DIR = "tests";

export const IGNORED_DISCOVERY_DIRS = new Set([
  ".cache",
  ".git",
  ".github",
  ".next",
  ".pnpm-store",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "outputs",
  "playwright-report",
  "private-assurance",
  "test-results",
]);

export function normalisePath(file) {
  return file.split(path.sep).join("/");
}

function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (IGNORED_DISCOVERY_DIRS.has(entry)) return [];
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walkFiles(full);
    return [full];
  });
}

export function discoverActiveTestFiles(root) {
  return walkFiles(root)
    .filter((file) => /\.test\.(mjs|ts)$/.test(file))
    .map((file) => normalisePath(path.relative(root, file)))
    .sort();
}

export function validateTestInventory(allSuites, { root, skipDiscovery = false } = {}) {
  const seenIds = new Set();
  const seenFiles = new Map();
  const failures = [];

  for (const suite of allSuites) {
    if (!suite.id) failures.push("A suite is missing an id.");
    if (!suite.file) failures.push(`Suite ${suite.id || "(unknown)"} is missing a file.`);
    if (seenIds.has(suite.id)) failures.push(`Duplicate suite id: ${suite.id}`);
    seenIds.add(suite.id);

    const rel = normalisePath(suite.file || "");
    if (seenFiles.has(rel)) failures.push(`Duplicate suite file: ${rel}`);
    seenFiles.set(rel, suite.id);

    const resolved = path.resolve(root, suite.file || "");
    if (!existsSync(resolved)) failures.push(`Expected suite file is missing: ${rel}`);
  }

  const discovered = skipDiscovery ? [] : discoverActiveTestFiles(root);
  if (!skipDiscovery) {
    const expected = new Set(allSuites.map((suite) => normalisePath(suite.file)));
    for (const file of discovered) {
      if (!file.startsWith(`${CANONICAL_TEST_DIR}/`)) {
        failures.push(`Misplaced active test outside ${CANONICAL_TEST_DIR}/: ${file}`);
      } else if (!expected.has(file)) {
        failures.push(`Discovered active test is not registered: ${file}`);
      }
    }

    for (const suite of allSuites) {
      const rel = normalisePath(suite.file);
      if (rel.startsWith(`${CANONICAL_TEST_DIR}/`) && !discovered.includes(rel)) {
        failures.push(`Registered test was not discovered: ${rel}`);
      }
    }

    if (!discovered.length) failures.push("No active test files discovered.");
  }

  return {
    failures,
    discovered,
    registered: allSuites.map((suite) => ({
      id: suite.id,
      file: normalisePath(suite.file || ""),
      groups: suite.groups || [],
    })),
  };
}
