// Kept outside the default unit-test inventory because it launches a real browser.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
let server;
let chrome;
let profile;
let cdp;
let baseUrl;
let browserMessages = [];

function chromePath() {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
        path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
        path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
        path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error("Stage 1 browser tests require an installed Chrome or Edge browser.");
  return found;
}

async function waitFor(check, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for browser state.");
}

class CdpClient {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }
  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function key(key, modifiers = 0) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers });
}

async function navigate() {
  await cdp.send("Page.navigate", { url: baseUrl });
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(window.FFSStage1BrowserTestHooks)"));
}

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
      const resolved = path.resolve(root, relative);
      if (!resolved.startsWith(root)) throw new Error("Invalid path");
      const body = await readFile(resolved);
      response.writeHead(200, { "content-type": mime[path.extname(resolved)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = process.env.AGE_PENSION_PREVIEW_URL || `http://127.0.0.1:${server.address().port}/`;
  profile = await mkdtemp(path.join(tmpdir(), "ffs-stage1-browser-"));
  chrome = spawn(chromePath(), [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-breakpad", "--disable-crash-reporter",
    "--no-sandbox", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  const portFile = path.join(profile, "DevToolsActivePort");
  const contents = await waitFor(async () => existsSync(portFile) ? readFile(portFile, "utf8") : null);
  const port = String(contents).split(/\r?\n/)[0];
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = pages.find((item) => item.type === "page");
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (["error", "warning", "warn"].includes(type)) browserMessages.push(args.map((item) => item.value || item.description || "").join(" "));
  });
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => browserMessages.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Browser exception"));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.FFS_STAGE1_BROWSER_TESTS_ENABLED=true; window.print=()=>{window.__printCalls=(window.__printCalls||0)+1}; window.confirm=()=>true;",
  });
  await navigate();
});

after(async () => {
  if (cdp) await cdp.send("Browser.close").catch(() => {});
  if (chrome && chrome.exitCode === null) await Promise.race([
    new Promise(resolve => chrome.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  cdp?.close();
  if (chrome && chrome.exitCode === null) chrome.kill();
  chrome?.unref();
  server?.closeAllConnections?.();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (profile && path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(profile).startsWith("ffs-stage1-browser-")) await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});


for (const width of [1366, 375]) test('Age Pension browser placement and interaction at '+width+'px', async () => {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  await evaluate("FFSStage1BrowserTestHooks.setPlan(FFS_DATA.samplePlans[1].plan,'semiretirement')");
  await waitFor(()=>evaluate(`Boolean(document.querySelector('[data-semi-input="scenario.agePension.enabled"]'))`));
  const state=await evaluate(`(()=>{const pension=document.querySelector('[data-semi-detail-state="agePension"]'); const down=document.querySelector('[data-semi-detail-state="downsizeHome"]');const setting=[...document.querySelectorAll('h4')].find(x=>x.textContent==='Projection settings'); return {collapsed:!pension.open, checked:pension.querySelector('input').checked, ordered:!!(pension.compareDocumentPosition(setting)&Node.DOCUMENT_POSITION_FOLLOWING), width:document.documentElement.scrollWidth,viewport:innerWidth};})()`);
  assert.equal(state.collapsed,true); assert.equal(state.checked,false); assert.equal(state.ordered,true);
  assert.ok(state.width<=state.viewport+1,JSON.stringify(state));
  await evaluate(`document.querySelector('[data-semi-detail-state="agePension"] summary').click();document.querySelector('[data-semi-input="scenario.agePension.enabled"]').click();document.querySelector('[data-semi-action="calculate"]').click();`);
  await waitFor(()=>evaluate(`document.body.textContent.includes('Before-tax pension over this projection')`));
  assert.equal(await evaluate(`document.querySelector('[data-semi-input="scenario.agePension.enabled"]').checked`),true);
  assert.ok(await evaluate(`document.body.textContent.includes('without. First unfunded year without pension:')`));
  await evaluate(`document.querySelector('[data-semi-input="scenario.agePension.enabled"]').click();document.querySelector('[data-semi-action="calculate"]').click();`);
  assert.equal(await evaluate(`document.body.textContent.includes('Before-tax pension over this projection')`),false);
});
