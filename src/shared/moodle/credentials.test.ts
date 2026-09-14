import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readMoodleToken, removeMoodleToken, saveMoodleToken } from "./credentials";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

it("isolates tokens by normalized installation and account", () => {
  expect(saveMoodleToken("https://school.example/aula/", "token123", 9)).toBe(true);
  expect(readMoodleToken("https://school.example/aula", 9)?.token).toBe("token123");
  expect(readMoodleToken("https://school.example/other/")).toBeNull();
  expect(readMoodleToken("https://school.example/aula", 10)).toBeNull();
  removeMoodleToken("https://school.example/aula", 10);
  expect(readMoodleToken("https://school.example/aula", 9)).not.toBeNull();
  removeMoodleToken("https://school.example/aula", 9);
  expect(readMoodleToken("https://school.example/aula")).toBeNull();
});

it("rejects unsafe URLs and invalid tokens", () => {
  expect(saveMoodleToken("https://user:secret@school.example/", "token123", 9)).toBe(false);
  expect(saveMoodleToken("https://school.example/", "<token>", 9)).toBe(false);
  expect(saveMoodleToken("https://school.example/", "token123", 0)).toBe(false);
  expect(readMoodleToken("invalid")).toBeNull();
});

it("reports blocked storage without claiming credentials were saved", () => {
  vi.stubGlobal("localStorage", {
    setItem: () => { throw new Error("blocked"); },
    getItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
    key: () => { throw new Error("blocked"); },
    get length(): number { throw new Error("blocked"); }
  });
  expect(saveMoodleToken("https://school.example/", "token123", 9)).toBe(false);
  expect(readMoodleToken("https://school.example/")).toBeNull();
  expect(removeMoodleToken("https://school.example/")).toBe(false);
});
