import { useEffect, useState } from "react";

type PreferenceKey = "moodle.server" | "moodle.service" | "moodle.authMode" | "nextcloud.server";

function safeValue(key: PreferenceKey, value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  if (key.endsWith(".server") && value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return undefined;
    } catch { return undefined; }
  }
  if (key === "moodle.authMode" && value !== "token" && value !== "password") return undefined;
  return value;
}

export function hasConnectionPreference(key: PreferenceKey): boolean {
  try { return localStorage.getItem(`edunoza.connection.${key}`) !== null; } catch { return false; }
}

/** Only non-secret connection preferences are accepted; credentials use component state. */
export function useConnectionPreference(key: PreferenceKey, fallback = "") {
  const [value, setValue] = useState(() => {
    try { return safeValue(key, localStorage.getItem(`edunoza.connection.${key}`)) ?? fallback; } catch { return fallback; }
  });
  useEffect(() => {
    const safe = safeValue(key, value);
    if (safe === undefined) return;
    try { localStorage.setItem(`edunoza.connection.${key}`, safe); } catch { /* Storage may be unavailable; keep the session usable. */ }
  }, [key, value]);
  return [value, setValue] as const;
}
