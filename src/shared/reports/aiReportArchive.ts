import { escapeHtml } from "./printableReports";

export type SavedAiReport = {
  id: string;
  reportId: string;
  classId: string;
  title: string;
  text: string;
  context: string;
  provider: string;
  model: string;
  createdAt: string;
};

export function isSavedAiReport(value: unknown): value is SavedAiReport {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["id", "reportId", "classId", "title", "text", "context", "provider", "model", "createdAt"].every(key => typeof row[key] === "string")
    && Boolean(row.id && row.reportId && row.title && row.text)
    && (row.title as string).length <= 300 && (row.text as string).length <= 200_000
    && Number.isFinite(Date.parse(row.createdAt as string));
}

export function printableAiReport(report: SavedAiReport): string {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#172b4d;max-width:70ch;margin:40px auto;padding:0 20px}h1{line-height:1.2}p{white-space:pre-wrap;overflow-wrap:anywhere}.meta{font-size:14px;color:#42526e}@media print{body{margin:0;max-width:none}h1{break-after:avoid}}</style><h1>${escapeHtml(report.title)}</h1><p class="meta">${escapeHtml(report.context)}\n${escapeHtml(report.provider)} · ${escapeHtml(report.model)} · ${escapeHtml(new Date(report.createdAt).toLocaleString("es-ES"))}</p><p class="meta">Informe elaborado con asistencia de IA. Requiere revisión docente.</p><p>${escapeHtml(report.text)}</p></html>`;
}
