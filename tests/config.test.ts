import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config/config.js";

describe("resolveConfig", () => {
  it("resolves OpenAI from flags and env", () => {
    const config = resolveConfig({
      argv: ["run", "fix tests", "--provider", "openai", "--model", "gpt-5.2"],
      env: { OPENAI_API_KEY: "openai-key" },
      cwd: "/repo",
    });

    expect(config.command).toBe("run");
    expect(config.task).toBe("fix tests");
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-5.2");
    expect(config.apiKey).toBe("openai-key");
    expect(config.cwd).toBe("/repo");
  });

  it("defaults OpenAI to GPT-5.5 when no model flag is provided", () => {
    const config = resolveConfig({
      argv: ["run", "fix tests", "--provider", "openai"],
      env: { OPENAI_API_KEY: "openai-key" },
      cwd: "/repo",
    });

    expect(config.model).toBe("gpt-5.5");
  });

  it("uses OpenRouter key and base URL for openrouter provider", () => {
    const config = resolveConfig({
      argv: ["run", "inspect", "--provider", "openrouter", "--model", "anthropic/claude-sonnet-4.6"],
      env: { OPENROUTER_API_KEY: "router-key" },
      cwd: "/repo",
    });

    expect(config.apiKey).toBe("router-key");
    expect(config.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("throws an actionable error when the selected provider has no API key", () => {
    expect(() =>
      resolveConfig({
        argv: ["run", "hello", "--provider", "anthropic", "--model", "claude-sonnet-4-6"],
        env: {},
        cwd: "/repo",
      }),
    ).toThrow("ANTHROPIC_API_KEY");
  });
});
