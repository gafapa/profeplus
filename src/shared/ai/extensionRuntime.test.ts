import { describe, expect, it } from "vitest";
import { isCompatibleAiExtensionMessage } from "./extensionRuntime";

describe("AI extension bridge protocol", () => {
  it("accepts only supported, versioned extension envelopes", () => {
    expect(
      isCompatibleAiExtensionMessage({
        source: "ai-runtime-extension",
        protocol: "ai-runtime-extension-bridge",
        version: 1,
        type: "ai-runtime-available",
        extensionId: "abcdefghijklmnopabcdefghijklmnop"
      })
    ).toBe(true);

    expect(
      isCompatibleAiExtensionMessage({
        source: "untrusted-page",
        protocol: "ai-runtime-extension-bridge",
        version: 1,
        type: "ai-runtime-available",
        extensionId: "abcdefghijklmnopabcdefghijklmnop"
      })
    ).toBe(false);
    expect(
      isCompatibleAiExtensionMessage({
        source: "ai-runtime-extension",
        protocol: "ai-runtime-extension-bridge",
        version: 2,
        type: "ai-runtime-response",
        extensionId: "abcdefghijklmnopabcdefghijklmnop"
      })
    ).toBe(false);
  });
});
