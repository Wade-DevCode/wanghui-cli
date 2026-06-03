import type { ToolDefinition } from "../tools/registry.js";

export type ProviderRole = "system" | "user" | "assistant" | "tool";

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderSendInput {
  messages: ProviderMessage[];
  tools: ToolDefinition[];
}

export interface ProviderResponse {
  content: string;
  toolCalls: NormalizedToolCall[];
  raw: unknown;
}

export interface ModelProvider {
  name: string;
  send(input: ProviderSendInput): Promise<ProviderResponse>;
}

export type FetchLike = typeof fetch;
