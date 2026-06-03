import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../src/tools/registry.js";

describe("tool registry", () => {
  it("executes registered file tools", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-registry-"));
    const registry = createToolRegistry({ workspace });
    const result = await registry.execute("write_file", { filePath: "a.txt", content: "hello" });
    expect(result.ok).toBe(true);
  });

  it("returns a structured failure for unknown tools", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-registry-"));
    const registry = createToolRegistry({ workspace });
    const result = await registry.execute("missing_tool", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});
