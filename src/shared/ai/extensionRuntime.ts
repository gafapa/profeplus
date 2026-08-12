export type AiProviderId = "openrouter" | "ollama" | "lmstudio" | "anthropic" | "webllm" | (string & {});

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatOptions = {
  provider?: AiProviderId;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
  attachments?: AiAttachment[];
  onDelta?: (delta: string) => void;
};

export type AiAttachment = {
  name: string;
  mimeType?: string;
  text?: string;
  data?: ArrayBuffer | Uint8Array;
};

export type AiChatResult = {
  text: string;
  provider: AiProviderId;
  model: string;
};

export type AiPageStatus = {
  extensionId: string;
  version: string;
  origin: string;
  authorized: boolean;
  appConfig: {
    provider?: AiProviderId;
    model?: string;
  };
  availableProviders: Array<{
    provider: AiProviderId;
    models: string[];
  }>;
  availableProviderCount: number;
};

const PAGE_SOURCE = "profeplus";
const EXTENSION_SOURCE = "ai-runtime-extension";
const PAGE_PROTOCOL = "ai-runtime-extension-bridge";
const PAGE_PROTOCOL_VERSION = 1;
const PAGE_PING_MESSAGE = "ai-runtime-ping";
const PAGE_AVAILABLE_MESSAGE = "ai-runtime-available";
const PAGE_REQUEST_MESSAGE = "ai-runtime-request";
const PAGE_RESPONSE_MESSAGE = "ai-runtime-response";
const DEFAULT_TIMEOUT_MS = 180_000;

type ExtensionAvailabilityMessage = {
  source: typeof EXTENSION_SOURCE;
  protocol: typeof PAGE_PROTOCOL;
  version: typeof PAGE_PROTOCOL_VERSION;
  type: typeof PAGE_AVAILABLE_MESSAGE;
  extensionId: string;
  extensionVersion?: string;
};

type ExtensionResponseMessage = {
  source: typeof EXTENSION_SOURCE;
  protocol: typeof PAGE_PROTOCOL;
  version: typeof PAGE_PROTOCOL_VERSION;
  type: typeof PAGE_RESPONSE_MESSAGE;
  extensionId: string;
  requestId?: string;
  ok?: boolean;
  result?: unknown;
  error?: string | { message?: string } | null;
};

type RuntimeChatResponse = {
  type?: string;
  requestId?: string;
  text?: string;
  provider?: string;
  model?: string;
  usage?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

function configuredExtensionId(): string {
  return import.meta.env.VITE_AI_RUNTIME_EXTENSION_ID?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isCompatibleAiExtensionMessage(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.source === EXTENSION_SOURCE &&
    value.protocol === PAGE_PROTOCOL &&
    value.version === PAGE_PROTOCOL_VERSION &&
    (value.type === PAGE_AVAILABLE_MESSAGE || value.type === PAGE_RESPONSE_MESSAGE) &&
    typeof value.extensionId === "string" &&
    value.extensionId.length > 0
  );
}

function isTrustedWindowMessage(event: MessageEvent): boolean {
  return (
    (event.source === window || event.source === null) &&
    event.origin === window.location.origin &&
    isCompatibleAiExtensionMessage(event.data)
  );
}

function postPageMessage(type: string, payload: Record<string, unknown> = {}): void {
  window.postMessage(
    {
      source: PAGE_SOURCE,
      protocol: PAGE_PROTOCOL,
      version: PAGE_PROTOCOL_VERSION,
      type,
      ...payload
    },
    window.location.origin
  );
}

function createRequestId(): string {
  return crypto.randomUUID();
}

function normalizeMessages(messages: AiMessage[]): AiMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim()
    }))
    .filter((message) => message.content.length > 0);
}

export function activateAiExtensionModule(): void {
  postPageMessage(PAGE_PING_MESSAGE);
}

export function detectAiExtension(timeoutMs = 1200): Promise<ExtensionAvailabilityMessage | null> {
  return new Promise((resolve) => {
    const expectedExtensionId = configuredExtensionId();
    let settled = false;
    const finish = (message: ExtensionAvailabilityMessage | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeoutId);
      resolve(message);
    };
    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedWindowMessage(event)) return;
      const message = event.data as ExtensionAvailabilityMessage;
      if (
        message.type === PAGE_AVAILABLE_MESSAGE &&
        (!expectedExtensionId || message.extensionId === expectedExtensionId)
      ) {
        finish(message);
      }
    };
    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", handleMessage);
    postPageMessage(PAGE_PING_MESSAGE);
  });
}

function extractChatResult(response: unknown): AiChatResult {
  const typed = response as RuntimeChatResponse | null;
  if (typed?.type === "runtime.chat.error" || typed?.type === "runtime.error") {
    throw new Error(typed.error?.message || typed.error?.code || "AI runtime extension error.");
  }
  if (typeof typed?.text !== "string" || (typed.type && typed.type !== "runtime.chat.result")) {
    throw new Error("AI runtime extension returned an invalid response.");
  }
  return {
    text: typed.text,
    provider: typed.provider ?? "unknown",
    model: typed.model ?? "unknown"
  };
}

function extensionErrorMessage(error: ExtensionResponseMessage["error"]): string {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && typeof error.message === "string") return error.message;
  return "AI runtime extension error.";
}

export async function generateAiText(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) {
    throw new Error("AI prompt is empty.");
  }

  const detected = await detectAiExtension();
  if (!detected) {
    throw new Error("AI Runtime extension is not active or does not match the configured extension ID.");
  }

  const requestId = createRequestId();
  const expectedExtensionId = configuredExtensionId() || detected.extensionId;

  return new Promise<AiChatResult>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
    };
    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedWindowMessage(event)) return;
      const message = event.data as ExtensionResponseMessage;
      if (message.type !== PAGE_RESPONSE_MESSAGE || message.requestId !== requestId) return;
      if (message.extensionId !== expectedExtensionId) {
        cleanup();
        reject(new Error("AI runtime extension identity could not be verified."));
        return;
      }
      cleanup();
      if (!message.ok) {
        reject(new Error(extensionErrorMessage(message.error)));
        return;
      }
      try {
        const result = extractChatResult(message.result);
        options.onDelta?.(result.text);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for the AI runtime extension."));
    }, DEFAULT_TIMEOUT_MS);

    window.addEventListener("message", handleMessage);
    postPageMessage(PAGE_REQUEST_MESSAGE, {
      requestId,
      payload: {
        type: "runtime.chat",
        messages: normalizedMessages,
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
        ...(options.attachments ? { attachments: options.attachments } : {}),
        options: {
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
          ...(options.responseFormat ? { responseFormat: options.responseFormat } : {})
        }
      }
    });
  });
}
