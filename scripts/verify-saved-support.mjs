import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reportFixture } from './report-fixture.mjs';
const root = resolve('.'), out = resolve('outputs/calculation-support/saved'); mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const hook = `window.__savedQA={seed:values=>saveScenarios(values),stored:()=>loadScenarios(),capture:key=>savedSupportCaptures.get(key),retirement:()=>buildRetirementScenarioSaveContext()};`;
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
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.__savedQA);
  await page.evaluate(p => { FFSStage1BrowserTestHooks.setPlan(p, 'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-semi-action="calculate"]').click(); }, reportFixture());
  const retirement = await page.evaluate(() => ({ ...__savedQA.retirement(), id: 'fictional-retirement', name: 'Fictional saved retirement', savedAt: '2025-01-01T00:00:00Z', plan: FFSStage1BrowserTestHooks.getPlan() }));
  const historical = { id: 'fictional-history', name: 'Fictional incomplete historical snapshot', scenarioType: 'financial-plan', savedAt: '2024-01-01T00:00:00Z', calculationVersion: 'historical-fictional', plan: reportFixture(), keyResultSnapshot: { rows: [
    { label: 'Monthly cash surplus', value: '-$300', rawValue: -300 }, { label: '1-year net worth', value: '$123,456', rawValue: 123456 },
    { label: '2-year net worth', value: '$200,000', rawValue: 200000 }, { label: 'Long-term net worth', value: '$900,000 (retained text only)' },
  ] } };
  historical.plan.assetItems[0].value += 10000;
  const second = structuredClone(historical); second.id = 'fictional-history-2'; second.name = 'Second fictional snapshot'; second.keyResultSnapshot.rows[0] = { label: 'Monthly cash surplus', value: '$500', rawValue: 500 };
  await page.evaluate(values => { __savedQA.seed(values); FFSStage1BrowserTestHooks.showWorkspace('scenarios'); FFSStage1BrowserTestHooks.renderAll(); }, [historical, retirement, second]);
  const stored = await page.evaluate(() => JSON.stringify(__savedQA.stored()));
  const viewer = page.locator('#stage2SnapshotViewer');
  await page.locator('[data-stage2-current="fictional-history"]').click();
  for (const basis of ['future', 'today']) {
    await page.evaluate(b => document.querySelector(`[data-dollar-basis="${b}"]`).click(), basis);
    const capture = await page.evaluate(() => __savedQA.capture('snapshot:fictional-history:true'));
    assert.equal(capture.data.sources[1].workings, null);
    assert.match(await viewer.textContent(), /Workings unavailable for this snapshot/);
    assert.match(capture.data.sources[0].label, /Current plan/); assert.match(capture.data.sources[1].label, /Historical snapshot/);
    const cash = capture.data.comparison.find(r => r.label === 'Monthly cash surplus'); assert.equal(cash.right, -300); assert.notEqual(cash.right - cash.left, 0);
    assert.ok(capture.data.inputDifferences.length > 0);
    const pending = page.waitForEvent('download'); await viewer.locator('[data-saved-support]').click(); const download = await pending;
    assert.equal(download.suggestedFilename(), capture.id + '.xlsx'); await download.saveAs(resolve(out, `saved-${basis}.xlsx`));
    await viewer.screenshot({ path: resolve(out, `saved-${basis}.png`), style: 'header {visibility:hidden!important}' }); writeFileSync(resolve(out, `saved-${basis}.json`), JSON.stringify(capture));
  }
  const before = await page.evaluate(() => __savedQA.capture('snapshot:fictional-history:true').id);
  await viewer.getByText('Back to saved scenarios', { exact: true }).click(); await page.locator('[data-stage2-current="fictional-history"]').click();
  assert.equal(await page.evaluate(() => __savedQA.capture('snapshot:fictional-history:true').id), before);
  await page.evaluate(() => { const p = FFSStage1BrowserTestHooks.getPlan(); p.incomeItems[0].amount += 20000; FFSStage1BrowserTestHooks.setPlan(p, 'scenarios'); });
  assert.notEqual(await page.evaluate(() => __savedQA.capture('snapshot:fictional-history:true').id), before);
  await page.locator('[data-compare-scenario="fictional-history"]').click(); await page.locator('[data-compare-scenario="fictional-history-2"]').click();
  assert.equal(await page.locator('#scenarioComparisonReport [data-saved-support]').count(), 1);
  const two = await page.evaluate(() => __savedQA.capture('fictional-history:fictional-history-2'));
  assert.equal(two.data.sources.length, 2); assert.ok(two.data.sources.every(s => s.label.startsWith('Historical snapshot')));
  await page.locator('[data-stage2-view="fictional-retirement"]').click();
  const savedRetirement = await page.evaluate(() => __savedQA.capture('snapshot:fictional-retirement:false'));
  assert.match(savedRetirement.data.sources[0].label, /Saved retirement scenario/); assert.ok(savedRetirement.data.sources[0].figures.length > 0);
  assert.equal(await page.evaluate(() => JSON.stringify(__savedQA.stored())), stored);
  assert.deepEqual(errors, []); console.log('Saved: historical missing workings, retained values, genuine current-plan differences, both bases, saved retirement and reopen without history changes pass.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
