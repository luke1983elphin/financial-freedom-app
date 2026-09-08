import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ignoredDirs = new Set([
  ".git",
  ".cache",
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

export const includedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);

export const allowedCredentialExamples = new Set([
  ".env.example",
]);

export const prohibitedCredentialNames = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".npmrc",
  ".netrc",
]);

export const prohibitedCredentialExtensions = new Set([
  ".key",
  ".pem",
  ".p12",
  ".pfx",
]);

export const patterns = [
  { id: "openai-api-key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g },
  { id: "aws-access-key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { id: "vercel-token", regex: /\bvercel_[A-Za-z0-9]{24,}\b/g },
  { id: "generic-bearer-token", regex: /\bBearer\s+[A-Za-z0-9._-]{40,}\b/g },
];

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || "";
}

function isProhibitedCredentialFile(entry) {
  const lower = entry.toLowerCase();
  return lower.startsWith(".env.")
    || prohibitedCredentialNames.has(lower)
    || prohibitedCredentialExtensions.has(path.extname(lower));
}

function shouldScanFile(entry) {
  return includedExtensions.has(path.extname(entry).toLowerCase())
    || allowedCredentialExamples.has(entry)
    || isProhibitedCredentialFile(entry);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredDirs.has(entry)) return [];
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!shouldScanFile(entry)) return [];
    return [full];
  });
}

export function scanSecrets(root = process.cwd()) {
  const files = walk(root);
  const findings = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const name = path.basename(file);
    if (isProhibitedCredentialFile(name) && !allowedCredentialExamples.has(name)) {
      findings.push({ pattern: "prohibited-credential-file", file: rel, line: 1 });
    }
    const text = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern.regex)) {
        const before = text.slice(0, match.index);
        const line = before.split(/\r?\n/).length;
        findings.push({ pattern: pattern.id, file: rel, line });
      }
    }
  }
  return { files, findings };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const root = path.resolve(readOption("--root") || process.cwd());
  const { files, findings } = scanSecrets(root);
  if (findings.length) {
    console.error("[SECRET SCAN FAILED]");
    console.error(JSON.stringify(findings, null, 2));
    process.exit(1);
  }

  console.log("[SECRET SCAN PASSED]");
  console.log(JSON.stringify({
    scannedRoot: root,
    scannedFiles: files.length,
    ignoredDirectories: [...ignoredDirs].sort(),
    findings: 0,
  }, null, 2));
}
