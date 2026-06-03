import type { WadeConfig } from "../config/config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { ModelProvider } from "./types.js";

export function createProvider(config: WadeConfig): ModelProvider {
  if (config.provider === "anthropic") {
    return new AnthropicProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    });
  }

  return new OpenAICompatibleProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    name: config.provider,
  });
}
