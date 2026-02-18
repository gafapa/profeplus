export const WEBLLM_MODELS = [
  "Llama-3.2-1B-Instruct-q4f32_1-MLC",
  "Llama-3.2-3B-Instruct-q4f32_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
  "Qwen2.5-3B-Instruct-q4f32_1-MLC",
  "Phi-3.5-mini-instruct-q4f32_1-MLC",
  "Mistral-7B-Instruct-v0.3-q4f32_1-MLC"
] as const;

export const DEFAULT_WEBLLM_MODEL = WEBLLM_MODELS[0];
