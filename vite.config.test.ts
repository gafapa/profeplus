import { describe, expect, it } from "vitest";
import { normalizePrecacheAssetPaths } from "./vite.config";

describe("offline precache manifest", () => {
  it("normalizes, deduplicates, and sorts emitted assets", () => {
    expect(
      normalizePrecacheAssetPaths([
        "manifest.webmanifest",
        ".\\assets\\TodayPage-def456.js",
        "./assets/index-abc123.js",
        "assets/index-abc123.js",
        "pwa-icon.svg",
        "index.html"
      ])
    ).toEqual([
      "assets/TodayPage-def456.js",
      "assets/index-abc123.js",
      "index.html",
      "manifest.webmanifest",
      "pwa-icon.svg"
    ]);
  });

  it("excludes the worker itself and unsafe paths", () => {
    expect(
      normalizePrecacheAssetPaths([
        "sw.js",
        "_headers",
        "../outside.js",
        "/absolute.js",
        "assets/../outside.js",
        ""
      ])
    ).toEqual([]);
  });
});
