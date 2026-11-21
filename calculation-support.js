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
  function bytes(captured) { return global.FFSWeeklyPlannerExport.createSupportBytes(retirementTables(captured)); }
  global.FFSCalculationSupport = { capture, retirementTables, bytes };
})(globalThis);
