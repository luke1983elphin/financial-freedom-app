(function attachWeeklyPlannerExport(global) {
  const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const STYLE = {
    normal: 0,
    title: 1,
    section: 2,
    header: 3,
    currency: 4,
    totalCurrency: 5,
    warningCurrency: 6,
    note: 7,
    date: 8,
    percent: 9,
  };

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function colName(index) {
    let n = index;
    let name = "";
    while (n > 0) {
      const remainder = (n - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function cellRef(row, col) {
    return `${colName(col)}${row}`;
  }

  function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function text(value, style = STYLE.normal) {
    return { value: String(value ?? ""), style, type: "string" };
  }

  function number(value, style = STYLE.normal) {
    return { value: asNumber(value), style, type: "number" };
  }

  function formula(value, style = STYLE.normal) {
    return { formula: String(value || "0").replace(/^=/, ""), style };
  }

  function blank(style = STYLE.normal) {
    return { value: "", style, type: "blank" };
  }

  function numberOrText(value, style = STYLE.currency, emptyText = "Not recorded") {
    return value === null || value === undefined || value === ""
      ? text(emptyText, STYLE.note)
      : number(value, style);
  }

  function moneyValue(value) {
    return asNumber(value).toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    });
  }

  function shortDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }

  function weekHeading(week) {
    return `Week ${week.week}\n${shortDate(week.startDateIso)}`;
  }

  function makeRows(width, rows) {
    return rows.map((row) => {
      const copy = row.slice();
      while (copy.length < width) copy.push(null);
      return copy;
    });
  }

  function cellXml(cell, rowIndex, colIndex) {
    if (!cell) return "";
    const reference = cellRef(rowIndex, colIndex);
    const style = Number.isInteger(cell.style) ? ` s="${cell.style}"` : "";
    if (cell.formula !== undefined) {
      const cachedValue = cell.cachedValue !== undefined ? `<v>${escapeXml(cell.cachedValue)}</v>` : "";
      return `<c r="${reference}"${style}><f>${escapeXml(cell.formula)}</f>${cachedValue}</c>`;
    }
    if (cell.type === "blank") return `<c r="${reference}"${style}/>`;
    if (cell.type === "number") return `<c r="${reference}"${style}><v>${asNumber(cell.value)}</v></c>`;
    return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
  }

  function rowsXml(rows) {
    return rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      return `<row r="${rowNumber}">${row.map((cell, colIndex) => cellXml(cell, rowNumber, colIndex + 1)).join("")}</row>`;
    }).join("");
  }

  function sheetXml(rows, options = {}) {
    const width = Math.max(...rows.map((row) => row.length), 1);
    const height = rows.length || 1;
    const dimensions = `A1:${cellRef(height, width)}`;
    const cols = options.cols || [];
    const colsXml = cols.length
      ? `<cols>${cols.map((col, index) => `<col min="${index + 1}" max="${index + 1}" width="${col}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const panes = options.freeze
      ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${options.freeze.cols || 0}" ySplit="${options.freeze.rows || 0}" topLeftCell="${options.freeze.topLeftCell || "A1"}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const conditional = options.conditionalFormatting || "";
    return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensions}"/>
  ${panes}
  ${colsXml}
  <sheetData>${rowsXml(rows)}</sheetData>
  ${conditional}
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="${options.orientation || "landscape"}" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  function buildStartHere(planner) {
    const assumptions = planner.assumptions || [];
    const rows = [
      [text("Financial Freedom Weekly Money Plan", STYLE.title), blank(), blank()],
      [blank(), blank(), blank()],
      [text("Household", STYLE.header), text(planner.householdName || "Current plan"), blank()],
      [text("Planner start date", STYLE.header), text(shortDate(planner.startDateIso)), blank()],
      [text("Planner duration", STYLE.header), text(`${planner.weeks.length} weeks`), blank()],
      [text("Generated", STYLE.header), text(shortDate(planner.generatedAtIso)), blank()],
      [blank(), blank(), blank()],
      [text("How to use this planner", STYLE.section), blank(STYLE.section), blank(STYLE.section)],
      [text("This workbook converts your Financial Freedom plan into a practical weekly money plan. Review each week, complete the planned transfers and update the spreadsheet when your income or expenses change.", STYLE.note), blank(), blank()],
      [text("Estimated net pay is based on the income, tax, Medicare levy, HELP and salary-sacrifice information entered in the Financial Plan. Actual payroll amounts may differ.", STYLE.note), blank(), blank()],
      [text("Weekly amounts set aside", STYLE.section), blank(STYLE.section), blank(STYLE.section)],
      [text("Where exact bill dates are not entered, the planner uses an estimated amount set aside instead of pretending the bill is paid on a specific date.", STYLE.note), blank(), blank()],
      [text("Key assumptions", STYLE.section), blank(STYLE.section), blank(STYLE.section)],
      [text("Assumption", STYLE.header), text("Value", STYLE.header), text("Notes", STYLE.header)],
      ...assumptions.map((item) => [text(item.label), text(item.value), text(item.note || "")]),
      [blank(), blank(), blank()],
      [text("Disclaimer", STYLE.section), blank(STYLE.section), blank(STYLE.section)],
      [text("This planner is a guide based on the information entered by the user. Actual income, expenses, interest rates, investment returns and payment dates may differ. Users should review and update the planner for their own circumstances.", STYLE.note), blank(), blank()],
    ];
    return {
      name: "Start Here",
      xml: sheetXml(makeRows(3, rows), { cols: [28, 28, 64], orientation: "portrait" }),
    };
  }

  function buildWeeklyPlanner(planner) {
    const weeks = planner.weeks;
    const width = 2 + weeks.length;
    planner.lookupRows = planner.lookupRows || {};
    const rows = [
      [text("Weekly Planner", STYLE.title), blank(), ...weeks.map((week) => text(weekHeading(week), STYLE.header))],
      [text("Money item", STYLE.header), text("Frequency", STYLE.header), ...weeks.map((week) => text(shortDate(week.startDateIso), STYLE.header))],
    ];
    const meta = {};

    function addSection(key, label, items) {
      rows.push([text(label, STYLE.section), blank(STYLE.section), ...weeks.map(() => blank(STYLE.section))]);
      const firstRow = rows.length + 1;
      items.forEach((item) => {
        const rowNumber = rows.length + 1;
        if (item.rowKey) planner.lookupRows[`${item.rowKey}Row`] = rowNumber;
        rows.push([
          text(item.name),
          text(item.frequencyLabel || item.frequency || ""),
          ...weeks.map((_, index) => number(item.values[index] || 0, STYLE.currency)),
        ]);
      });
      const lastRow = rows.length;
      const totalRow = rows.length + 1;
      rows.push([
        text(`Total ${label.toLowerCase()}`, STYLE.header),
        blank(STYLE.header),
        ...weeks.map((_, index) => {
          const col = colName(index + 3);
          return firstRow <= lastRow
            ? formula(`SUM(${col}${firstRow}:${col}${lastRow})`, STYLE.totalCurrency)
            : number(0, STYLE.totalCurrency);
        }),
      ]);
      meta[`${key}StartRow`] = firstRow;
      meta[`${key}EndRow`] = lastRow;
      meta[`${key}TotalRow`] = totalRow;
      return totalRow;
    }

    addSection("receipts", "Money coming in", planner.sections.receipts);
    addSection("essential", "Bills and spending", planner.sections.essential);
    addSection("provisions", "Provisions", planner.sections.provisions || []);
    addSection("discretionary", "Lifestyle spending", planner.sections.discretionary);
    addSection("transfers", "Financial Freedom transfers", planner.sections.transfers);

    rows.push([text("Weekly balance", STYLE.section), blank(STYLE.section), ...weeks.map(() => blank(STYLE.section))]);
    const openingRow = rows.length + 1;
    rows.push([
      text("Opening everyday bank balance"),
      text("Calculated"),
      ...weeks.map((_, index) => index === 0
        ? number(planner.startingBalance, STYLE.currency)
        : formula(`${colName(index + 2)}${meta.closingRow || openingRow + 5}`, STYLE.currency)),
    ]);
    const addReceiptsRow = rows.length + 1;
    rows.push([text("Add money coming in"), text("Calculated"), ...weeks.map((_, index) => formula(`${colName(index + 3)}${meta.receiptsTotalRow}`, STYLE.currency))]);
    const lessEssentialRow = rows.length + 1;
    rows.push([text("Less bills and spending"), text("Calculated"), ...weeks.map((_, index) => formula(`${colName(index + 3)}${meta.essentialTotalRow}`, STYLE.currency))]);
    const lessDiscretionaryRow = rows.length + 1;
    rows.push([text("Less provisions"), text("Calculated"), ...weeks.map((_, index) => formula(`${colName(index + 3)}${meta.provisionsTotalRow}`, STYLE.currency))]);
    const lessTransfersRow = rows.length + 1;
    rows.push([text("Less lifestyle spending"), text("Calculated"), ...weeks.map((_, index) => formula(`${colName(index + 3)}${meta.discretionaryTotalRow}`, STYLE.currency))]);
    const lessFreedomTransfersRow = rows.length + 1;
    rows.push([text("Less Financial Freedom transfers"), text("Calculated"), ...weeks.map((_, index) => formula(`${colName(index + 3)}${meta.transfersTotalRow}`, STYLE.currency))]);
    const closingRow = rows.length + 1;
    rows.push([
      text("Expected closing everyday bank balance", STYLE.header),
      text("Calculated", STYLE.header),
      ...weeks.map((_, index) => {
        const col = colName(index + 3);
        return formula(`${col}${openingRow}+${col}${addReceiptsRow}-${col}${lessEssentialRow}-${col}${lessDiscretionaryRow}-${col}${lessTransfersRow}-${col}${lessFreedomTransfersRow}`, STYLE.totalCurrency);
      }),
    ]);
    rows.push([blank(), blank(), ...weeks.map(() => blank())]);
    rows.push([text("Actuals and reconciliation", STYLE.section), blank(STYLE.section), ...weeks.map(() => blank(STYLE.section))]);
    rows.push([text("Week status"), text("Recorded"), ...weeks.map((week) => text(week.statusLabel || (week.isCompleted ? "Completed" : "Forecast")))]); 
    rows.push([text("Actual opening balance"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualOpeningBalance))]);
    rows.push([text("Actual money in"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualReceiptsTotal))]);
    rows.push([text("Actual bills"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualEssentialTotal))]);
    rows.push([text("Actual provisions"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualProvisionsTotal))]);
    rows.push([text("Actual lifestyle spending"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualDiscretionaryTotal))]);
    rows.push([text("Actual transfers out"), text("Recorded"), ...weeks.map((week) => numberOrText(week.actualTransfersTotal))]);
    rows.push([text("Calculated actual closing balance"), text("Calculated"), ...weeks.map((week) => numberOrText(week.actualClosingBalance))]);
    rows.push([text("Bank balance entered by user"), text("Recorded"), ...weeks.map((week) => numberOrText(week.enteredBankBalance))]);
    rows.push([text("Reconciliation difference"), text("Calculated"), ...weeks.map((week) => numberOrText(week.reconciliationDifference, Math.abs(asNumber(week.reconciliationDifference)) > 0.01 ? STYLE.warningCurrency : STYLE.currency, "Not entered"))]);
    meta.openingRow = openingRow;
    meta.closingRow = closingRow;
    meta.addReceiptsRow = addReceiptsRow;
    meta.lessEssentialRow = lessEssentialRow;
    meta.lessDiscretionaryRow = lessDiscretionaryRow;
    meta.lessTransfersRow = lessTransfersRow;
    meta.lessFreedomTransfersRow = lessFreedomTransfersRow;

    const lastCol = colName(width);
    const conditionalFormatting = `<conditionalFormatting sqref="C${closingRow}:${lastCol}${closingRow}"><cfRule type="cellIs" dxfId="0" priority="1" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting>`;

    return {
      name: "Weekly Planner",
      meta,
      xml: sheetXml(makeRows(width, rows), {
        cols: [34, 20, ...weeks.map(() => 14)],
        freeze: { rows: 2, cols: 2, topLeftCell: "C3" },
        conditionalFormatting,
      }),
    };
  }

  function buildWeeklyActionPlan(planner) {
    const rows = [
      [text("Weekly Money Plan", STYLE.title), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank()],
      [
        text("Week", STYLE.header),
        text("Week commencing", STYLE.header),
        text("Estimated net money in", STYLE.header),
        text("Bills and spending", STYLE.header),
        text("Provisions", STYLE.header),
        text("Transfer to offset", STYLE.header),
        text("Invest", STYLE.header),
        text("Contribute to super", STYLE.header),
        text("Expected closing bank balance", STYLE.header),
        text("Weekly priority", STYLE.header),
        text("Income received", STYLE.header),
        text("Bills paid", STYLE.header),
        text("Investing done", STYLE.header),
        text("Super done", STYLE.header),
      ],
      ...planner.weeks.map((week) => [
        number(week.week),
        text(shortDate(week.startDateIso), STYLE.date),
        number(week.receiptsTotal, STYLE.currency),
        number(week.essentialTotal + week.discretionaryTotal, STYLE.currency),
        number(week.provisionsTotal || 0, STYLE.currency),
        number(week.offsetTransferTotal, STYLE.currency),
        number(week.investmentTransferTotal, STYLE.currency),
        number(week.superTransferTotal, STYLE.currency),
        number(week.closingBalance, week.closingBalance < 0 ? STYLE.warningCurrency : STYLE.currency),
        text(week.priority, STYLE.note),
        text("\u2610"),
        text("\u2610"),
        text("\u2610"),
        text("\u2610"),
      ]),
    ];
    return {
      name: "Weekly Money Plan",
      xml: sheetXml(makeRows(14, rows), {
        cols: [10, 18, 16, 16, 18, 16, 14, 17, 19, 58, 15, 12, 14, 12],
        freeze: { rows: 2, cols: 2, topLeftCell: "C3" },
      }),
    };
  }

  function buildWealthSnapshot(planner, weeklyMeta) {
    const snapshot = planner.snapshot || {};
    const rows = [
      [text("Wealth Snapshot", STYLE.title), blank(), blank(), blank(), blank()],
      [text("Item", STYLE.header), text("Starting balance", STYLE.header), text("Planned change", STYLE.header), text("Estimated ending balance", STYLE.header), text("Notes", STYLE.header)],
      [text("Everyday bank account"), number(planner.startingBalance, STYLE.currency), number(asNumber(snapshot.endingBankBalance) - asNumber(planner.startingBalance), STYLE.currency), number(snapshot.endingBankBalance, STYLE.currency), text("Reconciles to the final planner week.")],
      [text("Offset account"), number(snapshot.offsetBalance, STYLE.currency), number(snapshot.offsetChange, STYLE.currency), formula("B4+C4", STYLE.currency), text("Includes planned or completed offset transfers.")],
      [text("Cash savings"), number(snapshot.cashSavings, STYLE.currency), number(0, STYLE.currency), formula("B5+C5", STYLE.currency), text("Existing cash entered in the plan.")],
      [text("Shares and investments"), number(snapshot.investmentBalance, STYLE.currency), number(snapshot.investmentChange, STYLE.currency), formula("B6+C6", STYLE.currency), text("Includes investment transfers; no market growth is assumed.")],
      [text("Superannuation"), number(snapshot.superBalance, STYLE.currency), number(snapshot.superChange, STYLE.currency), formula("B7+C7", STYLE.currency), text("Includes additional super contributions only; no growth included here.")],
      [text("Total financial assets", STYLE.header), formula("SUM(B3:B7)", STYLE.totalCurrency), formula("SUM(C3:C7)", STYLE.totalCurrency), formula("SUM(D3:D7)", STYLE.totalCurrency), blank()],
      [blank(), blank(), blank(), blank(), blank()],
      [text("Total liabilities"), number(snapshot.totalDebtBalance, STYLE.currency), number(-asNumber(snapshot.debtChange), STYLE.currency), formula("MAX(0,B10+C10)", STYLE.currency), text("Debt change uses additional debt repayments where entered.")],
      [text("Net financial position", STYLE.header), formula("B8-B10", STYLE.totalCurrency), formula("C8+C10", STYLE.totalCurrency), formula("D8-D10", STYLE.totalCurrency), text("Estimated change during the planner period.")],
    ];
    return {
      name: "Wealth Snapshot",
      xml: sheetXml(makeRows(5, rows), { cols: [30, 20, 20, 24, 58], orientation: "portrait" }),
    };
  }

  function buildAnnualSummary(planner, weeklyMeta) {
    const summary = planner.summary || {};
    const rows = [
      [text("Annual Summary", STYLE.title), blank(), blank()],
      [text("Measure", STYLE.header), text("Amount", STYLE.header), text("Notes", STYLE.header)],
      [text("Total expected income"), number(summary.totalIncome, STYLE.currency), text("Money in during the planner period, using completed actuals where available.")],
      [text("Total essential spending"), number(summary.totalEssential, STYLE.currency), text("Bills and essential spending.")],
      [text("Total provisions"), number(summary.totalProvisions, STYLE.currency), text("Amounts set aside for future bills.")],
      [text("Total lifestyle spending"), number(summary.totalLifestyle, STYLE.currency), text("Lifestyle and discretionary spending.")],
      [text("Total planned offset savings"), number(summary.totalOffset, STYLE.currency), text("Offset transfers included in the weekly schedule.")],
      [text("Total additional debt repayments"), number(summary.totalDebt, STYLE.currency), text("Additional debt repayments included in the weekly schedule.")],
      [text("Total investing"), number(summary.totalInvesting, STYLE.currency), text("Investment transfers included in the weekly schedule.")],
      [text("Total additional super contributions"), number(summary.totalSuper, STYLE.currency), text("Additional super contributions included in the weekly schedule.")],
      [text("Expected starting cash position"), number(summary.startingCash, STYLE.currency), text("Opening bank balance entered before generating.")],
      [text("Expected ending cash position"), number(summary.endingCash, STYLE.currency), text("Final bank balance in the planner.")],
      [text("Estimated improvement in net financial position"), number(summary.estimatedImprovement, STYLE.totalCurrency), text("Cash movement plus planned or completed wealth-building transfers.")],
      [text("Average weekly savings rate"), number(summary.savingsRate, STYLE.percent), text("Transfers divided by expected income.")],
      [text("Weeks with negative projected closing balance"), number(summary.weeksNegative, summary.weeksNegative ? STYLE.warningCurrency : STYLE.normal), text("Review any affected week before relying on the schedule.")],
    ];
    return {
      name: "Annual Summary",
      xml: sheetXml(makeRows(3, rows), { cols: [38, 20, 62], orientation: "portrait" }),
    };
  }

  function buildStylesXml() {
    return `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0;[Red]-&quot;$&quot;#,##0"/>
    <numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>
    <numFmt numFmtId="166" formatCode="0.0%"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF172033"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><color rgb="FF0F2742"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F2742"/><name val="Arial"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F2742"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFFCF6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFE0DC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="1"><dxf><font><color rgb="FFBC3427"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFE0DC"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
  }

  function workbookXml(sheets) {
    return `${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}
  </sheets>
  <calcPr calcMode="auto"/>
</workbook>`;
  }

  function workbookRelsXml(sheets) {
    return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  function rootRelsXml() {
    return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  }

  function contentTypesXml(sheets) {
    return `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
  }

  function corePropsXml(planner) {
    return `${XML_HEADER}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Financial Freedom Weekly Money Plan</dc:title>
  <dc:creator>Financial Freedom</dc:creator>
  <cp:lastModifiedBy>Financial Freedom</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(planner.generatedAtIso)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(planner.generatedAtIso)}</dcterms:modified>
</cp:coreProperties>`;
  }

  function appPropsXml(sheets) {
    return `${XML_HEADER}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Financial Freedom</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>
</Properties>`;
  }

  function buildWorkbookFiles(planner) {
    planner.lookupRows = planner.lookupRows || {};
    const weekly = buildWeeklyPlanner(planner);
    const sheets = [
      buildStartHere(planner),
      weekly,
      buildWeeklyActionPlan(planner),
      buildWealthSnapshot(planner, weekly.meta),
      buildAnnualSummary(planner, weekly.meta),
    ];
    return [
      { name: "[Content_Types].xml", content: contentTypesXml(sheets) },
      { name: "_rels/.rels", content: rootRelsXml() },
      { name: "docProps/core.xml", content: corePropsXml(planner) },
      { name: "docProps/app.xml", content: appPropsXml(sheets) },
      { name: "xl/workbook.xml", content: workbookXml(sheets) },
      { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml(sheets) },
      { name: "xl/styles.xml", content: buildStylesXml() },
      ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheet.xml })),
    ];
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { dosTime, dosDate };
  }

  function writeUInt16(buffer, offset, value) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
  }

  function writeUInt32(buffer, offset, value) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
    buffer[offset + 2] = (value >>> 16) & 0xff;
    buffer[offset + 3] = (value >>> 24) & 0xff;
  }

  function concatBytes(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function zipFiles(files) {
    const encoder = new TextEncoder();
    const { dosTime, dosDate } = dosDateTime();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const contentBytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
      const crc = crc32(contentBytes);
      const localHeader = new Uint8Array(30 + nameBytes.length);
      writeUInt32(localHeader, 0, 0x04034b50);
      writeUInt16(localHeader, 4, 20);
      writeUInt16(localHeader, 6, 0x0800);
      writeUInt16(localHeader, 8, 0);
      writeUInt16(localHeader, 10, dosTime);
      writeUInt16(localHeader, 12, dosDate);
      writeUInt32(localHeader, 14, crc);
      writeUInt32(localHeader, 18, contentBytes.length);
      writeUInt32(localHeader, 22, contentBytes.length);
      writeUInt16(localHeader, 26, nameBytes.length);
      writeUInt16(localHeader, 28, 0);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, contentBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      writeUInt32(centralHeader, 0, 0x02014b50);
      writeUInt16(centralHeader, 4, 20);
      writeUInt16(centralHeader, 6, 20);
      writeUInt16(centralHeader, 8, 0x0800);
      writeUInt16(centralHeader, 10, 0);
      writeUInt16(centralHeader, 12, dosTime);
      writeUInt16(centralHeader, 14, dosDate);
      writeUInt32(centralHeader, 16, crc);
      writeUInt32(centralHeader, 20, contentBytes.length);
      writeUInt32(centralHeader, 24, contentBytes.length);
      writeUInt16(centralHeader, 28, nameBytes.length);
      writeUInt16(centralHeader, 30, 0);
      writeUInt16(centralHeader, 32, 0);
      writeUInt16(centralHeader, 34, 0);
      writeUInt16(centralHeader, 36, 0);
      writeUInt32(centralHeader, 38, 0);
      writeUInt32(centralHeader, 42, localOffset);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);

      localOffset += localHeader.length + contentBytes.length;
    });

    const centralDirectory = concatBytes(centralParts);
    const centralOffset = localOffset;
    const end = new Uint8Array(22);
    writeUInt32(end, 0, 0x06054b50);
    writeUInt16(end, 4, 0);
    writeUInt16(end, 6, 0);
    writeUInt16(end, 8, files.length);
    writeUInt16(end, 10, files.length);
    writeUInt32(end, 12, centralDirectory.length);
    writeUInt32(end, 16, centralOffset);
    writeUInt16(end, 20, 0);
    return concatBytes([...localParts, centralDirectory, end]);
  }

  function createWorkbookBytes(planner) {
    return zipFiles(buildWorkbookFiles(planner));
  }

  function createWorkbookBlob(planner) {
    return new Blob([createWorkbookBytes(planner)], { type: MIME_XLSX });
  }

  const api = { createWorkbookBytes, createWorkbookBlob, moneyValue };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FFSWeeklyPlannerExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
