import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reportFixture } from './report-fixture.mjs';
const root = resolve('.'), out = resolve('outputs/calculation-support/change'); mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const hook = `window.__changeQA={capture:mode=>changeSupportCaptures.get(mode),zero:()=>{decisionScenarioDraft={...comparisonDefaults};renderAll();}};`;
const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end('{"enabled":false}'); return; }
  const file = resolve(root, '.' + (p === '/' ? '/index.html' : p));
  if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try { let data = readFileSync(file); if (p === '/app.js') data = data.toString().replace('  window.addEventListener("storage", (event) => {', hook + '\n  window.addEventListener("storage", (event) => {'); res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(file)] || 'text/plain'); res.end(data); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  await page.addInitScript(() => window.FFS_STAGE1_BROWSER_TESTS_ENABLED = true);
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.__changeQA);
  await page.evaluate(p => { FFSStage1BrowserTestHooks.setPlan(p, 'decision'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); }, reportFixture());
  const stored = await page.evaluate(() => JSON.stringify(FFSStage1BrowserTestHooks.getPlan()));
  let lastId;
  for (const preset of ['expenses-500', 'invest-250']) {
    await page.evaluate(id => document.querySelector(`[data-what-if="${id}"]`).click(), preset);
    for (const basis of ['future', 'today']) {
      await page.evaluate(b => document.querySelector(`[data-dollar-basis="${b}"]`).click(), basis);
      const capture = await page.evaluate(() => __changeQA.capture('quick')); assert.ok(capture); assert.notEqual(capture.id, lastId); lastId = capture.id;
      assert.equal(capture.data.changes.preset, preset);
      assert.ok(preset === 'expenses-500' ? capture.data.cashflow.annualCashflowImpact > 0 : capture.data.cashflow.annualCashflowImpact < 0);
      const text = await page.locator('#whatIfResult').textContent();
      for (const f of capture.data.figures) {
        for (const v of [f.ref, f.displayCurrent, f.displayAdjusted, f.displayDifference]) assert.ok(text.includes(v), `Missing visible ${v}`);
        assert.equal(f.difference, f.adjusted - f.current);
      }
      const downloadPromise = page.waitForEvent('download'); await page.locator('[data-change-support="quick"]').click(); const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), capture.id + '.xlsx');
      const name = `change-${preset}-${basis}`; await download.saveAs(resolve(out, name + '.xlsx'));
      await page.addStyleTag({ content: 'header { visibility:hidden !important; }' });
      await page.locator('#whatIfResult').screenshot({ path: resolve(out, name + '.png') }); writeFileSync(resolve(out, name + '.json'), JSON.stringify(capture));
    }
  }
  await page.locator('[data-what-if-custom-toggle]').click();
  await page.locator('[data-what-if-custom-kind]').selectOption('expenses');
  await page.locator('[data-what-if-custom-amount]').fill('75');
  await page.locator('[data-what-if-custom-frequency]').selectOption('weekly');
  await page.locator('[data-what-if-custom-apply]').click();
  const custom = await page.evaluate(() => __changeQA.capture('quick'));
  assert.equal(custom.data.changes.preset, 'custom'); assert.equal(custom.data.changes.custom.frequency, 'weekly');
  assert.ok(Math.abs(custom.data.cashflow.annualCashflowImpact - 3900) < .01); assert.notEqual(custom.id, lastId); lastId = custom.id;
  await page.evaluate(() => __changeQA.zero());
  const detailed = await page.evaluate(() => __changeQA.capture('detailed')); assert.ok(detailed.data.figures.every(f => f.difference === 0));
  await page.evaluate(() => { const node = document.querySelector('#customScenarioDetails'); if (node) node.open = true; });
  const detailText = await page.locator('#comparisonSummary').textContent();
  for (const f of detailed.data.figures) { assert.ok(detailText.includes(f.ref)); assert.ok(detailText.includes(f.displayCurrent)); assert.ok(detailText.includes(f.displayDifference)); }
  const pending = page.waitForEvent('download'); await page.locator('[data-change-support="detailed"]').click(); await (await pending).saveAs(resolve(out, 'change-zero-today.xlsx'));
  await page.locator('#comparisonSummary').screenshot({ path: resolve(out, 'change-zero-today.png') }); writeFileSync(resolve(out, 'change-zero-today.json'), JSON.stringify(detailed));
  assert.equal(await page.evaluate(() => JSON.stringify(FFSStage1BrowserTestHooks.getPlan())), stored);
  await page.evaluate(() => { const p = FFSStage1BrowserTestHooks.getPlan(); p.incomeItems[0].amount += 10000; FFSStage1BrowserTestHooks.setPlan(p, 'decision'); });
  assert.notEqual(await page.evaluate(() => __changeQA.capture('quick').id), lastId);
  assert.deepEqual(errors, []); console.log('Try a Change: positive/negative cash outcomes, zero differences, both bases, exact visible values, ID renewal and plan preservation pass.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
