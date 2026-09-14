export type ReportEvidenceStatus = "graded" | "pending" | "notSubmitted" | "exempt";

export function summarizeReportEvidence(statuses: ReportEvidenceStatus[]) {
  const scored = statuses.filter((status) => status === "graded").length;
  const missing = statuses.filter((status) => status === "pending").length;
  const notSubmitted = statuses.filter((status) => status === "notSubmitted").length;
  const exempt = statuses.filter((status) => status === "exempt").length;
  const total = statuses.length - exempt;
  return { total, scored, missing, notSubmitted, exempt, missingRate: total > 0 ? Math.round(missing / total * 100) : 0 };
}

export type ReportEvidenceStats = ReturnType<typeof summarizeReportEvidence>;

export function describeReportFollowUp(
  grade: number | null | undefined,
  attendanceRate: number | null,
  evidence: ReportEvidenceStats,
  attendanceCount: number
): string {
  const reasons: string[] = [];
  // These are observations to review, never predictions about a pupil.
  if (typeof grade === "number" && evidence.scored > 0 && grade < 5) reasons.push(`media ${grade.toFixed(2)} inferior a 5`);
  if (attendanceRate !== null && attendanceRate < 90) reasons.push(`asistencia ${attendanceRate}% en ${attendanceCount} sesiones`);
  if (evidence.notSubmitted > 0) reasons.push(`${evidence.notSubmitted} no presentado(s) expresamente`);
  const basis = `${evidence.scored} calificado(s), ${evidence.missing} pendiente(s) de evaluar, ${evidence.notSubmitted} no presentado(s)`;
  if (reasons.length > 0) return `Revisar: ${reasons.join("; ")}. ${basis}.`;
  if (evidence.scored === 0) return `Sin evidencia académica suficiente. ${basis}.`;
  return `Sin señales en los registros disponibles. ${basis}.`;
}
