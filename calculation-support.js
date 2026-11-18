(function (global) {
  'use strict';
  const cell = value => typeof value === 'number' && Number.isFinite(value)
    ? { type: 'number', value, style: 0 } : { type: 'string', value: value == null ? 'Not retained' : String(value), style: 7 };
  const formula = (expression, value) => ({ formula: expression, cachedValue: value, style: 4 });
  const row = values => values.map(cell);
  const table = (name, headers, values = []) => ({ name, rows: [headers.map(value => ({ ...cell(value), style: 10 })), ...values.map(row)] });
  function flatten(value, path = '', entries = []) {
    if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, entries));
    else entries.push([path, value]);
    return entries;
  }
  // A capture is immutable and lives only in memory. Returning to a previous state
  // after an edit deliberately creates a new pair, rather than reusing an old ID.
  function capture(previous, payload) {
    const signature = JSON.stringify(payload);
    if (previous?.signature === signature) return previous;
    const data = JSON.parse(signature);
    const freeze = object => { if (object && typeof object === 'object') { Object.values(object).forEach(freeze); Object.freeze(object); } };
    freeze(data);
    return Object.freeze({ id: `CS-${global.crypto.randomUUID()}`, signature, data });
  }
  function retirementTables(captured) {
    const { scenarios, settings, figures } = captured.data;
    const overview = table('Overview', ['Calculation support', 'Value'], [
      ['Export ID', captured.id], ['Area', 'Retirement & Lifestyle'], ['Dollar basis', settings.basis],
      ['Coverage', 'Captured baseline and alternatives. Annual engine records are retained in detail.'],
      ['Workbook use', 'A captured calculation record, not a replacement retirement engine. Recalculate the plan in the app after editing inputs.'],
    ]);
    const inputs = table('Inputs', ['Scenario', 'Source', 'Input / resolved assumption', 'Value']);
    const annual = table('Annual funding', ['Scenario', 'Calendar year', 'Phase', 'Net cash income (nominal AUD)', 'Lifestyle spending', 'Required cashflow', 'Accessible withdrawals', 'Super withdrawals', 'Unallocated withdrawals', 'RET-01 · Annual funding gap', 'Accessible closing', 'Super closing', 'Net worth', 'Super access / work phases', 'Income tax', 'Medicare levy', 'Medicare surcharge', 'STSL', 'Age Pension estimate', 'Property event']);
    const detail = table('Engine detail', ['Scenario', 'Calendar year', 'Source path', 'Engine value', 'Coverage']);
    const workings = table('Balance workings', ['Scenario', 'Year', 'Account', 'Opening', 'Contributions', 'Earnings', 'Tax', 'Fees', 'Withdrawals', 'Calculated closing', 'Engine closing', 'Difference']);
    const conversion = table('Dollar conversion', ['Scenario', 'Year', 'Reference', 'Nominal engine value', 'Inflation rate', 'Years from start', 'Today’s Dollars', 'Selected basis value', 'Displayed value', 'Rounding difference']);
    const reconciliation = table('Reconciliation', ['Reference', 'Figure', 'Scenario / source', 'Period', 'Units', 'Calculation rule', 'Engine value', 'Display basis value', 'Displayed value', 'Difference']);
    const notes = table('Review notes', ['Review level', 'Scope / status'], [
      ['Arithmetic reconciles', 'Balance workings compares formula-based closing balances with captured engine balances. Review every Difference; tolerance AUD 0.01. This is not validation of tax or pension rules.'],
      ['Independently benchmarked', 'Not claimed by this export. No independent benchmark is attached.'],
      ['Professionally reviewed', 'Not reviewed. Reviewer, date and scope have not been supplied.'],
      ['Engine-supplied estimates', 'Income tax, Medicare, STSL, Age Pension eligibility and amounts, return timing, withdrawal allocation and property event rules are engine supplied; their underlying rules are outside workbook coverage.'],
      ['Funding bridge', 'Annual funding shows net cash income and withdrawals from accessible investments, super and unallocated cash before and after each person’s super access age. Retained property equity is not spending cash.'],
      ['Nominal and real', 'Engine detail and Balance workings use nominal AUD. Dollar conversion separately divides each nominal figure by (1 + inflation rate)^years from projection start.'],
      ['Missing values', 'Not retained is distinct from zero. Age Pension is only included when enabled and modelled in the captured scenario.'],
    ]);
    for (const scenario of scenarios) {
      for (const [path, value] of flatten({ inputs: scenario.inputs, resolvedAssumptions: scenario.result.assumptions, draft: scenario.draft })) inputs.rows.push(row([scenario.name, scenario.source, path, value]));
      const years = scenario.result.years || [];
      for (const year of years) {
        const h = year.household;
        annual.rows.push(row([scenario.name, year.calendarYear, year.householdPhase, h.netHouseholdCashIncome, h.totalProjectedLifestyleSpending, h.householdCashRequirement, h.totalAccessibleWithdrawal, h.totalSuperWithdrawal, h.unallocatedSurplusWithdrawal, h.unmetSpending, h.closingAccessibleInvestmentBalance, h.totalSuperBalance, h.totalNetWorth,
          year.people.map(p => `${p.name}: age ${p.age}; ${p.employmentPhase}; super access ${p.superAccessAge}`).join('; '),
          ...['incomeTax', 'medicareLevy', 'medicareLevySurcharge', 'stslRepayment'].map(key => year.people.reduce((sum, person) => sum + person[key], 0)),
          h.agePension?.unsupported ? 'Not estimated: unsupported circumstances' : h.estimatedAgePension ?? 'Not modelled', h.downsizeHomeEvent ? 'See Engine detail: household.downsizeHomeEvent' : 'None']));
        for (const [path, value] of flatten(year)) detail.rows.push(row([scenario.name, year.calendarYear, `result.years[${year.yearIndex}].${path}`, value, 'Engine-supplied estimate / retained engine record']));
        const accounts = [{ name: 'Accessible investments', r: h.accessibleReconciliation, super: false }, ...year.people.map(p => ({ name: `${p.name} super`, r: p.superReconciliation, super: true }))];
        for (const account of accounts) {
          const r = account.r;
          if (!r) continue;
          const contributions = account.super ? r.employerContributionGross + r.additionalContributionGross + r.downsizerContribution
            : r.plannedExternalAccessibleContribution + r.surplusToAccessibleInvestments + r.oneOffIncomeAccessibleContribution + r.downsizeAccessibleInvestmentContribution;
          const tax = account.super ? r.contributionsTax : 0;
          const withdrawal = account.super ? r.withdrawal : r.totalAccessibleInvestmentWithdrawal;
          const n = workings.rows.length + 1;
          const computed = Math.round((r.openingBalance + contributions + r.investmentEarnings - tax - r.fees - withdrawal) * 100) / 100;
          const cells = row([scenario.name, year.calendarYear, account.name, r.openingBalance, contributions, r.investmentEarnings, tax, r.fees, withdrawal]);
          cells.push(formula(`ROUND(D${n}+E${n}+F${n}-G${n}-H${n}-I${n},2)`, computed), cell(r.closingBalance), formula(`K${n}-J${n}`, r.closingBalance - computed));
          workings.rows.push(cells);
        }
        const rate = scenario.inputs.inflationRate;
        const elapsed = year.calendarYear - scenario.inputs.projectionStartYear;
        for (const [reference, field] of [['RET-01 · Annual funding gap', 'unmetSpending'], ['Net cash income', 'netHouseholdCashIncome'], ['Lifestyle spending', 'totalProjectedLifestyleSpending'], ['Accessible withdrawal', 'totalAccessibleWithdrawal'], ['Super withdrawal', 'totalSuperWithdrawal'], ['Accessible closing', 'closingAccessibleInvestmentBalance'], ['Super closing', 'totalSuperBalance'], ['Net worth', 'totalNetWorth']]) {
        const nominal = h[field];
        const real = nominal / (1 + rate) ** elapsed;
        const selected = settings.basis === 'today' ? real : nominal;
        const n = conversion.rows.length + 1;
        conversion.rows.push([...row([scenario.name, year.calendarYear, reference, nominal, rate, elapsed]),
          formula(`D${n}/(1+E${n})^F${n}`, real), formula(settings.basis === 'today' ? `G${n}` : `D${n}`, selected), cell(Math.round(selected)), formula(`I${n}-H${n}`, Math.round(selected) - selected)]);
        }
      }
    }
    for (const figure of figures) reconciliation.rows.push(row([figure.ref, figure.label, figure.source, figure.period, figure.units, figure.rule, figure.engine, figure.value, figure.display, typeof figure.value === 'number' ? Math.round(figure.value) - figure.value : 'Not numeric']));
    const tables = [overview, reconciliation, annual, conversion, workings, inputs, detail, notes];
    overview.widths = [30, 100]; notes.widths = [30, 100];
    inputs.widths = [28, 20, 70, 50]; detail.widths = [28, 14, 75, 30, 45];
    reconciliation.widths = [14, 45, 35, 22, 20, 65, 24, 24, 40, 24];
    for (const sheet of tables.slice(1)) overview.rows.push([cell(sheet.name), { formula: `HYPERLINK("#'${sheet.name}'!A1","Open worksheet")`, style: 7 }]);
    return tables;
  }
  function growthTables(captured) {
    const { scenarios, settings } = captured.data;
    const overview = table('Overview', ['Calculation support', 'Value'], [['Export ID', captured.id], ['Area', 'Growth Scenarios'], ['Selected year', settings.year], ['Dollar basis', settings.basis], ['Units', 'AUD balances at annual close; rates are percentages unless identified as decimal'], ['Coverage', 'Lower, Base and Higher from the exact displayed session. Annual engine balances are nominal; conversion is separate.']]);
    const inputs = table('Inputs and overrides', ['Scenario', 'Source', 'Setting', 'Value']);
    const annual = table('Annual balances', ['Scenario', 'Year', 'Age', 'Investments', 'Super', 'Home equity', 'Investment property equity', 'Other net assets or liabilities', 'Calculated net worth', 'Engine net worth', 'Difference']);
    const conversion = table('Dollar conversion', ['Scenario', 'Year', 'Reference / figure', 'Nominal AUD', 'Inflation decimal', 'Today’s Dollars', 'Selected basis', 'Displayed AUD', 'Rounding difference']);
    const reconcile = table('Selected year', ['Reference', 'Figure', 'Scenario', 'Period', 'Units', 'Source / rule', 'Engine nominal', 'Display basis value', 'Table / chart display', 'Difference']);
    const detail = table('Engine detail', ['Scenario', 'Source path', 'Value']);
    const notes = table('Review notes', ['Review level', 'Scope / status'], [['Arithmetic reconciles', 'Annual balances: sum the four reported asset categories plus other net assets/liabilities and compare with captured engine net worth. Residual assets/liabilities are engine supplied, not an independent benchmark.'], ['Independently benchmarked', 'Not claimed; no independent benchmark attached.'], ['Professionally reviewed', 'Not reviewed.'], ['Engine-supplied estimates', 'Investment/super compounding, contributions, property debt schedules, tax and plan-linked retirement calculations are engine supplied. Captured projection schedules identify their retained workings.'], ['Dollar conversion', 'Nominal / (1 + saved inflation decimal)^projection year. Selected-year rows reconcile the same value used for table, mobile cards and net-worth chart.'], ['Overrides', 'Each scenario records both requested rates/includeOverrides and the fully resolved cloned plan. Fixed asset overrides stay fixed unless explicitly included; zero overrides are preserved.']]);
    const fields = [['investments', 'Investments'], ['super', 'Super'], ['home', 'Home equity'], ['property', 'Investment property equity'], ['netWorth', 'Total net worth']];
    for (const scenario of scenarios) {
      for (const [path, value] of flatten({ requested: scenario.requested, resolvedPlan: scenario.plan })) inputs.rows.push(row([scenario.name, 'Current plan with session-only growth assumptions', path, value]));
      for (const [path, value] of flatten(scenario.workings)) detail.rows.push(row([scenario.name, path, value]));
      for (const source of scenario.rows) {
        const residual = source.netWorth - source.investments - source.super - source.home - source.property;
        const n = annual.rows.length + 1;
        annual.rows.push([...row([scenario.name, source.year, source.age, source.investments, source.super, source.home, source.property, residual]), formula(`SUM(D${n}:H${n})`, source.netWorth), cell(source.netWorth), formula(`J${n}-I${n}`, 0)]);
        fields.forEach(([key, label], index) => {
          const nominal = source[key], real = nominal / (1 + settings.inflation / 100) ** source.year;
          const selected = settings.basis === 'today' ? real : nominal;
          const r = conversion.rows.length + 1, ref = `GRO-0${index + 1}`;
          conversion.rows.push([...row([scenario.name, source.year, `${ref} · ${label}`, nominal, settings.inflation / 100]), formula(`D${r}/(1+E${r})^B${r}`, real), formula(settings.basis === 'today' ? `F${r}` : `D${r}`, selected), cell(Math.round(selected)), formula(`H${r}-G${r}`, Math.round(selected) - selected)]);
          if (source.year === settings.year) reconcile.rows.push(row([ref, label, scenario.name, `Projection year ${source.year} / age ${source.age}`, 'AUD', `rows[year=${source.year}].${key}; nominal or discounted; whole-dollar formatting`, nominal, scenario.displayed[key], scenario.formatted[key], Math.round(scenario.displayed[key]) - selected]));
        });
      }
    }
    const tables = [overview, reconcile, annual, conversion, inputs, detail, notes];
    overview.widths = notes.widths = [32, 100]; inputs.widths = [20, 45, 75, 40]; detail.widths = [20, 85, 40];
    reconcile.widths = [15, 35, 20, 30, 16, 70, 25, 25, 25, 25];
    for (const sheet of tables.slice(1)) overview.rows.push([cell(sheet.name), { formula: `HYPERLINK("#'${sheet.name}'!A1","Open worksheet")`, style: 7 }]);
    return tables;
  }
  function savedReference(label) {
    let hash = 2166136261;
    for (const char of label) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return `SAV-${(hash >>> 0).toString(16).toUpperCase()}`;
  }
  function savedTables(captured) {
    const { sources, settings, comparison } = captured.data;
    const overview = table('Overview', ['Calculation support', 'Value'], [['Export ID', captured.id], ['Area', 'Saved Scenarios'], ['Display basis', settings.basis], ['Scope', 'Only the saved snapshot or comparison identified below. Historical results are not recalculated.']]);
    const results = table('Results and reconciliation', ['Reference', 'Figure', 'Source', 'Period', 'Units', 'Calculation rule', 'Underlying retained value', 'Display basis value', 'Exact displayed value', 'Difference']);
    const inputs = table('Inputs and assumptions', ['Source', 'Path', 'Retained value']);
    const workings = table('Retained workings', ['Source', 'Path', 'Value']);
    const differences = table('Financial differences', ['Input', 'Current plan', 'Saved plan']);
    const conversion = table('Dollar conversion', ['Reference', 'Source', 'Nominal AUD', 'Inflation decimal', 'Projection years', 'Today’s Dollars', 'Selected basis value', 'Captured value', 'Difference']);
    const comparisonSheet = table('Comparison', ['Reference', 'Figure', sources[0]?.label || 'Source 1', sources[1]?.label || 'Source 2', 'Source 1 numeric', 'Source 2 numeric', 'Difference: source 2 minus 1', 'Units / period']);
    const notes = table('Review notes', ['Review level', 'Scope / status'], [['Arithmetic reconciles', 'Numeric comparison differences use source 2 minus source 1. Missing values remain unavailable and are never replaced by zero. Display rounding is reported separately.'], ['Independently benchmarked', 'Not claimed.'], ['Professionally reviewed', 'Not reviewed.'], ['Historical scope', 'Retained snapshots may omit annual calculations. Current engine calculations must not be substituted for missing historical workings.'], ['Engine-supplied estimates', 'Current plan workings and saved retirement outputs are supplied by their respective engines. Tax/pension algorithms and historical model rules are outside workbook coverage.'], ['Dollar basis', 'Converted forecast figures use each source’s inflation and period. Original retained values remain in the underlying-value column. Text-only historical values cannot be reliably converted.']]);
    for (const source of sources) {
      overview.rows.push(row([source.label, `${source.name}; saved ${source.savedAt || 'current session'}; calculation ${source.version || 'not retained'}`]));
      for (const figure of source.figures) {
        results.rows.push(row([figure.ref, figure.label, source.label, figure.period, figure.units, figure.rule, figure.engine, figure.value, figure.display, typeof figure.value === 'number' ? Math.round(figure.value) - figure.value : 'Not numeric / unavailable']));
        if (typeof figure.engine === 'number' && figure.units.startsWith('AUD') && typeof figure.value === 'number') {
          const n = conversion.rows.length + 1;
          const rate = Number.isFinite(figure.rate) && figure.rate > -100 ? figure.rate / 100 : 0;
          const real = figure.engine / (1 + rate) ** figure.years;
          const selected = settings.basis === 'today' ? real : figure.engine;
          conversion.rows.push([...row([figure.ref, source.label, figure.engine, rate, figure.years]), formula(`C${n}/(1+D${n})^E${n}`, real), formula(settings.basis === 'today' ? `F${n}` : `C${n}`, selected), cell(figure.value), formula(`H${n}-G${n}`, figure.value - selected)]);
        }
      }
      for (const [path, value] of flatten(source.inputs)) inputs.rows.push(row([source.label, path, value]));
      if (!source.workings) workings.rows.push(row([source.label, 'Coverage', 'Workings unavailable for this snapshot']));
      for (const [path, value] of flatten(source.workings || source.retained || {})) workings.rows.push(row([source.label, path, value]));
    }
    for (const diff of captured.data.inputDifferences || []) differences.rows.push(row([diff.path, diff.current, diff.saved]));
    for (const item of comparison || []) {
      const n = comparisonSheet.rows.length + 1;
      const numeric = typeof item.left === 'number' && typeof item.right === 'number';
      comparisonSheet.rows.push([...row([item.ref, item.label, item.leftDisplay, item.rightDisplay, item.left, item.right]), numeric ? formula(`F${n}-E${n}`, item.right - item.left) : cell('Not comparable: value not retained'), cell(item.units)]);
    }
    const tables = [overview, results, comparisonSheet, conversion, inputs, workings, differences, notes];
    overview.widths = notes.widths = [40, 100]; inputs.widths = workings.widths = [45, 80, 55]; differences.widths = [70, 50, 50]; results.widths = [22, 45, 45, 25, 20, 70, 25, 25, 45, 25]; comparisonSheet.widths = [22, 40, 50, 50, 25, 25, 30, 30];
    for (const sheet of tables.slice(1)) overview.rows.push([cell(sheet.name), { formula: `HYPERLINK("#'${sheet.name}'!A1","Open worksheet")`, style: 7 }]);
    return tables;
  }
  function changeTables(captured) {
    const data = captured.data, { settings } = data;
    const overview = table('Overview', ['Calculation support', 'Value'], [['Export ID', captured.id], ['Area', `Try a Change — ${data.mode}`], ['Current Plan source', settings.sourceLabel], ['Dollar basis', settings.basis], ['Difference direction', 'Adjusted Plan minus Current Plan. Positive, negative and zero values are retained.']]);
    const results = table('Results and reconciliation', ['Reference', 'Figure', 'Period', 'Units', 'Source / rule', 'Engine Current Plan', 'Engine Adjusted Plan', 'Current Plan', 'Adjusted Plan', 'Difference', 'Captured difference', 'Arithmetic discrepancy', 'Displayed Current Plan', 'Displayed Adjusted Plan', 'Displayed Difference', 'Current rounding difference', 'Adjusted rounding difference']);
    const conversion = table('Dollar conversion', ['Reference', 'Source', 'Nominal engine value', 'Inflation decimal', 'Years', 'Today’s Dollars', 'Selected basis', 'Captured value', 'Difference']);
    const inputs = table('Inputs and changes', ['Source / stage', 'Path', 'Value']);
    const workings = table('Engine workings', ['Source / stage', 'Path', 'Engine-supplied value']);
    const cash = table('Cashflow bridge', ['Reference / stage', 'Period / units', 'Value', 'Rule / coverage', 'Exact displayed value', 'Display rounding difference']);
    const display = table('Additional displayed details', ['Position', 'Exact displayed text']);
    const notes = table('Review notes', ['Review level', 'Scope / status'], [['Arithmetic reconciles', 'Difference and dollar conversion formulas are independently recalculated in Excel. Display rounding is separate from underlying precision.'], ['Independently benchmarked', 'Not claimed. Engine financial rules have not been independently benchmarked by this workbook.'], ['Professionally reviewed', 'Not reviewed.'], ['Engine-supplied estimates', 'Projection balances, tax, Medicare, STSL, debt and super outputs are captured engine estimates. Their underlying algorithms are outside workbook formula coverage; retained engine schedules are included.'], ['Cashflow stages', 'The initial preset/custom effect precedes allocation. Income/expense savings use cash before investing; other changes use final cash. Final cash after allocation is a separate measure.'], ['Changes', 'Requested changes, resolved adjustments, both complete plans and the initial and final engine workings show how a preset or custom change flows through the reported result.'], ['Dollar basis', 'Nominal engine values are retained. Future balances are discounted by each plan’s inflation and projection year. Current cashflows are not discounted.']]);
    for (const f of data.figures) {
      const n = results.rows.length + 1;
      results.rows.push([...row([f.ref, f.label, f.period, f.units, f.rule, f.engineCurrent, f.engineAdjusted, f.current, f.adjusted]), formula(`I${n}-H${n}`, f.difference), cell(f.difference), formula(`J${n}-K${n}`, 0), ...row([f.displayCurrent, f.displayAdjusted, f.displayDifference, Math.round(f.current) - f.current, Math.round(f.adjusted) - f.adjusted])]);
      for (const [source, engine, value, inflation] of [['Current Plan', f.engineCurrent, f.current, settings.inflationCurrent], ['Adjusted Plan', f.engineAdjusted, f.adjusted, settings.inflationAdjusted]]) {
        const n = conversion.rows.length + 1, rate = (Number(inflation) || 0) / 100, real = engine / (1 + rate) ** f.years;
        conversion.rows.push([...row([f.ref, source, engine, rate, f.years]), formula(`C${n}/(1+D${n})^E${n}`, real), formula(settings.basis === 'today' ? `F${n}` : `C${n}`, value), cell(value), formula(`H${n}-G${n}`, 0)]);
      }
    }
    for (const [source, values] of [['Requested and resolved changes', data.changes], ['Current Plan', data.currentPlan], ['Adjusted Plan', data.adjustedPlan]]) for (const [path, value] of flatten(values)) inputs.rows.push(row([source, path, value]));
    for (const [source, values] of [['Current Plan', data.currentWorkings], ['Initial change before allocation', data.initialWorkings], ['Adjusted Plan', data.adjustedWorkings]]) if (values) for (const [path, value] of flatten(values)) workings.rows.push(row([source, path, value]));
    if (data.cashflow) {
      const c = data.cashflow;
      cash.rows.push(row(['Current cashflow', 'AUD/year', c.current, c.isCashflowSaving ? 'Cash before investing' : 'Final cashflow']));
      cash.rows.push(row(['Initial changed cashflow', 'AUD/year', c.initial, 'Before allocating the change']));
      cash.rows.push([cell('CHG-C3 · Annual cashflow effect'), cell('AUD/year'), formula('C3-C2', c.annualCashflowImpact), cell('Initial minus current'), cell(c.displayed?.[2]), cell(Math.sign(c.annualCashflowImpact) * Math.round(Math.abs(c.annualCashflowImpact)) - c.annualCashflowImpact)]);
      cash.rows.push([cell('CHG-C1 · Weekly cashflow effect'), cell('AUD/week'), formula('C4/52', c.annualCashflowImpact / 52), cell('Annual effect / 52'), cell(c.displayed?.[0]), cell(Math.sign(c.annualCashflowImpact) * Math.round(Math.abs(c.annualCashflowImpact / 52)) - c.annualCashflowImpact / 52)]);
      cash.rows.push([cell('CHG-C2 · Monthly cashflow effect'), cell('AUD/month'), formula('C4/12', c.annualCashflowImpact / 12), cell('Annual effect / 12'), cell(c.displayed?.[1]), cell(Math.sign(c.annualCashflowImpact) * Math.round(Math.abs(c.annualCashflowImpact / 12)) - c.annualCashflowImpact / 12)]);
      cash.rows.push(row(['Investment absorption', 'AUD/year', c.investmentAbsorption, 'Engine-resolved investment allocation']));
      cash.rows.push(row(['Available to allocate', 'AUD/year', c.allocatable, 'Resolved engine value before final allocation']));
      cash.rows.push(row(['Adjusted Plan final cash', 'AUD/year', c.finalCash, 'After all selected changes and allocations']));
    }
    (data.displayedDetails || []).forEach((text, index) => display.rows.push(row([index + 1, text])));
    const tables = [overview, results, conversion, cash, inputs, workings, display, notes];
    overview.widths = notes.widths = display.widths = [35, 110]; inputs.widths = workings.widths = [35, 80, 55]; cash.widths = [45, 25, 25, 90]; results.widths = [24, 35, 25, 20, 85, ...Array(12).fill(27)];
    for (const sheet of tables.slice(1)) overview.rows.push([cell(sheet.name), { formula: `HYPERLINK("#'${sheet.name}'!A1","Open worksheet")`, style: 7 }]);
    return tables;
  }
  function bytes(captured) { return global.FFSWeeklyPlannerExport.createSupportBytes(captured.data.area === 'change' ? changeTables(captured) : captured.data.area === 'saved' ? savedTables(captured) : captured.data.area === 'growth' ? growthTables(captured) : retirementTables(captured)); }
  global.FFSCalculationSupport = { capture, retirementTables, growthTables, savedTables, changeTables, savedReference, bytes };
})(globalThis);
