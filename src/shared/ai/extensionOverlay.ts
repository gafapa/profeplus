const EXTENSION_EVENT_TARGET = "ai-runtime-extension";
const ACTIVATE_EVENT = "ai-runtime-extension:activate";

export function enableAiExtensionOverlay(): void {
  window.dispatchEvent(
    new CustomEvent(ACTIVATE_EVENT, {
      detail: {
        target: EXTENSION_EVENT_TARGET
      }
    })
  );
}
