import type { OnboardingChecklistItem } from "./checklist";

export const ONBOARDING_STORAGE_KEY = "profeplus.teacher-onboarding";
export const ONBOARDING_VERSION = 1;

export type OnboardingStatus = "active" | "dismissed" | "completed";

export type OnboardingState = {
  version: typeof ONBOARDING_VERSION;
  status: OnboardingStatus;
  currentStepId?: OnboardingChecklistItem["id"];
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

const validStepIds = new Set<OnboardingChecklistItem["id"]>([
  "course",
  "students",
  "schedule",
  "subjects"
]);

export function readOnboardingState(storage?: StorageReader): OnboardingState | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<OnboardingState>;
    const validStatus =
      parsed.status === "active" ||
      parsed.status === "dismissed" ||
      parsed.status === "completed";
    const validStepId =
      parsed.currentStepId === undefined || validStepIds.has(parsed.currentStepId);

    if (parsed.version !== ONBOARDING_VERSION || !validStatus || !validStepId) {
      return null;
    }

    return parsed as OnboardingState;
  } catch {
    return null;
  }
}

export function writeOnboardingState(
  state: OnboardingState,
  storage?: StorageWriter
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Onboarding remains usable when private browsing or storage policies block persistence.
  }
}

export function findCurrentOnboardingStep(
  items: OnboardingChecklistItem[],
  preferredStepId?: OnboardingChecklistItem["id"]
): OnboardingChecklistItem | null {
  const preferredItem = items.find(
    (item) => item.id === preferredStepId && !item.complete
  );
  return preferredItem ?? items.find((item) => !item.complete) ?? null;
}
