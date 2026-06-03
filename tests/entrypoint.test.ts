import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isDirectEntrypoint } from "../src/cli/main.js";

describe("isDirectEntrypoint", () => {
  it("treats symlinked npm bin paths as direct entrypoints", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "wade-entry-"));
    const realScript = path.join(workspace, "main.js");
    const linkedScript = path.join(workspace, "linked-main.js");
    await writeFile(realScript, "", "utf8");
    await symlink(realScript, linkedScript);

    expect(isDirectEntrypoint(linkedScript, pathToFileURL(realScript).href)).toBe(true);
  });
});
