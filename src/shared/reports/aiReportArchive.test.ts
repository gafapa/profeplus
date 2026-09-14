import { describe, expect, it } from "vitest";
import { isSavedAiReport, printableAiReport, type SavedAiReport } from "./aiReportArchive";
const report: SavedAiReport = { id: "v1", reportId: "r1", classId: "g1", title: "Informe <script>", text: "Alumno & docente\n<script>alert(1)</script>", context: "Grupo A · 2026-2027", provider: "ollama", model: "test", createdAt: "2026-09-08T12:00:00Z" };
describe("AI report archive", () => {
  it("validates complete versions and rejects corrupt or oversized text", () => {
    expect(isSavedAiReport(report)).toBe(true);
    expect(isSavedAiReport({ ...report, text: 1 })).toBe(false);
    expect(isSavedAiReport({ ...report, text: "x".repeat(200_001) })).toBe(false);
    expect(isSavedAiReport({ ...report, createdAt: "invalid" })).toBe(false);
  });
  it("prints escaped text without executing model markup", () => {
    const html = printableAiReport(report);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Grupo A · 2026-2027");
    expect(html).toContain("@media print");
  });
});
