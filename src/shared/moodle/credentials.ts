import { normalizeMoodleUrl } from "./client";

const PREFIX = "edunoza.moodle.token:";
type SavedToken = { token: string; userId: number };

function buildKey(server: string, userId: number): string {
  return `${PREFIX}${normalizeMoodleUrl(server)}::${userId}`;
}

function parseStoredToken(raw: string | null): SavedToken | null {
  const value = JSON.parse(raw ?? "null") as SavedToken | null;
  if (!value || typeof value.token !== "string" || !/^[a-zA-Z0-9]{1,256}$/.test(value.token) ||
      !Number.isSafeInteger(value.userId) || value.userId <= 0) return null;
  return { token: value.token, userId: value.userId };
}

/** Device-only credential storage, deliberately excluded from academic backups. Keyed by server+account so distinct accounts on the same server never collide. */
export function readMoodleToken(server: string, userId?: number): SavedToken | null {
  try {
    if (userId !== undefined) {
      const value = parseStoredToken(localStorage.getItem(buildKey(server, userId)));
      return value && value.userId === userId ? value : null;
    }
    const prefix = `${PREFIX}${normalizeMoodleUrl(server)}::`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const value = parseStoredToken(localStorage.getItem(key));
      if (value) return value;
    }
    return null;
  } catch { return null; }
}

export function saveMoodleToken(server: string, token: string, userId: number): boolean {
  try {
    if (!/^[a-zA-Z0-9]{1,256}$/.test(token) || !Number.isSafeInteger(userId) || userId <= 0) return false;
    localStorage.setItem(buildKey(server, userId), JSON.stringify({ token, userId }));
    return true;
  } catch { return false; }
}

export function removeMoodleToken(server: string, userId?: number): boolean {
  try {
    if (userId !== undefined) {
      localStorage.removeItem(buildKey(server, userId));
      return true;
    }
    const prefix = `${PREFIX}${normalizeMoodleUrl(server)}::`;
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch { return false; }
}
