import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

function loadStorageApi() {
  const context = { console, setTimeout };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("storage.js"), context, { filename: "storage.js" });
  return context.FFSStorage;
}

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); this.failOnSet = null; }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.failOnSet?.(key, value)) throw this.failOnSet.error || new Error("setItem failed");
    this.map.set(key, String(value));
  }
  removeItem(key) { this.map.delete(key); }
}

const API = loadStorageApi();

function createDocumentStub() {
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const elements = new Map();
  const createElement = () => ({
    classList, dataset: {}, style: {}, value: "", textContent: "", innerHTML: "",
    addEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    replaceChildren(...children) { this.children = children; }, insertAdjacentElement() {},
    scrollIntoView() {}, focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  });
  return {
    body: { classList }, documentElement: { classList }, addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement,
  };
}

function loadAppBackupHooks({ withStorageCoordinator = true, initialStorage = {} } = {}) {
  const document = createDocumentStub();
  const context = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    localStorage: new MemoryStorage(initialStorage), document,
    navigator: { userAgent: "node-test" }, location: { pathname: "/", search: "", hash: "" },
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    Blob: class Blob {}, FileReader: class FileReader {}, setTimeout() { return 0; }, clearTimeout() {},
    requestAnimationFrame(callback) { return typeof callback === "function" ? callback() : 0; },
    confirm() { return true; }, prompt() { return ""; }, alert() {}, innerWidth: 1200,
    FFS_DATA: { samplePlans: [], disclaimer: "" }, FFS_TEST_HOOKS_ENABLED: true,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const files = ["security.js", ...(withStorageCoordinator ? ["storage.js"] : []), "calculator.js", "weekly-plan.js", "semiRetirementUi.js", "app.js"];
  for (const file of files) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return { context, document, hooks: context.FFSWeeklyPlanUiTestHooks, CALC: context.FFSCalculator, WEEKLY: context.FFSWeeklyPlan };
}

test("R5-A successful durable JSON save is verified and readable", () => {
  const backend = new MemoryStorage();
  const storage = API.createStorageCoordinator(backend);
  assert.equal(storage.writeJson("ffs-user-state-v3-mobile-dashboard-ux-test", { saved: true }).ok, true);
  assert.deepEqual(JSON.parse(backend.getItem("ffs-user-state-v3-mobile-dashboard-ux-test")), { saved: true });
});

test("R5-B failed setItem returns failure and a safe message", () => {
  const backend = new MemoryStorage();
  const failure = () => true;
  failure.error = new Error("denied");
  backend.failOnSet = failure;
  const result = API.createStorageCoordinator(backend).writeJson("ffs-user-state-v3-mobile-dashboard-ux-test", {});
  assert.equal(result.ok, false);
  assert.match(result.message, /could not be saved/i);
});

test("R5-C quota failure rolls a related-key batch back to Plan A", () => {
  const backend = new MemoryStorage({ plan: '"Plan A"', context: '"Context A"' });
  let failed = false;
  const failure = (key) => {
    if (key !== "context" || failed) return false;
    failed = true;
    return true;
  };
  failure.error = Object.assign(new Error("quota exceeded"), { name: "QuotaExceededError" });
  backend.failOnSet = failure;
  const result = API.createStorageCoordinator(backend).writeBatch([
    { key: "plan", value: "Plan B" },
    { key: "context", value: "Context B" },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "quota");
  assert.equal(backend.getItem("plan"), '"Plan A"');
  assert.equal(backend.getItem("context"), '"Context A"');
});

test("R5-D serialization failure leaves prior persisted data untouched", () => {
  const backend = new MemoryStorage({ plan: '{"id":"good"}' });
  const cyclic = {};
  cyclic.self = cyclic;
  const result = API.createStorageCoordinator(backend).writeJson("plan", cyclic);
  assert.equal(result.ok, false);
  assert.equal(result.code, "serialization");
  assert.equal(backend.getItem("plan"), '{"id":"good"}');
});

test("R5-E corrupt JSON is reported without deleting its raw value", () => {
  const backend = new MemoryStorage({ plan: "{broken" });
  const result = API.createStorageCoordinator(backend).readJson("plan");
  assert.equal(result.ok, false);
  assert.equal(result.corrupt, true);
  assert.equal(result.rawPreserved, true);
  assert.equal(backend.getItem("plan"), "{broken");
});

test("R5-F validation failure preserves the stored record", () => {
  const backend = new MemoryStorage({ plan: "[]" });
  const result = API.createStorageCoordinator(backend).readJson("plan", { validate(value) { if (Array.isArray(value)) throw new Error("wrong top-level type"); } });
  assert.equal(result.ok, false);
  assert.equal(backend.getItem("plan"), "[]");
});

test("R5-G complete plan backup round trip preserves covered fictional data", () => {
  const { context, hooks, CALC, WEEKLY } = loadAppBackupHooks();
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Fictional Person";
  hooks.setPlan(plan);
  const weekly = WEEKLY.migrate({
    planId: "personal-primary",
    settings: { timingSetupReviewed: true, occurrenceOverrides: [{ id: "move-bill", itemId: "bill", occurrenceDate: "2026-09-14", date: "2026-09-21" }] },
    weeks: [{ weekNumber: 1, actual: { income: 1200, notes: "Fictional weekly note" }, isCompleted: true }],
  });
  hooks.setWeeklyPlan(weekly);
  const scenarioInputSnapshot = {
    scenario: {
      oneOffIncomeEvents: [{ id: "inheritance", description: "Inheritance", amountTodayDollars: 25000, year: 2030 }],
      plannedConcessionalContributions: [{ id: "contribution", personId: "person1", financialYear: 2031, amount: 5000 }],
    },
  };
  context.localStorage.setItem("ffs-scenarios-v3-mobile-dashboard-ux-test", JSON.stringify([{ id: "scenario-1", name: "Fictional scenario", plan, scenarioInputSnapshot }]));
  const payload = hooks.buildCompletePlanBackupPayload();
  context.__r5PayloadJson = JSON.stringify(payload);
  const imported = vm.runInContext("FFSWeeklyPlanUiTestHooks.validateImportedPlanPayload(JSON.parse(__r5PayloadJson))", context);
  assert.equal(payload.backupType, "complete-local-plan");
  assert.equal(imported.plan.personal.person1Name, "Fictional Person");
  assert.equal(imported.scenarios[0].name, "Fictional scenario");
  assert.equal(imported.scenarios[0].scenarioInputSnapshot.scenario.oneOffIncomeEvents[0].amountTodayDollars, 25000);
  assert.equal(imported.scenarios[0].scenarioInputSnapshot.scenario.plannedConcessionalContributions[0].amount, 5000);
  assert.equal(imported.weeklyPlan.weeks[0].actual.notes, "Fictional weekly note");
  assert.equal(imported.weeklyPlan.settings.occurrenceOverrides[0].date, "2026-09-21");
});

test("R5-H Weekly Plan backup round trip preserves history and timing metadata", () => {
  const { context, WEEKLY } = loadAppBackupHooks();
  const weekly = WEEKLY.migrate({
    planId: "personal-primary",
    settings: {
      timingSetupReviewed: true,
      timingSetupLastReviewedAt: "2026-09-08T01:00:00.000Z",
      occurrenceOverrides: [{ id: "skip-one", itemId: "bill", occurrenceDate: "2026-09-14", active: false }],
    },
    weeks: [{
      weekNumber: 1,
      isCompleted: true,
      actual: { openingBalance: 1000, income: 1200, essentialCosts: 400, closingBalance: 1800, notes: "Fictional actual" },
      completionChecks: { incomeReceived: true, billsPaid: true },
    }],
  });
  const payload = { ...WEEKLY.exportPayload(weekly), sourceApp: "Financial Freedom", backupType: "weekly-plan-only" };
  context.__r5WeeklyPayloadJson = JSON.stringify(payload);
  const imported = vm.runInContext("FFSWeeklyPlan.importPayload(JSON.parse(__r5WeeklyPayloadJson))", context);
  assert.equal(payload.backupType, "weekly-plan-only");
  assert.equal(imported.weeks[0].actual.notes, "Fictional actual");
  assert.equal(imported.weeks[0].actual.closingBalance, 1800);
  assert.equal(imported.settings.timingSetupReviewed, true);
  assert.equal(imported.settings.occurrenceOverrides[0].active, false);
});

test("R5-I backup coverage matrix reflects both export types", () => {
  const matrix = read("docs/BACKUP-COVERAGE.md");
  assert.match(matrix, /complete local plan/i);
  assert.match(matrix, /Weekly Plan/i);
  assert.match(matrix, /Saved Scenarios/i);
});

test("R5-J first-save prompt records shown state separately from export", () => {
  const source = read("app.js");
  assert.match(source, /firstSavePromptShownAt/);
  assert.match(source, /lastExportInitiatedAt/);
  assert.doesNotMatch(source, /backupSuccessfullyStored/);
});

test("R5-K backup reminder has a session guard and 30-day default", () => {
  const source = read("app.js");
  assert.match(source, /BACKUP_REMINDER_DAYS\s*=\s*30/);
  assert.match(source, /backupReminderShownThisSession/);
});

test("R5-L delete-all removes every owned Financial Freedom key", () => {
  const scheduled = [];
  const backend = new MemoryStorage({
    "ffs-current-plan-v3-mobile-dashboard-ux-test": "plan",
    "ffs-personal-plan-v1:one": "personal",
    "ffs-weekly-plan-v1:one": "weekly",
    "ffs-financial-snapshots-v1:one": "history",
    "ffs-scenarios-v3-mobile-dashboard-ux-test": "scenarios",
  });
  const storage = API.createStorageCoordinator(backend, { schedule: (callback) => scheduled.push(callback) });
  const result = storage.deleteAllOwned();
  assert.equal(result.ok, true);
  for (const key of result.removed) assert.equal(backend.getItem(key), null);
  scheduled.forEach((callback) => callback());
  assert.equal(storage.ownedKeys().keys.length, 0);
});

test("R5-M delete-all preserves unrelated same-origin data", () => {
  const backend = new MemoryStorage({ unrelated: "keep", "ffs-user-state-v3-mobile-dashboard-ux-test": "remove" });
  const scheduled = [];
  API.createStorageCoordinator(backend, { schedule: (callback) => scheduled.push(callback) }).deleteAllOwned();
  scheduled.forEach((callback) => callback());
  assert.equal(backend.getItem("unrelated"), "keep");
});

test("R5-N pending writes cannot recreate deleted data until deliberately resumed", () => {
  const backend = new MemoryStorage({ "ffs-current-plan-v3-mobile-dashboard-ux-test": "old" });
  const storage = API.createStorageCoordinator(backend, { schedule: () => {} });
  assert.equal(storage.deleteAllOwned().ok, true);
  assert.equal(storage.writeText("ffs-current-plan-v3-mobile-dashboard-ux-test", "resurrected").ok, false);
  assert.equal(backend.getItem("ffs-current-plan-v3-mobile-dashboard-ux-test"), null);
  storage.resumeWrites();
  assert.equal(storage.writeText("ffs-current-plan-v3-mobile-dashboard-ux-test", "new-plan").ok, true);
});

test("R5-O a deletion storage event suppresses stale writes in another tab", () => {
  const backend = new MemoryStorage();
  const tabB = API.createStorageCoordinator(backend);
  assert.equal(tabB.handleStorageEvent({ key: API.DELETION_MARKER_KEY, newValue: "generation" }), true);
  const result = tabB.writeText("ffs-current-plan-v3-mobile-dashboard-ux-test", "stale");
  assert.equal(result.ok, false);
  assert.equal(result.code, "stale-after-delete");
});

test("R5-P downloads record initiation rather than guaranteed retention", () => {
  const source = read("app.js");
  assert.match(source, /recordBackupExportInitiated/);
  assert.match(source, /download initiated/i);
  assert.doesNotMatch(source, /backup (?:successfully )?(?:stored|retained)/i);
});

test("R5-Q Privacy and Terms drafts remain visibly subject to legal review", () => {
  const html = read("index.html");
  const source = read("app.js");
  assert.match(html, /data-policy-page="privacy"/);
  assert.match(html, /data-policy-page="terms"/);
  assert.match(source, /DRAFT — subject to legal review/);
  assert.match(source, /Final legal wording requires Australian legal\/regulatory review/);
  assert.doesNotMatch(html, /TODO: legal copy pending professional review/);
  assert.doesNotMatch(html, /not an approved privacy policy or set of terms/i);
});

test("R5-R AI requires both consent states and remains server-contained", () => {
  const source = read("app.js");
  assert.match(source, /aiInsightsUi\.consentAccepted\s*&&\s*aiInsightsUi\.dataConsentAccepted/);
  assert.match(source, /if \(!aiInsightsUi\.consentAccepted \|\| !aiInsightsUi\.dataConsentAccepted\)/);
  assert.match(read("api/ai-insights.js"), /ENABLED_VALUE\s*=\s*"true"/);
});

test("R5-S application logging does not emit plan payloads or sensitive fields", () => {
  const lines = read("app.js").split(/\r?\n/).filter((line) => /console\.(?:log|info|warn|error)/.test(line));
  assert.ok(lines.length > 0);
  for (const line of lines) assert.doesNotMatch(line, /JSON\.stringify|person1Name|person2Name|notes|account|balance|incomeItems|assetItems|liabilityItems/);
});

test("R5 storage inventory covers exact keys and prefixes", () => {
  const inventory = read("docs/STORAGE-INVENTORY.md");
  for (const key of API.EXACT_KEYS) assert.ok(inventory.includes(key), `missing ${key}`);
  for (const prefix of API.KEY_PREFIXES) assert.ok(inventory.includes(prefix), `missing ${prefix}`);
});

test("R5 owned-key classifier excludes lookalike and unrelated keys", () => {
  assert.equal(API.isOwnedKey("ffs-personal-plan-v1:abc"), true);
  assert.equal(API.isOwnedKey("ffs-personal-plan-v2:abc"), false);
  assert.equal(API.isOwnedKey("other-ffs-personal-plan-v1:abc"), false);
});

test("R5 large valid payloads round-trip without truncation", () => {
  const backend = new MemoryStorage();
  const storage = API.createStorageCoordinator(backend);
  const payload = { items: Array.from({ length: 5000 }, (_, index) => ({ id: index, amount: index * 1.25, note: `fictional-${index}` })) };
  assert.equal(storage.writeJson("ffs-weekly-plan-v1:large", payload).ok, true);
  assert.equal(JSON.stringify(storage.readJson("ffs-weekly-plan-v1:large").value), JSON.stringify(payload));
});

test("R5 deletion UI is deliberate and does not use localStorage.clear", () => {
  const source = read("app.js");
  assert.match(source, /openDeleteAllDataConfirmation/);
  assert.match(source, /confirm-delete-all/);
  assert.doesNotMatch(source, /localStorage\.clear\s*\(/);
});

test("R5 local security boundary is stated factually", () => {
  const report = read("docs/PRIVACY-BOUNDARY.md");
  assert.match(report, /same-origin/i);
  assert.match(report, /not.*encrypt/i);
  assert.match(report, /clearing.*browser/i);
});

test("R5 closure A loads storage.js before app.js and retains the safe environment template", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('<script src="storage.js"></script>') < html.indexOf('<script src="app.js"></script>'));
  const template = read(".env.example");
  assert.match(template, /^# Safe placeholders only\./);
  assert.match(template, /^AI_INSIGHTS_SERVER_ENABLED=false$/m);
  assert.match(template, /^OPENAI_API_KEY=$/m);
});

test("R5 closure B coordinator-present plan save remains verified", () => {
  const { context, hooks, CALC } = loadAppBackupHooks();
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Coordinator Present";
  hooks.setPlan(plan);
  assert.equal(hooks.saveDraft(), true);
  assert.ok(context.localStorage.getItem("ffs-current-plan-v3-mobile-dashboard-ux-test"));
  assert.ok(context.localStorage.getItem("ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test"));
});

test("R5 closure C coordinator-unavailable plan save fails closed", () => {
  const { context, document, hooks, CALC } = loadAppBackupHooks({ withStorageCoordinator: false });
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Unsaved In Memory";
  hooks.setPlan(plan);
  hooks.setPlanHasUnsavedChanges(true);
  assert.equal(hooks.saveDraft(), false);
  assert.equal(context.localStorage.getItem("ffs-current-plan-v3-mobile-dashboard-ux-test"), null);
  assert.equal(hooks.getPlanHasUnsavedChanges(), true);
  assert.match(document.getElementById("wizardSaveStatus").textContent, /browser storage is unavailable/i);
});

test("R5 closure D coordinator-unavailable autosave cannot report success", () => {
  const { document, hooks, CALC } = loadAppBackupHooks({ withStorageCoordinator: false });
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Autosave Draft";
  hooks.setPlan(plan);
  assert.equal(hooks.autosavePlan(), false);
  const status = document.getElementById("wizardSaveStatus").textContent;
  assert.match(status, /browser storage is unavailable/i);
  assert.doesNotMatch(status, /all changes saved/i);
});

test("R5 closure E complete import cannot partially restore without the coordinator", () => {
  const existing = '{"existing":"stored-plan"}';
  const { context, document, hooks, CALC } = loadAppBackupHooks({
    withStorageCoordinator: false,
    initialStorage: { "ffs-current-plan-v3-mobile-dashboard-ux-test": existing },
  });
  const current = CALC.emptyPlan();
  current.personal.person1Name = "Current Open Plan";
  hooks.setPlan(current);
  const incoming = CALC.emptyPlan();
  incoming.personal.person1Name = "Imported Plan";
  context.__r5ImportJson = JSON.stringify({
    type: "financial-freedom-plan-export",
    schemaVersion: 1,
    planId: "imported-plan",
    plan: incoming,
    scenarios: [{ id: "incoming-scenario", name: "Incoming", plan: incoming }],
  });
  vm.runInContext("FFSWeeklyPlanUiTestHooks.importPlanPayload(JSON.parse(__r5ImportJson))", context);
  assert.equal(context.localStorage.getItem("ffs-current-plan-v3-mobile-dashboard-ux-test"), existing);
  assert.equal(context.localStorage.getItem("ffs-scenarios-v3-mobile-dashboard-ux-test"), null);
  assert.equal(hooks.getPlan().personal.person1Name, "Current Open Plan");
  assert.match(document.getElementById("wizardSaveStatus").textContent, /browser storage is unavailable/i);
  assert.doesNotMatch(document.getElementById("wizardSaveStatus").textContent, /imported successfully/i);
});

test("R5 closure F scenario and Weekly Plan persistence fail visibly without fallback writes", () => {
  const { context, document, hooks, CALC, WEEKLY } = loadAppBackupHooks({ withStorageCoordinator: false });
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Open Plan";
  hooks.setPlan(plan);
  assert.equal(hooks.saveScenarios([{ id: "scenario", name: "Unsaved scenario", plan }]), false);
  assert.equal(context.localStorage.getItem("ffs-scenarios-v3-mobile-dashboard-ux-test"), null);
  hooks.setWeeklyPlan(WEEKLY.migrate({ planId: "personal-plan:default", weeks: [{ weekNumber: 1 }] }));
  assert.equal(hooks.saveWeeklyPlan("Weekly Plan saved."), false);
  assert.equal(context.localStorage.getItem("ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test"), null);
  assert.match(document.getElementById("wizardSaveStatus").textContent, /browser storage is unavailable/i);
});

test("R5 closure G failed persistence retains the open in-memory plan", () => {
  const { hooks, CALC } = loadAppBackupHooks({ withStorageCoordinator: false });
  const plan = CALC.emptyPlan();
  plan.personal.person1Name = "Still Open";
  plan.personal.person1Age = 41;
  hooks.setPlan(plan);
  assert.equal(hooks.autosavePlan(), false);
  assert.equal(hooks.getPlan().personal.person1Name, "Still Open");
  assert.equal(hooks.getPlan().personal.person1Age, 41);
});

test("R5 closure H delete-all fails closed without uncoordinated deletion", () => {
  const ownedKey = "ffs-current-plan-v3-mobile-dashboard-ux-test";
  const { context, hooks } = loadAppBackupHooks({
    withStorageCoordinator: false,
    initialStorage: { [ownedKey]: "stored-plan", unrelated: "keep" },
  });
  hooks.setPlanHasUnsavedChanges(true);
  assert.equal(hooks.deleteAllFinancialFreedomData(), false);
  assert.equal(context.localStorage.getItem(ownedKey), "stored-plan");
  assert.equal(context.localStorage.getItem("unrelated"), "keep");
  assert.equal(hooks.getPlanHasUnsavedChanges(), true);
});

test("R5 closure I Weekly Plan restore fails closed and preserves the open week", () => {
  const { context, document, hooks, WEEKLY } = loadAppBackupHooks({ withStorageCoordinator: false });
  const current = WEEKLY.migrate({ planId: "personal-plan:default", weeks: [{ weekNumber: 1, actual: { notes: "Current open week" } }] });
  const incoming = WEEKLY.migrate({ planId: "personal-plan:default", weeks: [{ weekNumber: 1, actual: { notes: "Incoming week" } }] });
  hooks.setWeeklyPlan(current);
  context.__r5WeeklyRestoreJson = JSON.stringify(WEEKLY.exportPayload(incoming));
  const restored = vm.runInContext("FFSWeeklyPlanUiTestHooks.restoreWeeklyPlanPayload(JSON.parse(__r5WeeklyRestoreJson))", context);
  assert.equal(restored, false);
  assert.equal(hooks.getWeeklyPlan().weeks[0].actual.notes, "Current open week");
  assert.equal(context.localStorage.getItem("ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test"), null);
  assert.match(document.getElementById("wizardSaveStatus").textContent, /browser storage is unavailable/i);
  assert.doesNotMatch(document.getElementById("wizardSaveStatus").textContent, /backup imported/i);
});
