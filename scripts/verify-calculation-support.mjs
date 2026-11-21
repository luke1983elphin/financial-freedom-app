import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reportFixture } from './report-fixture.mjs';
const root = resolve('.'), out = resolve(process.argv[2] || 'outputs/calculation-support');
mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.FFS_PLAYWRIGHT_MODULE).href);
const hook = `window.__supportQA = {
 capture:()=>retirementSupportCapture,
 configure:fields=>{for(const [path,value] of Object.entries(fields)) FFSSemiRetirementUi.setDraftPath(semiRetirementScenarioDraft,path,value);calculateSemiRetirementScenario();},
 compare:()=>createSemiRetirementComparisonScenario(),
 print:()=>printSemiRetirementComparisonPdf(),
 render:()=>renderOutputs(),
 basis:value=>document.querySelector('[data-dollar-basis='+value+']').click(),
};`;
const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end('{"enabled":false}'); return; }
  const file = resolve(root, '.' + (p === '/' ? '/index.html' : p));
  if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  try {
    let data = readFileSync(file);
    if (p === '/app.js') data = data.toString().replace('  window.addEventListener("storage", (event) => {', hook + '\n  window.addEventListener("storage", (event) => {');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(file)] || 'text/plain'); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.addInitScript(() => { window.FFS_STAGE1_BROWSER_TESTS_ENABLED = true; window.print = () => {}; window.confirm = () => true; });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__supportQA);
  await page.evaluate(plan => { FFSStage1BrowserTestHooks.setPlan(plan, 'semiretirement'); FFSStage1BrowserTestHooks.closeDurabilityDialog(); document.querySelector('[data-semi-action="calculate"]').click(); }, reportFixture());
  const first = await page.evaluate(() => __supportQA.capture()); assert.ok(first.id);
  await page.evaluate(() => __supportQA.render());
  assert.equal(await page.evaluate(() => __supportQA.capture().id), first.id);
  await page.evaluate(() => __supportQA.configure({ 'people.0.hasSemiRetirement': true, 'people.0.semiRetirementAge': 50, 'people.0.fullRetirementAge': 55, 'household.fullRetirementLifestyleSpending': 250000 }));
  const edited = await page.evaluate(() => __supportQA.capture()); assert.notEqual(edited.id, first.id);
  assert.ok(edited.data.scenarios[0].result.years.some(y => y.household.unmetSpending > 0), 'Fictional funding gap');
  await page.evaluate(() => __supportQA.compare());
  const compared = await page.evaluate(() => __supportQA.capture()); assert.equal(compared.data.scenarios.length, 2); assert.notEqual(compared.id, edited.id);
  for (const basis of ['future', 'today']) {
    await page.evaluate(basis => __supportQA.basis(basis), basis);
    // Printing may refresh comparison inputs; capture and download the resulting pair.
    await page.evaluate(() => __supportQA.print());
    const capture = await page.evaluate(() => __supportQA.capture());
    const printText = await page.locator('.semi-retirement-comparison-print-report').textContent();
    assert.ok(printText.includes(capture.id));
    const screenText = await page.locator('[data-semi-results-dashboard]').textContent();
    for (const figure of capture.data.figures) assert.ok((Number(figure.ref.slice(4)) >= 20 ? screenText : printText).includes(figure.display), `${figure.ref}: ${figure.display}`);
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-semi-action="download-calculation-support"]').first().click();
    const download = await downloadPromise; assert.equal(download.suggestedFilename(), capture.id + '.xlsx');
    await download.saveAs(resolve(out, `retirement-${basis}.xlsx`));
    await page.evaluate(() => __supportQA.print());
    assert.equal(await page.evaluate(() => __supportQA.capture().id), capture.id);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: resolve(out, `retirement-${basis}.pdf`), format: 'A4', preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    writeFileSync(resolve(out, `retirement-${basis}.json`), JSON.stringify(capture, null, 2));
    const tables = await page.evaluate(() => FFSCalculationSupport.retirementTables(__supportQA.capture()));
    const balances = tables.find(t => t.name === 'Balance workings');
    assert.ok(balances.rows.slice(1).every(r => Math.abs(r[11].cachedValue) < .011));
  }
  assert.deepEqual(errors, []);
  console.log('Retirement: exact rendered comparison, ID lifecycle, funding gap, nominal/real basis and balance arithmetic passed.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
