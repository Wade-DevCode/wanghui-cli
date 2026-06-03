import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent/agent.js";
import type { ModelProvider } from "../src/providers/types.js";
import { createToolRegistry } from "../src/tools/registry.js";

describe("runAgent", () => {
  it("executes tool calls and returns the final assistant message", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-agent-"));
    let turn = 0;
    const provider: ModelProvider = {
      name: "fake",
      async send() {
        turn += 1;
        if (turn === 1) {
          return {
            content: "",
            toolCalls: [{ id: "1", name: "write_file", input: { filePath: "done.txt", content: "ok" } }],
            raw: {},
          };
        }
        return { content: "Wrote done.txt", toolCalls: [], raw: {} };
      },
    };

    const result = await runAgent({
      task: "write file",
      provider,
      registry: createToolRegistry({ workspace }),
      approvalMode: "never",
      workspace,
      maxTurns: 3,
    });

    expect(result.status).toBe("completed");
    expect(result.finalMessage).toBe("Wrote done.txt");
  });
});
