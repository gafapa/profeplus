import { describe, expect, it } from "vitest";
import { describeReportFollowUp, summarizeReportEvidence } from "./evidence";

describe("report evidence", () => {
  it("keeps ungraded work distinct from explicit non-submission and exemption", () => {
    expect(summarizeReportEvidence(["graded", "pending", "notSubmitted", "exempt"])).toEqual({
      total: 3, scored: 1, missing: 1, notSubmitted: 1, exempt: 1, missingRate: 33
    });
  });

  it("does not infer pupil risk from a teacher's ungraded task", () => {
    const description = describeReportFollowUp(null, 100, summarizeReportEvidence(["pending"]), 1);
    expect(description).toContain("Sin evidencia académica suficiente");
    expect(description).toContain("1 pendiente(s) de evaluar, 0 no presentado(s)");
    expect(description).not.toMatch(/Alto|Revisar/);
  });

  it("does not infer low risk from completely absent evidence", () => {
    expect(describeReportFollowUp(null, null, summarizeReportEvidence([]), 0)).toContain("Sin evidencia académica suficiente");
  });

  it("explains observed evidence without predicting risk from a one-session sample", () => {
    const description = describeReportFollowUp(4, 0, summarizeReportEvidence(["graded", "notSubmitted"]), 1);
    expect(description).toContain("media 4.00 inferior a 5");
    expect(description).toContain("asistencia 0% en 1 sesiones");
    expect(description).toContain("1 no presentado(s) expresamente");
    expect(description).not.toMatch(/Alto|Bajo/);
  });

  it("does not treat a policy-generated non-submission zero as a graded observation", () => {
    const description = describeReportFollowUp(0, null, summarizeReportEvidence(["notSubmitted"]), 0);
    expect(description).toContain("no presentado(s) expresamente");
    expect(description).not.toContain("media 0.00");
  });
});
