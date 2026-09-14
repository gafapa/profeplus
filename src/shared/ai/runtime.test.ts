import { afterEach, describe, expect, it, vi } from "vitest";
import * as proxyBridge from "../backup/nextcloud";
import {
  AiRuntimeError,
  generateAiText,
  getAiErrorMessage,
  isAiProviderId,
  listAiModelDetails,
  normalizeAiConfiguration,
  normalizeAiModelCatalog,
  normalizeLocalBaseUrl,
  saveAiConfiguration
} from "./runtime";
import { testAiConnection } from "./runtime";

describe("Ollama through Proxy", () => {
  it("uses the bridge for model discovery without direct fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const bridge = vi.spyOn(proxyBridge, "proxyMessage").mockResolvedValueOnce("test").mockResolvedValueOnce({
      status: 200, finalUrl: "http://localhost:11434/api/tags", bodyText: JSON.stringify({ models: [{ name: "qwen3:8b" }] })
    });
    await expect(listAiModelDetails({ provider: "ollama" })).resolves.toMatchObject([{ id: "qwen3:8b" }]);
    expect(bridge).toHaveBeenLastCalledWith("bridge-request", expect.objectContaining({ method: "GET", allowPrivateNetwork: true }), expect.any(AbortSignal));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tests with sufficient output budget without changing report thinking", async () => {
    saveAiConfiguration({ provider: "ollama", model: "qwen3:8b", rememberApiKey: false });
    const bridge = vi.spyOn(proxyBridge, "proxyMessage").mockImplementation(async (type) => type === "bridge-ping" ? "test" : {
      status: 200, finalUrl: "http://localhost:11434/api/chat", bodyText: JSON.stringify({ message: { content: "Conectado" } })
    });
    await expect(testAiConnection()).resolves.toMatchObject({ text: "Conectado" });
    const probe = JSON.parse(bridge.mock.calls[1][1]!.body!);
    expect(probe.think).toBe(false);
    expect(probe.options.num_predict).toBeGreaterThan(16);
    await generateAiText([{ role: "user", content: "Synthetic report" }]);
    expect(JSON.parse(bridge.mock.calls[3][1]!.body!)).not.toHaveProperty("think");
  });

  it("does not fall back to fetch when Proxy fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(proxyBridge, "proxyMessage").mockRejectedValue(new Error("Unavailable"));
    await expect(listAiModelDetails({ provider: "ollama" })).rejects.toMatchObject({ code: "PROXY_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects redirected bridge results", async () => {
    vi.spyOn(proxyBridge, "proxyMessage").mockResolvedValueOnce("test").mockResolvedValueOnce({ status: 200, finalUrl: "https://other.example", bodyText: "{}" });
    await expect(listAiModelDetails({ provider: "ollama" })).rejects.toMatchObject({ code: "PROXY_FAILED" });
  });

  it("distinguishes exhausted reasoning from an invalid response", async () => {
    saveAiConfiguration({ provider: "ollama", model: "qwen3:8b", rememberApiKey: false });
    vi.spyOn(proxyBridge, "proxyMessage").mockResolvedValueOnce("test").mockResolvedValueOnce({
      status: 200, finalUrl: "http://localhost:11434/api/chat", bodyText: JSON.stringify({ message: { content: "", thinking: "Synthetic reasoning" }, done_reason: "length" })
    });
    await expect(generateAiText([{ role: "user", content: "Synthetic report" }])).rejects.toMatchObject({ code: "OUTPUT_EXHAUSTED" });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("direct AI runtime configuration", () => {
  it("aborts an in-flight generation without reporting a timeout", async () => {
    saveAiConfiguration({ provider: "openai", model: "test", apiKey: "test", rememberApiKey: false });
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const request = generateAiText([{ role: "user", content: "Simulated report" }], { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("marks provider-truncated output explicitly", async () => {
    saveAiConfiguration({ provider: "openai", model: "test", apiKey: "test", rememberApiKey: false });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "Partial report" } }] })));
    await expect(generateAiText([{ role: "user", content: "Simulated report" }])).resolves.toMatchObject({ truncated: true, text: "Partial report" });
  });
  it("accepts only the built-in direct providers", () => {
    expect(isAiProviderId("openrouter")).toBe(true);
    expect(isAiProviderId("ollama")).toBe(true);
    expect(isAiProviderId("webllm")).toBe(false);
    expect(isAiProviderId(42)).toBe(false);
  });

  it("normalizes stored provider, model, and local endpoint values", () => {
    expect(normalizeAiConfiguration({
      provider: "ollama",
      model: " llama3.2 ",
      baseUrl: "http://127.0.0.1:11434/"
    })).toEqual({
      version: 1,
      provider: "ollama",
      model: "llama3.2",
      baseUrl: "http://127.0.0.1:11434"
    });
    expect(normalizeAiConfiguration({ provider: "unknown", model: "x" })).toEqual({ version: 1 });
  });

  it("restricts local endpoints to the current device", () => {
    expect(normalizeLocalBaseUrl("http://localhost:1234/v1/", "lmstudio"))
      .toBe("http://localhost:1234/v1");
    expect(() => normalizeLocalBaseUrl("https://example.com/v1", "lmstudio"))
      .toThrowError(AiRuntimeError);
    expect(() => normalizeLocalBaseUrl("http://user:secret@localhost:11434", "ollama"))
      .toThrowError(AiRuntimeError);
  });

  it("turns runtime failures into actionable Spanish messages", () => {
    expect(getAiErrorMessage(new AiRuntimeError("API_KEY_MISSING", "missing", "openai")))
      .toContain("clave API");
    expect(getAiErrorMessage(new AiRuntimeError("NETWORK_FAILED", "offline", "ollama")))
      .toContain("ayuda de configuración");
  });

  it("normalizes rich OpenRouter model metadata", () => {
    expect(normalizeAiModelCatalog("openrouter", {
      data: [{
        id: "acme/model-pro",
        name: "Model Pro",
        description: "A useful model.",
        created: 1_700_000_000,
        context_length: 128_000,
        architecture: {
          input_modalities: ["text", "image"],
          output_modalities: ["text"]
        },
        pricing: { prompt: "0.000002", completion: "0.000006" },
        supported_parameters: ["tools", "response_format", "reasoning"],
        top_provider: { max_completion_tokens: 16_384 }
      }]
    })).toEqual([expect.objectContaining({
      id: "acme/model-pro",
      name: "Model Pro",
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      inputPricePerMillionUsd: 2,
      outputPricePerMillionUsd: 6,
      capabilities: ["text_input", "image_input", "text_output", "tool_use", "structured_outputs", "reasoning"]
    })]);
  });

  it("normalizes Anthropic capability and token limits", () => {
    expect(normalizeAiModelCatalog("anthropic", {
      data: [{
        id: "claude-test",
        display_name: "Claude Test",
        created_at: "2026-07-24T00:00:00Z",
        max_input_tokens: 200_000,
        max_tokens: 64_000,
        capabilities: {
          image_input: { supported: true },
          code_execution: { supported: false },
          structured_outputs: { supported: true }
        }
      }]
    })[0]).toMatchObject({
      id: "claude-test",
      name: "Claude Test",
      contextWindow: 200_000,
      maxOutputTokens: 64_000,
      capabilities: ["image_input", "structured_outputs"]
    });
    expect(normalizeAiModelCatalog("anthropic", {
      data: [{ id: "claude-without-limits", max_input_tokens: null, max_tokens: null }]
    })[0]).toEqual({ id: "claude-without-limits" });
  });

  it("normalizes local model size, architecture, and quantization", () => {
    expect(normalizeAiModelCatalog("ollama", {
      models: [{
        name: "llama3.2:latest",
        modified_at: "2026-09-01T10:00:00Z",
        size: 2_000_000_000,
        details: {
          format: "gguf",
          family: "llama",
          parameter_size: "3B",
          quantization_level: "Q4_K_M"
        }
      }]
    })[0]).toMatchObject({
      id: "llama3.2:latest",
      sizeBytes: 2_000_000_000,
      family: "llama",
      parameterSize: "3B",
      quantization: "Q4_K_M",
      format: "gguf"
    });

    expect(normalizeAiModelCatalog("lmstudio", {
      models: [{ type: "embedding", key: "embedding-model" }, {
        type: "llm",
        key: "google/gemma-test",
        display_name: "Gemma Test",
        publisher: "Google",
        architecture: "gemma",
        quantization: { name: "Q4_K_M" },
        size_bytes: 5_000_000_000,
        params_string: "7B",
        max_context_length: 131_072,
        capabilities: { vision: true, trained_for_tool_use: true }
      }]
    })[0]).toMatchObject({
      id: "google/gemma-test",
      name: "Gemma Test",
      owner: "Google",
      contextWindow: 131_072,
      capabilities: ["image_input", "tool_use"]
    });
  });

  it("fetches model details directly from the selected provider", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "provider/model", name: "Provider Model", context_length: 32_000 }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(listAiModelDetails({ provider: "openrouter", apiKey: "key-test" }))
      .resolves.toEqual([expect.objectContaining({ id: "provider/model", contextWindow: 32_000 })]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/models");
  });

  it("sends chat requests directly to the configured provider", async () => {
    saveAiConfiguration({
      provider: "openai",
      model: "gpt-test",
      apiKey: "sk-test",
      rememberApiKey: false
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        model: "gpt-test-2026-09-03",
        choices: [{ message: { content: "Conectado" } }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(generateAiText(
      [{ role: "user", content: "Ping" }],
      { temperature: 0, maxOutputTokens: 16 }
    )).resolves.toEqual({
      text: "Conectado",
      provider: "openai",
      model: "gpt-test-2026-09-03"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "gpt-test",
      max_completion_tokens: 16,
      temperature: 0
    });
  });
});
