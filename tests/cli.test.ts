import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli/args.js";

describe("parseArgs", () => {
  it("parses run mode", () => {
    const parsed = parseArgs(["run", "fix bug", "--provider", "openai", "--model", "gpt-5.2", "--yes"]);
    expect(parsed.command).toBe("run");
    expect(parsed.task).toBe("fix bug");
    expect(parsed.provider).toBe("openai");
    expect(parsed.model).toBe("gpt-5.2");
    expect(parsed.yes).toBe(true);
  });

  it("defaults to repl mode", () => {
    expect(parseArgs([]).command).toBe("repl");
  });
});
