import { describe, expect, it } from "vitest";
import { buildPrintableReportHtml, escapeHtml } from "./printableReports";

describe("printable reports", () => {
  it("escapes HTML content", () => {
    expect(escapeHtml(`<Ana & "Luis">`)).toBe("&lt;Ana &amp; &quot;Luis&quot;&gt;");
  });

  it("builds printable HTML with metrics and tables", () => {
    const html = buildPrintableReportHtml({
      title: "Informe <grupo>",
      generatedAt: "2026-07-08",
      summary: [{ label: "Media", value: "7.25" }],
      tables: [
        {
          title: "Alumnos",
          headers: ["Alumno", "Nota"],
          rows: [["Ana", "8"]]
        }
      ]
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Informe &lt;grupo&gt;");
    expect(html).toContain("<th>Alumno</th>");
    expect(html).toContain("<td>Ana</td>");
  });

  it("builds paginated sections for individual printable reports", () => {
    const html = buildPrintableReportHtml({
      title: "Informes individuales",
      generatedAt: "2026-07-08",
      sections: [
        {
          title: "Ana <1>",
          pageBreakBefore: true,
          summary: [{ label: "Riesgo", value: "Bajo" }],
          tables: [
            {
              title: "Asignaturas",
              headers: ["Asignatura", "Media"],
              rows: [["Matemáticas", "8.50"]]
            }
          ]
        }
      ]
    });

    expect(html).toContain("report-section page-break");
    expect(html).toContain("Ana &lt;1&gt;");
    expect(html).toContain("<strong>Bajo</strong>");
    expect(html).toContain("<td>Matemáticas</td>");
  });
});
