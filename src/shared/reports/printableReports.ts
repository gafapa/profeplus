export type PrintableTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type PrintableSummaryItem = {
  label: string;
  value: string;
};

export type PrintableSection = {
  title: string;
  summary?: PrintableSummaryItem[];
  tables?: PrintableTable[];
  pageBreakBefore?: boolean;
};

export type PrintableReport = {
  title: string;
  generatedAt: string;
  summary?: PrintableSummaryItem[];
  tables?: PrintableTable[];
  sections?: PrintableSection[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSummaryHtml(summary: PrintableSummaryItem[] = []): string {
  if (summary.length === 0) {
    return "";
  }

  return `
    <section class="metrics">
      ${summary
    .map(
      (item) => `
        <article class="metric">
          <strong>${escapeHtml(item.value)}</strong>
          <span>${escapeHtml(item.label)}</span>
        </article>`
    )
    .join("")}
    </section>`;
}

function buildTableHtml(tables: PrintableTable[] = []): string {
  return tables
    .map(
      (table) => `
        <section>
          <h2>${escapeHtml(table.title)}</h2>
          <table>
            <thead>
              <tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${table.rows
                .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </section>`
    )
    .join("");
}

function buildSectionHtml(section: PrintableSection): string {
  return `
    <section class="report-section${section.pageBreakBefore ? " page-break" : ""}">
      <h1>${escapeHtml(section.title)}</h1>
      ${buildSummaryHtml(section.summary)}
      ${buildTableHtml(section.tables)}
    </section>`;
}

export function buildPrintableReportHtml(report: PrintableReport): string {
  const summaryHtml = buildSummaryHtml(report.summary);
  const tableHtml = buildTableHtml(report.tables);
  const sectionHtml = (report.sections ?? []).map(buildSectionHtml).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    :root { color: #172033; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 32px; background: #fff; }
    header { border-bottom: 2px solid #244c87; margin-bottom: 18px; padding-bottom: 12px; }
    h1 { margin: 0; color: #173b75; font-size: 1.55rem; }
    h2 { color: #244c87; font-size: 1.05rem; margin: 22px 0 8px; }
    .generated { color: #5f7196; font-size: 0.85rem; margin-top: 4px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 8px; margin: 16px 0; }
    .metric { border: 1px solid #d9e5f6; border-radius: 8px; padding: 10px; background: #f7faff; }
    .metric strong, .metric span { display: block; }
    .metric strong { color: #173b75; font-size: 1.2rem; }
    .metric span { color: #526784; font-size: 0.78rem; margin-top: 2px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 18px; font-size: 0.84rem; }
    th, td { border: 1px solid #d9e5f6; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #edf4ff; color: #173b75; }
    tr:nth-child(even) td { background: #fbfdff; }
    .report-section { margin-top: 26px; }
    .report-section > h1 { border-bottom: 1px solid #d9e5f6; padding-bottom: 8px; font-size: 1.28rem; }
    .page-break { break-before: page; page-break-before: always; }
    @media print {
      body { margin: 12mm; }
      .metrics { grid-template-columns: repeat(4, 1fr); }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="generated">Generado: ${escapeHtml(report.generatedAt)}</div>
  </header>
  <main>
    ${summaryHtml}
    ${tableHtml}
    ${sectionHtml}
  </main>
</body>
</html>`;
}
