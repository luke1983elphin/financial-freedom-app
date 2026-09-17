import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const securityContext = { console, URL, TextEncoder };
securityContext.globalThis = securityContext;
vm.createContext(securityContext);
vm.runInContext(read("security.js"), securityContext, { filename: "security.js" });
const security = securityContext.FFSSecurity;

const requiredUtilities = [
  "antialiased", "absolute", "relative", "sticky", "top-0", "z-30", "mx-auto",
  "mt-1", "mt-2", "mt-3", "mt-4", "mt-5", "mt-6", "mt-8", "mt-12", "mb-4",
  "block", "inline-block", "inline-flex", "flex", "grid", "hidden", "h-fit", "min-h-28",
  "min-h-screen", "w-full", "max-w-xl", "max-w-2xl", "max-w-4xl", "max-w-7xl", "flex-1",
  "flex-col", "flex-row", "flex-wrap", "items-start", "items-center", "justify-center",
  "justify-between", "gap-1", "gap-2", "gap-3", "gap-4", "gap-6", "overflow-hidden",
  "overflow-x-auto", "rounded-full", "rounded-2xl", "rounded-3xl", "border", "border-b",
  "border-t", "border-line", "border-amber-200", "bg-white", "bg-white/90", "bg-mist",
  "bg-slate-50", "bg-blue-50", "bg-amber-50", "p-3", "p-4", "px-3", "px-4", "py-1",
  "py-4", "py-6", "py-8", "text-xs", "text-sm", "text-lg", "text-xl", "text-3xl",
  "text-4xl", "font-semibold", "font-bold", "font-black", "uppercase", "leading-6", "leading-8",
  "text-ink", "text-navy", "text-success", "text-slate-500", "text-slate-600", "text-blue-700",
  "text-amber-800", "shadow-soft", "backdrop-blur", "sm:flex-row", "sm:text-4xl", "sm:text-6xl",
  "md:grid-cols-4", "lg:sticky", "lg:top-24", "lg:h-fit", "lg:flex-row", "lg:items-center",
  "lg:justify-between", "lg:grid-cols-2", "lg:grid-cols-[250px_1fr]", "lg:py-14", "xl:grid-cols-2",
  "xl:grid-cols-3", "xl:grid-cols-[1fr_1.1fr]", "xl:grid-cols-[1fr_1.15fr]",
];

function escapedSelector(token) {
  return `.${token.replace(/([:/.[\]])/g, "\\$1")}`;
}

const index = read("index.html");
const css = read("tailwind-static.css");
security.auditRuntimeHtml(index, []);
if (!existsSync(path.join(root, "tailwind-static.css"))) throw new Error("Local utility stylesheet is missing.");
if (!index.includes('href="tailwind-static.css"')) throw new Error("Runtime HTML does not load the local utility stylesheet.");
const missingUtilities = requiredUtilities.filter((token) => !css.includes(escapedSelector(token)));
if (missingUtilities.length) throw new Error(`Local utility stylesheet is missing: ${missingUtilities.join(", ")}`);

const vercel = JSON.parse(read("vercel.json"));
const headers = vercel.headers?.flatMap((entry) => entry.headers || []) || [];
const headerMap = new Map(headers.map((item) => [String(item.key).toLowerCase(), item.value]));
const csp = headerMap.get("content-security-policy-report-only");
security.validateCsp(csp);
for (const requiredHeader of ["x-content-type-options", "referrer-policy", "x-frame-options", "permissions-policy"]) {
  if (!headerMap.has(requiredHeader)) throw new Error(`Missing security header: ${requiredHeader}`);
}

console.log("[BROWSER SECURITY CONFIG PASSED]");
console.log(JSON.stringify({ requiredUtilities: requiredUtilities.length, externalRuntimeScripts: 0, cspMode: "REPORT-ONLY" }, null, 2));
