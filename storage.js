(function attachFinancialFreedomStorage(global) {
  "use strict";

  const EXACT_KEYS = new Set([
    "ffs-current-plan-v3-mobile-dashboard-ux-test",
    "ffs-current-plan-last-saved-v3-mobile-dashboard-ux-test",
    "ffs-scenarios-v3-mobile-dashboard-ux-test",
    "ffs-weekly-plan-v1-v3-mobile-dashboard-ux-test",
    "ffs-user-state-v3-mobile-dashboard-ux-test",
    "ffs-plan-context-v3-mobile-dashboard-ux-test",
    "ffs-durability-state-v1",
    "ffs-data-deletion-in-progress-v1",
  ]);
  const KEY_PREFIXES = [
    "ffs-personal-plan-v1:",
    "ffs-weekly-plan-v1:",
    "ffs-financial-snapshots-v1:",
  ];
  const DELETION_MARKER_KEY = "ffs-data-deletion-in-progress-v1";

  function isOwnedKey(key) {
    const text = String(key || "");
    return EXACT_KEYS.has(text) || KEY_PREFIXES.some((prefix) => text.startsWith(prefix));
  }

  function classifyError(error) {
    const name = String(error?.name || "");
    const message = String(error?.message || "");
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || /quota/i.test(message)) return "quota";
    if (name === "SecurityError" || /denied|disabled|unavailable/i.test(message)) return "unavailable";
    if (/serializ/i.test(message) || name === "TypeError") return "serialization";
    if (/read.?back|verification/i.test(message)) return "verification";
    if (/deleted in another tab/i.test(message)) return "stale-after-delete";
    return "storage";
  }

  function publicMessage(code) {
    if (code === "quota") return "Your current plan is still open, but it could not be saved because this browser has no storage space available. Export a backup and free some browser storage before trying again.";
    if (code === "stale-after-delete") return "Saving is paused because Financial Freedom data was deleted in another tab. Start a new plan or import a backup before saving again.";
    return "Your current plan is still open, but it could not be saved in this browser. Export a backup and try saving again.";
  }

  function createStorageCoordinator(backend, options = {}) {
    const schedule = options.schedule || ((callback, delay) => global.setTimeout(callback, delay));
    const onIssue = typeof options.onIssue === "function" ? options.onIssue : () => {};
    let writesSuppressed = false;
    let suppressionReason = "";

    function resultError(error, operation, key = "") {
      const code = classifyError(error);
      const result = { ok: false, code, operation, key, message: publicMessage(code) };
      onIssue(result);
      return result;
    }

    function getText(key) {
      try {
        return { ok: true, value: backend.getItem(key) };
      } catch (error) {
        return { ...resultError(error, "read", key), value: null };
      }
    }

    function serialise(value) {
      try {
        const text = JSON.stringify(value);
        if (text === undefined) throw new TypeError("Serialization produced no value.");
        return { ok: true, value: text };
      } catch (error) {
        return resultError(error, "serialize");
      }
    }

    function writeText(key, text, writeOptions = {}) {
      if (writesSuppressed && !writeOptions.allowWhileSuppressed) {
        return resultError(new Error(suppressionReason || "Data was deleted in another tab."), "write", key);
      }
      try {
        backend.setItem(key, String(text));
        if (writeOptions.verify !== false && backend.getItem(key) !== String(text)) {
          throw new Error("Storage read-back verification failed.");
        }
        return { ok: true, key };
      } catch (error) {
        return resultError(error, "write", key);
      }
    }

    function writeJson(key, value, writeOptions = {}) {
      const encoded = serialise(value);
      return encoded.ok ? writeText(key, encoded.value, writeOptions) : encoded;
    }

    function restoreEntry(entry) {
      if (entry.previous === null) backend.removeItem(entry.key);
      else backend.setItem(entry.key, entry.previous);
    }

    function writeBatch(entries, writeOptions = {}) {
      if (writesSuppressed && !writeOptions.allowWhileSuppressed) {
        return resultError(new Error(suppressionReason || "Data was deleted in another tab."), "batch-write");
      }
      const prepared = [];
      for (const entry of entries || []) {
        if (!entry || !entry.key) return resultError(new TypeError("Invalid storage entry."), "serialize");
        if (entry.remove) {
          prepared.push({ key: entry.key, remove: true });
          continue;
        }
        const encoded = entry.json === false ? { ok: true, value: String(entry.value) } : serialise(entry.value);
        if (!encoded.ok) return encoded;
        prepared.push({ key: entry.key, value: encoded.value, remove: false });
      }
      const originals = [];
      try {
        for (const entry of prepared) originals.push({ key: entry.key, previous: backend.getItem(entry.key) });
      } catch (error) {
        return resultError(error, "read-before-write");
      }
      const changed = [];
      try {
        for (const entry of prepared) {
          if (entry.remove) backend.removeItem(entry.key);
          else backend.setItem(entry.key, entry.value);
          changed.push(originals.find((original) => original.key === entry.key));
          const current = backend.getItem(entry.key);
          if ((!entry.remove && current !== entry.value) || (entry.remove && current !== null)) {
            throw new Error("Storage read-back verification failed.");
          }
        }
        return { ok: true, keys: prepared.map((entry) => entry.key) };
      } catch (error) {
        let rollbackComplete = true;
        for (const entry of changed.reverse()) {
          try {
            restoreEntry(entry);
          } catch {
            rollbackComplete = false;
          }
        }
        return { ...resultError(error, "batch-write"), rollbackComplete };
      }
    }

    function remove(key, removeOptions = {}) {
      if (writesSuppressed && !removeOptions.allowWhileSuppressed) {
        return resultError(new Error(suppressionReason || "Data was deleted in another tab."), "remove", key);
      }
      try {
        backend.removeItem(key);
        return { ok: backend.getItem(key) === null, key };
      } catch (error) {
        return resultError(error, "remove", key);
      }
    }

    function readJson(key, readOptions = {}) {
      const stored = getText(key);
      if (!stored.ok || stored.value === null) return stored;
      try {
        const parsed = JSON.parse(stored.value);
        if (readOptions.validate) readOptions.validate(parsed);
        return { ok: true, value: parsed };
      } catch (error) {
        const issue = resultError(error, "parse", key);
        return { ...issue, corrupt: true, rawPreserved: true, value: null };
      }
    }

    function ownedKeys() {
      const keys = [];
      try {
        for (let index = 0; index < backend.length; index += 1) {
          const key = backend.key(index);
          if (isOwnedKey(key)) keys.push(key);
        }
      } catch (error) {
        return { ...resultError(error, "enumerate"), keys: [] };
      }
      return { ok: true, keys };
    }

    function suppressWrites(reason = "Data was deleted in another tab.") {
      writesSuppressed = true;
      suppressionReason = reason;
    }

    function resumeWrites() {
      writesSuppressed = false;
      suppressionReason = "";
    }

    function deleteAllOwned(deleteOptions = {}) {
      const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const markerWrite = writeText(DELETION_MARKER_KEY, marker, { allowWhileSuppressed: true });
      if (!markerWrite.ok) return markerWrite;
      suppressWrites("Financial Freedom data was deleted on this device.");
      const inventory = ownedKeys();
      if (!inventory.ok) return inventory;
      const removed = [];
      try {
        for (const key of inventory.keys) {
          if (key === DELETION_MARKER_KEY) continue;
          backend.removeItem(key);
          if (backend.getItem(key) !== null) throw new Error(`Deletion verification failed for ${key}.`);
          removed.push(key);
        }
      } catch (error) {
        return { ...resultError(error, "delete-all"), removed };
      }
      schedule(() => {
        try {
          if (backend.getItem(DELETION_MARKER_KEY) === marker) backend.removeItem(DELETION_MARKER_KEY);
        } catch {
          // A non-financial coordination marker may remain if storage becomes unavailable.
        }
      }, Number(deleteOptions.markerLifetimeMs) >= 0 ? Number(deleteOptions.markerLifetimeMs) : 1000);
      return { ok: true, removed, marker };
    }

    function handleStorageEvent(event) {
      if (event?.key === DELETION_MARKER_KEY && event.newValue) {
        suppressWrites("Financial Freedom data was deleted in another tab.");
        return true;
      }
      return false;
    }

    return {
      getText,
      readJson,
      serialise,
      writeText,
      writeJson,
      writeBatch,
      remove,
      ownedKeys,
      deleteAllOwned,
      handleStorageEvent,
      suppressWrites,
      resumeWrites,
      isWriteSuppressed: () => writesSuppressed,
      suppressionReason: () => suppressionReason,
    };
  }

  const api = {
    EXACT_KEYS,
    KEY_PREFIXES,
    DELETION_MARKER_KEY,
    isOwnedKey,
    classifyError,
    publicMessage,
    createStorageCoordinator,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FFSStorage = api;
})(typeof window !== "undefined" ? window : globalThis);
