import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { investmentReturnFixture } from './investment-return-fixture.mjs';
const root = resolve('.'), out = resolve('outputs/calculation-support/growth'); mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end('{"enabled":false}'); return; }
  const file = resolve(root, '.' + (p === '/' ? '/index.html' : p));
  if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let data = readFileSync(file);
    if (p === '/growth-scenarios-view.js') data = data.toString().replace("const id = make('p',", "window.__growthSupport = supportCapture; const id = make('p',");
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(file)] || 'text/plain'); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  await page.addInitScript(() => { window.FFS_STAGE1_BROWSER_TESTS_ENABLED = true; });
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.waitForFunction(() => window.FFSStage1BrowserTestHooks);
  await page.evaluate(plan => { FFSStage1BrowserTestHooks.setPlan(plan, 'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-freedom-future="growth"]').click(); }, investmentReturnFixture());
  await page.waitForFunction(() => window.__growthSupport);
  const original = await page.evaluate(() => __growthSupport);
  const stored = await page.evaluate(() => JSON.stringify(FFSStage1BrowserTestHooks.getPlan()));
  await page.locator('[data-growth-overrides="Higher"]').check();
  const changed = await page.evaluate(() => __growthSupport); assert.notEqual(changed.id, original.id);
  assert.ok(changed.data.scenarios[2].requested.includeOverrides);
  assert.notEqual(changed.data.scenarios[2].rows.at(-1).netWorth, original.data.scenarios[2].rows.at(-1).netWorth);
  await page.locator('[data-growth-scenario="Base"][data-growth-field="expectedSuperReturnPct"]').fill('0');
  const edited = await page.evaluate(() => __growthSupport); assert.notEqual(changed.id, edited.id); assert.equal(edited.data.scenarios[1].requested.values.expectedSuperReturnPct, 0);
  await page.locator('[data-growth-year]').selectOption('20');
  assert.notEqual(await page.evaluate(() => __growthSupport.id), edited.id);
  for (const basis of ['future', 'today']) {
    await page.evaluate(b => document.querySelector(`[data-dollar-basis="${b}"]`).click(), basis);
    const capture = await page.evaluate(() => __growthSupport);
    for (const scenario of capture.data.scenarios) {
      const nominal = scenario.rows.find(r => r.year === capture.data.settings.year);
      for (const key of ['investments', 'super', 'home', 'property', 'netWorth']) {
        const expected = nominal[key] / (basis === 'today' ? (1 + capture.data.settings.inflation / 100) ** nominal.year : 1);
        assert.ok(Math.abs(expected - scenario.displayed[key]) < .00001);
        assert.ok((await page.locator('.growth-table').textContent()).includes(scenario.formatted[key]));
      }
      assert.equal(await page.locator(`.growth-bar-row meter[aria-label^="${scenario.name} "]`).getAttribute('value'), String(scenario.displayed.netWorth));
    }
    const downloadPromise = page.waitForEvent('download'); await page.locator('[data-growth-support]').click();
    const download = await downloadPromise; assert.equal(download.suggestedFilename(), capture.id + '.xlsx'); await download.saveAs(resolve(out, `growth-${basis}.xlsx`));
    await page.locator('.growth-output').screenshot({ path: resolve(out, `growth-${basis}.png`) });
    writeFileSync(resolve(out, `growth-${basis}.json`), JSON.stringify(capture));
  }
  assert.equal(await page.evaluate(() => JSON.stringify(FFSStage1BrowserTestHooks.getPlan())), stored);
  assert.deepEqual(errors, []); console.log('Growth: overrides, explicit zero, selected year, both bases, table/chart parity, ID changes and plan preservation pass.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
