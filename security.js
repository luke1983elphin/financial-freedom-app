(function attachFinancialFreedomSecurity(global) {
  "use strict";

  const DEFAULT_MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const DEFAULT_MAX_DEPTH = 40;
  const DEFAULT_MAX_NODES = 100000;
  const DEFAULT_MAX_STRING_LENGTH = 250000;
  const DEFAULT_MAX_ABS_NUMBER = 1e15;
  const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const SAFE_DOWNLOAD_EXTENSIONS = new Set(["json", "xlsx", "pdf"]);

  function byteLength(value) {
    const text = String(value ?? "");
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).byteLength;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assertSafeData(value, options = {}) {
    const maxDepth = Number(options.maxDepth) || DEFAULT_MAX_DEPTH;
    const maxNodes = Number(options.maxNodes) || DEFAULT_MAX_NODES;
    const maxStringLength = Number(options.maxStringLength) || DEFAULT_MAX_STRING_LENGTH;
    const maxAbsNumber = Number(options.maxAbsNumber) || DEFAULT_MAX_ABS_NUMBER;
    let nodes = 0;

    function visit(current, depth, path) {
      nodes += 1;
      if (nodes > maxNodes) throw new Error("The import contains too many data items.");
      if (depth > maxDepth) throw new Error("The import is nested too deeply.");
      if (typeof current === "string") {
        if (current.length > maxStringLength) throw new Error(`The import contains an excessively long value at ${path}.`);
        return;
      }
      if (typeof current === "number") {
        if (!Number.isFinite(current) || Math.abs(current) > maxAbsNumber) throw new Error(`The import contains an invalid numeric value at ${path}.`);
        return;
      }
      if (current === null || typeof current === "boolean") return;
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) visit(current[index], depth + 1, `${path}[${index}]`);
        return;
      }
      if (!isPlainObject(current)) throw new Error(`The import contains an unsupported value at ${path}.`);
      for (const key of Object.keys(current)) {
        if (FORBIDDEN_KEYS.has(key)) throw new Error(`The import contains a prohibited key: ${key}.`);
        visit(current[key], depth + 1, `${path}.${key}`);
      }
    }

    visit(value, 0, "data");
    return value;
  }

  function parseJsonImport(text, options = {}) {
    const maxBytes = Number(options.maxBytes) || DEFAULT_MAX_IMPORT_BYTES;
    if (byteLength(text) > maxBytes) throw new Error(`The selected file is too large. Choose a Financial Freedom backup smaller than ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
    let parsed;
    try {
      parsed = JSON.parse(String(text ?? ""));
    } catch {
      throw new Error("The selected file does not contain valid JSON.");
    }
    return assertSafeData(parsed, options);
  }

  function assertSupportedVersion(value, { label = "backup", minimum = 1, maximum = 1, allowMissing = true } = {}) {
    if (value === undefined || value === null || value === "") {
      if (allowMissing) return null;
      throw new Error(`The ${label} does not include a schema version.`);
    }
    const version = Number(value);
    if (!Number.isInteger(version) || version < minimum || version > maximum) {
      throw new Error(`This ${label} version is not supported by this version of Financial Freedom.`);
    }
    return version;
  }

  function assertValidIsoDate(value, label, { allowEmpty = true } = {}) {
    if (value === undefined || value === null || value === "") {
      if (allowEmpty) return "";
      throw new Error(`${label} is missing.`);
    }
    const text = String(value);
    if (!Number.isFinite(Date.parse(text))) throw new Error(`${label} is invalid.`);
    return text;
  }

  function safeUrl(value, { allowRelative = true, protocols = ["https:", "http:", "mailto:"] } = {}) {
    const input = String(value ?? "").trim();
    if (!input) return null;
    if (input.startsWith("//")) return null;
    if (allowRelative && /^(?:\/|\.\/|\.\.\/)(?!\/)/.test(input)) return input;
    let parsed;
    try {
      parsed = new URL(input, "https://financial-freedom.invalid");
    } catch {
      return null;
    }
    if (!protocols.includes(parsed.protocol)) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(input) && !allowRelative) return null;
    return input;
  }

  function safeFilename(value, extension) {
    const safeExtension = String(extension || "").toLowerCase();
    if (!SAFE_DOWNLOAD_EXTENSIONS.has(safeExtension)) throw new Error("Unsupported download file type.");
    const base = String(value || "Financial-Freedom")
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
      .replace(/[^a-z0-9-_ ]+/gi, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[. -]+|[. -]+$/g, "")
      .slice(0, 80) || "Financial-Freedom";
    return `${base}.${safeExtension}`;
  }

  function validateCsp(policy) {
    const directives = new Map(String(policy || "").split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const [name, ...values] = entry.split(/\s+/);
      return [name, values];
    }));
    const required = ["default-src", "script-src", "style-src", "connect-src", "object-src", "base-uri", "frame-ancestors", "form-action"];
    const missing = required.filter((name) => !directives.has(name));
    if (missing.length) throw new Error(`CSP is missing required directives: ${missing.join(", ")}.`);
    if (!directives.get("object-src").includes("'none'")) throw new Error("CSP object-src must be 'none'.");
    if (!directives.get("frame-ancestors").includes("'none'")) throw new Error("CSP frame-ancestors must be 'none'.");
    if (directives.get("script-src").includes("'unsafe-eval'")) throw new Error("CSP must not permit unsafe-eval.");
    return { directives };
  }

  function auditRuntimeHtml(html, allowedScriptHosts = []) {
    const source = String(html || "");
    if (/cdn\.tailwindcss\.com/i.test(source)) throw new Error("Tailwind development CDN must not be used at runtime.");
    const externalScripts = Array.from(source.matchAll(/<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi), (match) => new URL(match[1]).host);
    const unexpected = externalScripts.filter((host) => !allowedScriptHosts.includes(host));
    if (unexpected.length) throw new Error(`Unexpected third-party runtime script host: ${unexpected.join(", ")}.`);
    return { externalScripts };
  }

  const api = {
    DEFAULT_MAX_IMPORT_BYTES,
    escapeHtml,
    isPlainObject,
    assertSafeData,
    parseJsonImport,
    assertSupportedVersion,
    assertValidIsoDate,
    safeUrl,
    safeFilename,
    validateCsp,
    auditRuntimeHtml,
    byteLength,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FFSSecurity = api;
})(typeof window !== "undefined" ? window : globalThis);
