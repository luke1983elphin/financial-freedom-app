import process from "node:process";

import { ACTIVE_TEST_SUITES } from "./test-suites.mjs";
import { validateTestInventory } from "./test-inventory.mjs";

const root = process.cwd();
const { discovered, registered, failures } = validateTestInventory(ACTIVE_TEST_SUITES, { root });

if (failures.length) {
  console.error("[TEST INVENTORY FAILED]");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[TEST INVENTORY PASSED]");
console.log(JSON.stringify({
  discoveredTestFiles: discovered.length,
  registeredSuites: registered.length,
  suites: registered,
}, null, 2));
