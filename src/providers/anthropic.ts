import type { FetchLike, ModelProvider, ProviderMessage, ProviderResponse } from "./types.js";
import type { ToolDefinition } from "../tools/registry.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(input: { messages: ProviderMessage[]; tools: ToolDefinition[] }): Promise<ProviderResponse> {
    const { system, messages } = toAnthropicMessages(input.messages);
    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: system || undefined,
        messages,
        tools: input.tools.map(toAnthropicTool),
      }),
    });

    const json = (await response.json()) as any;
    if (!response.ok) {
      throw new Error(normalizeProviderError(response.status, json));
    }

    const contentBlocks = Array.isArray(json.content) ? json.content : [];
    const text = contentBlocks
      .filter((block: any) => block?.type === "text" && typeof block.text === "string")
      .map((block: any) => block.text)
      .join("\n");
    const toolCalls = contentBlocks
      .filter((block: any) => block?.type === "tool_use")
      .map((block: any) => ({
        id: String(block.id),
        name: String(block.name),
        input: block.input && typeof block.input === "object" && !Array.isArray(block.input) ? block.input : {},
      }));

    return { content: text, toolCalls, raw: json };
  }
}

function toAnthropicMessages(messages: ProviderMessage[]): {
  system: string;
  messages: Array<Record<string, unknown>>;
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const converted = messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      if (message.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.toolCallId,
              content: message.content,
            },
          ],
        };
      }
      return {
        role: message.role,
        content: message.content,
      };
    });

  return { system, messages: converted };
}

function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

function normalizeProviderError(status: number, body: unknown): string {
  const message = (body as any)?.error?.message ?? (body as any)?.message ?? JSON.stringify(body);
  return `Provider request failed (${status}): ${message}`;
}
