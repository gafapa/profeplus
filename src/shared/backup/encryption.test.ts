import { describe, expect, it } from "vitest";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupEnvelope
} from "./encryption";

describe("encrypted backups", () => {
  it("round-trips a payload without exposing its content", async () => {
    const payload = { students: [{ name: "Ana" }], grades: [8.5] };
    const encrypted = await encryptBackupPayload(payload, "correct horse battery staple");

    expect(isEncryptedBackupEnvelope(encrypted)).toBe(true);
    expect(encrypted.ciphertext).not.toContain("Ana");
    await expect(decryptBackupPayload(encrypted, "correct horse battery staple")).resolves.toEqual(payload);
  });

  it("rejects an incorrect password", async () => {
    const encrypted = await encryptBackupPayload({ value: "private" }, "correct horse battery staple");

    await expect(decryptBackupPayload(encrypted, "incorrect password value")).rejects.toThrow(
      "No se pudo descifrar"
    );
  });

  it("requires a password with at least twelve characters", async () => {
    await expect(encryptBackupPayload({ value: "private" }, "too-short")).rejects.toThrow(
      "al menos 12 caracteres"
    );
  });

  it("rejects envelopes with weakened key derivation settings", async () => {
    const encrypted = await encryptBackupPayload({ value: "private" }, "correct horse battery staple");
    const weakened = {
      ...encrypted,
      encryption: {
        ...encrypted.encryption,
        iterations: 1
      }
    };

    expect(isEncryptedBackupEnvelope(weakened)).toBe(false);
  });
});
