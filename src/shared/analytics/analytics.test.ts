import { describe, expect, it } from "vitest";
import {
  ANALYTICS_EVENTS,
  analyticsEventForPath,
  buildAnalyticsEventUrl,
  isAnalyticsEvent
} from "./analytics";

describe("privacy-safe analytics", () => {
  it("accepts only the fixed low-cardinality event vocabulary", () => {
    expect(ANALYTICS_EVENTS).toContain("class_saved");
    expect(isAnalyticsEvent("route_today")).toBe(true);
    expect(isAnalyticsEvent("student_123")).toBe(false);
  });

  it("builds an event URL without adding identifiers or query data", () => {
    expect(buildAnalyticsEventUrl("/__analytics/v1/", "route_agenda")).toBe(
      "/__analytics/v1/route_agenda"
    );
  });

  it("maps routes to coarse product areas", () => {
    expect(analyticsEventForPath("/today?date=2026-08-20")).toBe("route_today");
    expect(analyticsEventForPath("/management/students")).toBe("route_management");
    expect(analyticsEventForPath("/management/tutor")).toBe("route_tutor");
    expect(analyticsEventForPath("/unknown")).toBeNull();
  });
});
