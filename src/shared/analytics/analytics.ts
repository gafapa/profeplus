export const ANALYTICS_EVENTS = [
  "app_open",
  "landing_workspace_open",
  "route_today",
  "route_agenda",
  "route_classroom",
  "route_search",
  "route_planner",
  "route_evaluation",
  "route_gradebook",
  "route_attendance",
  "route_tutor",
  "route_reports",
  "route_management",
  "route_settings",
  "onboarding_completed",
  "class_saved",
  "calendar_exported",
  "search_used",
  "backup_exported",
  "backup_verified",
  "backup_imported",
  "feedback_opened",
  "feedback_shared"
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const ANALYTICS_EVENT_SET = new Set<string>(ANALYTICS_EVENTS);
const SESSION_EVENT_PREFIX = "profeplus_analytics_";
const LOCAL_EVENT_PREFIX = "profeplus_analytics_completed_";

export function isAnalyticsEvent(value: string): value is AnalyticsEvent {
  return ANALYTICS_EVENT_SET.has(value);
}

export function buildAnalyticsEventUrl(endpoint: string, event: AnalyticsEvent): string {
  return `${endpoint.replace(/\/$/, "")}/${event}`;
}

export function analyticsEventForPath(pathname: string): AnalyticsEvent | null {
  if (pathname === "/") return null;
  if (pathname.startsWith("/today")) return "route_today";
  if (pathname.startsWith("/agenda")) return "route_agenda";
  if (pathname.startsWith("/classroom")) return "route_classroom";
  if (pathname.startsWith("/search")) return "route_search";
  if (pathname.startsWith("/planner")) return "route_planner";
  if (pathname.startsWith("/journal/work")) return "route_evaluation";
  if (pathname.startsWith("/gradebook")) return "route_gradebook";
  if (pathname.startsWith("/journal/attendance")) return "route_attendance";
  if (pathname.startsWith("/management/tutor")) return "route_tutor";
  if (pathname.startsWith("/reports")) return "route_reports";
  if (pathname.startsWith("/management")) return "route_management";
  if (pathname.startsWith("/config")) return "route_settings";
  return null;
}

function analyticsEnabled(): boolean {
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
  return (
    Boolean(import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim()) &&
    navigator.doNotTrack !== "1" &&
    privacyNavigator.globalPrivacyControl !== true
  );
}

export function trackAnalyticsEvent(event: AnalyticsEvent): void {
  if (!analyticsEnabled()) return;
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
  if (!endpoint) return;

  void fetch(buildAnalyticsEventUrl(endpoint, event), {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    keepalive: true,
    referrerPolicy: "no-referrer"
  }).catch(() => {
    // Analytics must never interrupt classroom work.
  });
}

export function trackAnalyticsEventOncePerSession(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const key = `${SESSION_EVENT_PREFIX}${event}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage restrictions must not interrupt the product or analytics call.
  }
  trackAnalyticsEvent(event);
}

export function trackAnalyticsEventOnce(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const key = `${LOCAL_EVENT_PREFIX}${event}`;
  try {
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage restrictions must not interrupt the product or analytics call.
  }
  trackAnalyticsEvent(event);
}
