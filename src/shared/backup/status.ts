export const BACKUP_STATUS_CHANGED_EVENT = "profeplus-backup-status-changed";
export const LAST_BACKUP_STORAGE_KEY = "profeplus_last_backup_at";

const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupFreshness = "missing" | "current" | "due" | "overdue";

export function backupFreshness(lastBackupAt: string | null, now = new Date()): BackupFreshness {
  if (!lastBackupAt) return "missing";
  const timestamp = Date.parse(lastBackupAt);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime() + DAY_MS) return "missing";
  const ageDays = (now.getTime() - timestamp) / DAY_MS;
  if (ageDays <= 7) return "current";
  if (ageDays <= 14) return "due";
  return "overdue";
}

export function readLastBackupAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function recordBackupCreated(createdAt = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_BACKUP_STORAGE_KEY, createdAt);
    window.dispatchEvent(new CustomEvent(BACKUP_STATUS_CHANGED_EVENT));
  } catch {
    // A completed download remains valid even when status storage is unavailable.
  }
}

export function backupStatusLabel(lastBackupAt: string | null, now = new Date()): string {
  const freshness = backupFreshness(lastBackupAt, now);
  if (freshness === "missing") return "Sin copia reciente";
  const timestamp = Date.parse(lastBackupAt as string);
  const ageDays = Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
  if (ageDays === 0) return "Copia de hoy";
  if (ageDays === 1) return "Copia de ayer";
  return `Copia de hace ${ageDays} días`;
}
