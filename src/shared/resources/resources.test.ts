import { describe, expect, it } from "vitest";
import {
  MAX_RESOURCE_FILE_BYTES,
  base64DecodedByteLength,
  bytesToBase64,
  createFileResource,
  createLinkResource,
  normalizeHttpUrl,
  validateResourceFile
} from "./resources";

describe("resource attachments", () => {
  it("normalizes safe web links", () => {
    expect(normalizeHttpUrl(" https://example.org/material?id=1 ")).toBe("https://example.org/material?id=1");
  });

  it("rejects active and local URL schemes", () => {
    expect(() => normalizeHttpUrl("javascript:alert(1)")).toThrow(/https/);
    expect(() => normalizeHttpUrl("file:///private/report.pdf")).toThrow(/https/);
  });

  it("rejects active file formats and oversized files", () => {
    expect(() => validateResourceFile({ name: "page.html", size: 120, type: "text/html" })).toThrow(/no permitido/);
    expect(() => validateResourceFile({ name: "large.pdf", size: MAX_RESOURCE_FILE_BYTES + 1, type: "application/pdf" })).toThrow(/límite/);
  });

  it("encodes bytes without changing their length", () => {
    const encoded = bytesToBase64(new Uint8Array([0, 1, 2, 127, 128, 255]));
    expect(base64DecodedByteLength(encoded)).toBe(6);
    expect(base64DecodedByteLength("not base64! ")).toBe(-1);
  });

  it("creates a validated link record", () => {
    const record = createLinkResource("task", "task-1", "Reference", "https://example.org", "2026-08-12T09:00:00.000Z");
    expect(record).toMatchObject({ ownerType: "task", ownerId: "task-1", kind: "link", title: "Reference" });
  });

  it("creates a validated local file record", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "evidence.pdf", { type: "application/pdf" });
    const record = await createFileResource("student", "student-1", "Evidence", file, 0, "2026-08-12T09:00:00.000Z");
    expect(record).toMatchObject({
      ownerType: "student",
      ownerId: "student-1",
      kind: "file",
      fileName: "evidence.pdf",
      sizeBytes: 3
    });
    expect(base64DecodedByteLength(record.dataBase64 ?? "")).toBe(3);
  });
});
