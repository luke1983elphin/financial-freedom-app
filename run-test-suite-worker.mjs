import { existsSync } from "node:fs";
import path from "node:path";
import { run } from "node:test";
import { parentPort, workerData } from "node:worker_threads";

const { root, suite } = workerData;
const resolved = path.resolve(root, suite.file);

function safeMessage(error) {
  return error?.message || error?.code || String(error);
}

function post(payload) {
  parentPort.postMessage(payload);
}

if (!existsSync(resolved)) {
  post({
    type: "suite-complete",
    summary: {
      id: suite.id,
      file: suite.file,
      passed: 0,
      failed: 1,
      skipped: 0,
      todo: 0,
      cancelled: 0,
      total: 1,
      completed: false,
      errors: [`Expected suite file is missing: ${suite.file}`],
    },
  });
} else {
  const counts = {
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,
    cancelled: 0,
  };
  const failures = [];
  const started = new Set();
  const completed = new Set();

  try {
    const stream = run({
      files: [resolved],
      isolation: "none",
      concurrency: false,
    });

    stream.on("data", (event) => {
      const name = event?.data?.name || "(unnamed test)";
      const isFileWrapper = path.resolve(String(name)) === resolved;
      switch (event.type) {
        case "test:start":
          if (!isFileWrapper) started.add(name);
          break;
        case "test:pass":
          if (isFileWrapper) break;
          if (event?.data?.skip) counts.skipped += 1;
          else if (event?.data?.todo) counts.todo += 1;
          else counts.passed += 1;
          break;
        case "test:fail":
          counts.failed += 1;
          failures.push(`${name}: ${safeMessage(event?.data?.details?.error)}`);
          break;
        case "test:skip":
          counts.skipped += 1;
          break;
        case "test:todo":
          counts.todo += 1;
          break;
        case "test:cancel":
        case "test:cancelled":
          counts.cancelled += 1;
          break;
        case "test:complete":
          if (!isFileWrapper) completed.add(name);
          break;
        default:
          break;
      }
    });

    stream.on("error", (error) => {
      counts.failed += 1;
      failures.push(safeMessage(error));
    });

    stream.on("end", () => {
      const total = counts.passed + counts.failed + counts.skipped + counts.todo + counts.cancelled;
      const suiteFailures = [...failures];
      if (total === 0) {
        suiteFailures.push("Suite completed with zero executed tests.");
      }
      if (counts.skipped > 0 || counts.todo > 0 || counts.cancelled > 0) {
        suiteFailures.push(`Suite reported ${counts.skipped} skipped, ${counts.todo} todo and ${counts.cancelled} cancelled tests. R2 verification policy requires zero skipped/todo/cancelled tests unless a future suite-specific approval mechanism is explicitly documented.`);
      }
      if (total > 0 && counts.passed === 0 && counts.failed === 0) {
        suiteFailures.push("Suite completed with only skipped/todo/cancelled tests; this is not complete coverage.");
      }
      post({
        type: "suite-complete",
        summary: {
          id: suite.id,
          file: suite.file,
          ...counts,
          total,
          started: started.size,
          completedTests: completed.size,
          completed: true,
          errors: suiteFailures,
        },
      });
    });
  } catch (error) {
    post({
      type: "suite-complete",
      summary: {
        id: suite.id,
        file: suite.file,
        passed: 0,
        failed: 1,
        skipped: 0,
        todo: 0,
        cancelled: 0,
        total: 1,
        completed: false,
        errors: [safeMessage(error)],
      },
    });
  }
}
