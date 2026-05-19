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

const EXTENSION_EVENT_TARGET = "ai-runtime-extension";
const READY_EVENT = "ai-runtime-extension:ready";
const PING_EVENT = "ai-runtime-extension:ping";
const ACTIVATE_EVENT = "ai-runtime-extension:activate";
const PROMPT_EVENT = "ai-runtime-extension:prompt";
const PROMPT_RESULT_EVENT = "ai-runtime-extension:prompt-result";
const DEFAULT_TIMEOUT_MS = 180000;

type ExtensionReadyDetail = {
  target?: string;
  extensionId?: string;
  version?: string;
};

type PromptResultDetail = {
  target?: string;
  ok?: boolean;
  requestId?: string;
  response?: unknown;
  error?: string | null;
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

function createRequestId(): string {
  return crypto.randomUUID();
}

function dispatchExtensionEvent(type: string, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(
    new CustomEvent(type, {
      detail: {
        target: EXTENSION_EVENT_TARGET,
        ...detail
      }
    })
  );
}

function dispatchPromptEvent(requestId: string, payload: Record<string, unknown>): void {
  dispatchExtensionEvent(PROMPT_EVENT, {
    payload: {
      requestId,
      ...payload
    }
  });
}

function messageListToPrompt(messages: AiMessage[]): string {
  return messages
    .map((message) => {
      const content = message.content.trim();
      if (!content) {
        return "";
      }
      return `[${message.role.toUpperCase()}]\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
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
  dispatchExtensionEvent(ACTIVATE_EVENT);
}

export function detectAiExtension(timeoutMs = 1200): Promise<ExtensionReadyDetail | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (detail: ExtensionReadyDetail | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener(READY_EVENT, handleReady as EventListener);
      clearTimeout(timeoutId);
      resolve(detail);
    };
    const handleReady = (event: CustomEvent<ExtensionReadyDetail>) => {
      const detail = event.detail;
      if (detail?.target === EXTENSION_EVENT_TARGET && detail.extensionId) {
        finish(detail);
      }
    };
    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener(READY_EVENT, handleReady as EventListener);
    dispatchExtensionEvent(PING_EVENT);
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
    provider: typed.provider ?? "webllm",
    model: typed.model ?? "unknown"
  };
}

export async function generateAiText(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiChatResult> {
  const normalizedMessages = normalizeMessages(messages);
  const prompt = messageListToPrompt(normalizedMessages);
  if (!prompt) {
    throw new Error("AI prompt is empty.");
  }

  const detected = await detectAiExtension();
  if (!detected) {
    throw new Error("AI Runtime extension is not active on this page. Reload the page after loading the extension.");
  }

  activateAiExtensionModule();
  const requestId = createRequestId();

  return await new Promise<AiChatResult>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for the AI runtime extension."));
    }, DEFAULT_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener(PROMPT_RESULT_EVENT, handlePromptResult as EventListener);
    };

    const handlePromptResult = (event: CustomEvent<PromptResultDetail>) => {
      const detail = event.detail;
      if (detail?.target !== EXTENSION_EVENT_TARGET || detail.requestId !== requestId) {
        return;
      }
      cleanup();
      if (!detail.ok) {
        try {
          if (detail.response) {
            extractChatResult(detail.response);
          }
        } catch (error) {
          reject(error);
          return;
        }
        reject(new Error(detail.error || "AI runtime extension error."));
        return;
      }
      try {
        const result = extractChatResult(detail.response);
        options.onDelta?.(result.text);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    window.addEventListener(PROMPT_RESULT_EVENT, handlePromptResult as EventListener);
    dispatchPromptEvent(requestId, {
      prompt,
      messages: normalizedMessages,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.attachments ? { attachments: options.attachments } : {}),
      options: {
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
        ...(options.responseFormat ? { responseFormat: options.responseFormat } : {})
      }
    });
  });
}
