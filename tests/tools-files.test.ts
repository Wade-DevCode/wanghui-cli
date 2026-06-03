import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listDirectory, readTextFile, resolveWorkspacePath, writeTextFile } from "../src/tools/files.js";

describe("file tools", () => {
  it("reads and writes inside the workspace", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-tools-"));
    await writeTextFile({ workspace, filePath: "notes.txt", content: "hello" });
    await expect(readFile(path.join(workspace, "notes.txt"), "utf8")).resolves.toBe("hello");
    await expect(readTextFile({ workspace, filePath: "notes.txt" })).resolves.toContain("hello");
  });

  it("rejects paths outside the workspace", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-tools-"));
    expect(() => resolveWorkspacePath(workspace, "../outside.txt")).toThrow("outside workspace");
  });

  it("lists directory entries", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-tools-"));
    await writeFile(path.join(workspace, "a.txt"), "a");
    const result = await listDirectory({ workspace, dirPath: "." });
    expect(result).toContain("a.txt");
  });
});
