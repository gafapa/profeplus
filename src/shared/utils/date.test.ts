import { describe, expect, it } from "vitest";
import { toLocalIsoDate } from "./date";

describe("toLocalIsoDate", () => {
  it("uses the local calendar day instead of the UTC day", () => {
    const localDate = new Date(2026, 6, 29, 0, 44);

    expect(toLocalIsoDate(localDate)).toBe("2026-07-29");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
