import { describe, expect, it } from "vitest";
import { clearLocalDrafts, readLocalDraft, removeLocalDraft, writeLocalDraft } from "./localDrafts";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); }, key: (index) => [...values.keys()][index] ?? null, clear: () => values.clear() };
}

describe("recoverable local drafts", () => {
  it("isolates contexts and clears only academic drafts", () => {
    const storage = memoryStorage();
    storage.setItem("preference", "keep");
    expect(writeLocalDraft("student:a", { notes: "Draft" }, storage)).toBe(true);
    expect(readLocalDraft("student:b", storage)).toBeNull();
    expect(readLocalDraft("student:a", storage)).toEqual({ notes: "Draft" });
    clearLocalDrafts(storage);
    expect(readLocalDraft("student:a", storage)).toBeNull();
    expect(storage.getItem("preference")).toBe("keep");
  });
  it("expires stale drafts and tolerates malformed/unavailable storage", () => {
    const storage = memoryStorage();
    writeLocalDraft("a", "draft", storage);
    expect(readLocalDraft("a", storage, Date.now() + 8 * 86400000)).toBeNull();
    storage.setItem("edunoza-draft:a", "not json");
    expect(readLocalDraft("a", storage)).toBeNull();
    removeLocalDraft("a", storage);
    expect(writeLocalDraft("a", "x".repeat(500001), storage)).toBe(false);
  });
});
