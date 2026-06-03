import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";

describe("providers", () => {
  it("normalizes OpenAI-compatible tool calls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: { name: "read_file", arguments: "{\"filePath\":\"README.md\"}" },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAICompatibleProvider({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.2",
      fetchImpl: fetchMock,
    });
    const response = await provider.send({ messages: [{ role: "user", content: "read" }], tools: [] });
    expect(response.toolCalls[0]).toEqual({ id: "call_1", name: "read_file", input: { filePath: "README.md" } });
  });

  it("normalizes Anthropic tool_use blocks", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: "tool_use", id: "toolu_1", name: "read_file", input: { filePath: "README.md" } }],
          stop_reason: "tool_use",
        }),
        { status: 200 },
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "key", model: "claude-sonnet-4-6", fetchImpl: fetchMock });
    const response = await provider.send({ messages: [{ role: "user", content: "read" }], tools: [] });
    expect(response.toolCalls[0]).toEqual({ id: "toolu_1", name: "read_file", input: { filePath: "README.md" } });
  });
});
