export const APP_LOCK_STORAGE_KEY = "profeplus_app_lock";
export const APP_LOCK_CHANGED_EVENT = "profeplus:app-lock-changed";
export const APP_LOCK_NOW_EVENT = "profeplus:lock-now";

const APP_LOCK_ITERATIONS = 210_000;

export type AppLockConfig = {
  version: 1;
  salt: string;
  verifier: string;
  iterations: number;
  autoLockMinutes: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveVerifier(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function createAppLockConfig(
  passphrase: string,
  autoLockMinutes: number
): Promise<AppLockConfig> {
  if (passphrase.length < 8) throw new Error("La clave debe tener al menos 8 caracteres.");
  if (!Number.isInteger(autoLockMinutes) || autoLockMinutes < 1 || autoLockMinutes > 120) {
    throw new Error("El bloqueo automático debe estar entre 1 y 120 minutos.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    version: 1,
    salt: bytesToBase64(salt),
    verifier: await deriveVerifier(passphrase, salt, APP_LOCK_ITERATIONS),
    iterations: APP_LOCK_ITERATIONS,
    autoLockMinutes
  };
}

export async function verifyAppLockPassphrase(
  config: AppLockConfig,
  passphrase: string
): Promise<boolean> {
  const candidate = await deriveVerifier(passphrase, base64ToBytes(config.salt), config.iterations);
  if (candidate.length !== config.verifier.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ config.verifier.charCodeAt(index);
  }
  return difference === 0;
}

export function readAppLockConfig(storage: Storage = window.localStorage): AppLockConfig | null {
  const rawValue = storage.getItem(APP_LOCK_STORAGE_KEY);
  if (!rawValue) return null;
  try {
    const value = JSON.parse(rawValue) as Partial<AppLockConfig>;
    if (
      value.version !== 1 ||
      typeof value.salt !== "string" ||
      typeof value.verifier !== "string" ||
      typeof value.iterations !== "number" ||
      typeof value.autoLockMinutes !== "number"
    ) {
      return null;
    }
    return value as AppLockConfig;
  } catch {
    return null;
  }
}

export function persistAppLockConfig(config: AppLockConfig | null): void {
  if (config) window.localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
  else window.localStorage.removeItem(APP_LOCK_STORAGE_KEY);
  window.dispatchEvent(new Event(APP_LOCK_CHANGED_EVENT));
}
