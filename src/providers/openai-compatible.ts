import type { FetchLike, ModelProvider, ProviderMessage, ProviderResponse } from "./types.js";
import type { ToolDefinition } from "../tools/registry.js";

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: FetchLike;
  name?: string;
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name ?? "openai-compatible";
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(input: { messages: ProviderMessage[]; tools: ToolDefinition[] }): Promise<ProviderResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: input.messages.map(toOpenAIMessage),
        tools: input.tools.map(toOpenAITool),
        tool_choice: input.tools.length > 0 ? "auto" : undefined,
      }),
    });

    const json = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(normalizeProviderError(response.status, json));
    }

    const message = json.choices?.[0]?.message ?? {};
    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls
          .filter((call: any) => call?.type === "function")
          .map((call: any) => ({
            id: String(call.id),
            name: String(call.function?.name),
            input: parseJsonObject(call.function?.arguments ?? "{}"),
          }))
      : [];

    return {
      content: typeof message.content === "string" ? message.content : "",
      toolCalls,
      raw: json,
    };
  }
}

function toOpenAIMessage(message: ProviderMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      name: message.name,
      content: message.content,
    };
  }
  return { role: message.role, content: message.content };
}

function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Tool call arguments must be a JSON object.");
}

function normalizeProviderError(status: number, body: unknown): string {
  const message = (body as any)?.error?.message ?? (body as any)?.message ?? JSON.stringify(body);
  return `Provider request failed (${status}): ${message}`;
}
