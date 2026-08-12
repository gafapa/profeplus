import { describe, expect, it } from "vitest";
import {
  findActiveNavigationArea,
  matchesNavigationPath,
  navigationAreas
} from "./mainNavigation";

describe("main navigation", () => {
  it.each([
    ["/today", "today"],
    ["/agenda", "today"],
    ["/classroom", "today"],
    ["/search", "today"],
    ["/planner", "planning"],
    ["/management/units", "planning"],
    ["/management/tasks", "planning"],
    ["/journal/work", "assessment"],
    ["/gradebook", "assessment"],
    ["/management/periods", "assessment"],
    ["/journal/attendance", "follow-up"],
    ["/management/tutor", "follow-up"],
    ["/reports", "follow-up"],
    ["/management/courses", "organization"],
    ["/management/students", "organization"],
    ["/management/subjects", "organization"],
    ["/management/schedule", "organization"]
  ])("maps %s to the %s area", (pathname, areaId) => {
    expect(findActiveNavigationArea(pathname)?.id).toBe(areaId);
  });

  it("keeps settings and unknown routes outside workflow areas", () => {
    expect(findActiveNavigationArea("/config/preferences")).toBeNull();
    expect(findActiveNavigationArea("/missing")).toBeNull();
  });

  it("matches nested routes without accepting similar route prefixes", () => {
    expect(matchesNavigationPath("/reports/print", "/reports")).toBe(true);
    expect(matchesNavigationPath("/reports-old", "/reports")).toBe(false);
  });

  it("uses an item in each area as its default destination", () => {
    for (const area of navigationAreas) {
      expect(area.items.some((item) => item.to === area.to)).toBe(true);
    }
  });
});
