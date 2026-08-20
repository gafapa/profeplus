import { describe, expect, it } from "vitest";
import { backupFreshness, backupStatusLabel } from "./status";

const NOW = new Date("2026-08-20T10:00:00.000Z");

describe("backup status", () => {
  it("classifies missing, current, due, and overdue backups", () => {
    expect(backupFreshness(null, NOW)).toBe("missing");
    expect(backupFreshness("2026-08-18T10:00:00.000Z", NOW)).toBe("current");
    expect(backupFreshness("2026-08-10T10:00:00.000Z", NOW)).toBe("due");
    expect(backupFreshness("2026-07-20T10:00:00.000Z", NOW)).toBe("overdue");
  });

  it("formats a concise recovery label", () => {
    expect(backupStatusLabel(null, NOW)).toBe("Sin copia reciente");
    expect(backupStatusLabel("2026-08-19T10:00:00.000Z", NOW)).toBe("Copia de ayer");
  });
});
