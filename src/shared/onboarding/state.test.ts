import { describe, expect, it } from "vitest";
import type { OnboardingChecklistItem } from "./checklist";
import {
  findCurrentOnboardingStep,
  ONBOARDING_STORAGE_KEY,
  readOnboardingState,
  writeOnboardingState
} from "./state";

function createStorage(initialValue?: string) {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(ONBOARDING_STORAGE_KEY, initialValue);
  }
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

function createItem(
  id: OnboardingChecklistItem["id"],
  complete: boolean
): OnboardingChecklistItem {
  return {
    id,
    label: id,
    shortLabel: id,
    description: "",
    benefit: "",
    completionHint: "",
    route: `/${id}`,
    complete
  };
}

describe("teacher onboarding state", () => {
  it("round-trips a valid persisted state", () => {
    const storage = createStorage();

    writeOnboardingState(
      { version: 1, status: "active", currentStepId: "students" },
      storage
    );

    expect(readOnboardingState(storage)).toEqual({
      version: 1,
      status: "active",
      currentStepId: "students"
    });
  });

  it("ignores malformed, outdated and unknown states", () => {
    expect(readOnboardingState(createStorage("{invalid"))).toBeNull();
    expect(
      readOnboardingState(
        createStorage(JSON.stringify({ version: 0, status: "active" }))
      )
    ).toBeNull();
    expect(
      readOnboardingState(
        createStorage(
          JSON.stringify({ version: 1, status: "active", currentStepId: "unknown" })
        )
      )
    ).toBeNull();
  });

  it("keeps an unfinished preferred step and otherwise advances", () => {
    const items = [
      createItem("course", true),
      createItem("students", false),
      createItem("schedule", false)
    ];

    expect(findCurrentOnboardingStep(items, "schedule")?.id).toBe("schedule");
    expect(findCurrentOnboardingStep(items, "course")?.id).toBe("students");
    expect(
      findCurrentOnboardingStep(items.map((item) => ({ ...item, complete: true })))
    ).toBeNull();
  });
});
