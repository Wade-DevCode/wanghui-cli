# Wade's CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP Wade's CLI as an original TypeScript/Node.js coding-agent CLI with REPL, one-shot run mode, multi-provider adapters, local tools, approvals, and session logs.

**Architecture:** The CLI layer parses commands and delegates to a provider-agnostic agent loop. Providers normalize OpenAI/OpenRouter Chat Completions and Anthropic Messages tool calls into one internal shape. Tools resolve paths inside the workspace, approval policy gates writes and shell commands, and session logs record run events.

**Tech Stack:** TypeScript, Node.js ESM, npm, Vitest, tsx, tsup, raw `fetch` provider adapters.

---

## File Structure

- Create `package.json`, `tsconfig.json`, `.gitignore`: project metadata, build/test scripts, ignored generated output.
- Create `src/providers/types.ts`: common provider, message, tool definition, tool call, and response types.
- Create `src/providers/openai-compatible.ts`: OpenAI/OpenRouter/compatible Chat Completions adapter.
- Create `src/providers/anthropic.ts`: Anthropic Messages adapter.
- Create `src/providers/factory.ts`: provider creation from resolved config.
- Create `src/config/config.ts`: CLI/env/config-file resolution and validation.
- Create `src/approval/policy.ts`: default, yes, and never approval decisions plus command risk classification.
- Create `src/tools/path.ts`: workspace path resolution.
- Create `src/tools/files.ts`: list/read/search/write/apply-patch tools.
- Create `src/tools/shell.ts`: shell execution tool.
- Create `src/tools/registry.ts`: tool schemas and dispatch.
- Create `src/session/session-log.ts`: append-only JSONL session events.
- Create `src/agent/system-prompt.ts`: clean-room agent instructions.
- Create `src/agent/agent.ts`: multi-turn tool loop.
- Create `src/cli/args.ts`: command-line parser.
- Create `src/cli/repl.ts`: interactive session.
- Create `src/cli/main.ts`: executable entry point.
- Create tests under `tests/**`.

## Task 1: Scaffold Project and Config Tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/config/config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config.test.ts`
Expected: fail because the project and `resolveConfig` do not exist yet.

- [ ] **Step 3: Implement minimal scaffold and config resolver**

Create npm scripts for `test`, `build`, and `dev`. Implement `resolveConfig` with command detection, provider/model flags, API key lookup, `--yes`, `--approval`, `--base-url`, and `--cwd`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add package.json package-lock.json tsconfig.json .gitignore src/config/config.ts tests/config.test.ts && git commit -m "feat: add CLI config resolution"`

## Task 2: Approval Policy

**Files:**
- Create: `src/approval/policy.ts`
- Test: `tests/approval.test.ts`

- [ ] **Step 1: Write failing approval tests**

```ts
import { describe, expect, it } from "vitest";
import { decideApproval } from "../src/approval/policy.js";

describe("decideApproval", () => {
  it("auto-allows read tools in default mode", () => {
    expect(decideApproval({ mode: "default", toolName: "read_file", input: {} }).decision).toBe("allow");
  });

  it("requires confirmation for writes and shell in default mode", () => {
    expect(decideApproval({ mode: "default", toolName: "write_file", input: {} }).decision).toBe("confirm");
    expect(decideApproval({ mode: "default", toolName: "run_shell", input: { command: "npm test" } }).decision).toBe("confirm");
  });

  it("classifies destructive shell commands as blocked in never mode", () => {
    const result = decideApproval({ mode: "never", toolName: "run_shell", input: { command: "git reset --hard" } });
    expect(result.decision).toBe("block");
    expect(result.risk).toBe("high");
  });

  it("allows ordinary shell commands in never mode", () => {
    expect(decideApproval({ mode: "never", toolName: "run_shell", input: { command: "npm test" } }).decision).toBe("allow");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/approval.test.ts`
Expected: fail because policy does not exist.

- [ ] **Step 3: Implement policy**

Define modes `default`, `yes`, and `never`. Read tools are low-risk. Writes and shell require confirmation by default. `yes` and `never` auto-allow ordinary writes/shell. Dangerous shell patterns such as `git reset --hard`, `rm -rf`, `Remove-Item -Recurse`, `del /s`, `format`, package install, and network download commands are high-risk and blocked in `never`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/approval.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add src/approval/policy.ts tests/approval.test.ts && git commit -m "feat: add approval policy"`

## Task 3: Workspace File Tools

**Files:**
- Create: `src/tools/path.ts`
- Create: `src/tools/files.ts`
- Test: `tests/tools-files.test.ts`

- [ ] **Step 1: Write failing file tool tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools-files.test.ts`
Expected: fail because file tools do not exist.

- [ ] **Step 3: Implement file tools**

Implement path containment, list directory, bounded text read, full-file write, and a simple unified-patch application that shells out to `git apply --whitespace=nowarn` when available.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools-files.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add src/tools/path.ts src/tools/files.ts tests/tools-files.test.ts && git commit -m "feat: add workspace file tools"`

## Task 4: Shell Tool and Tool Registry

**Files:**
- Create: `src/tools/shell.ts`
- Create: `src/tools/registry.ts`
- Test: `tests/tools-registry.test.ts`

- [ ] **Step 1: Write failing registry tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools-registry.test.ts`
Expected: fail because registry does not exist.

- [ ] **Step 3: Implement shell and registry**

Implement `runShell` with timeout, cwd, stdout/stderr truncation, and structured results. Add JSON-schema-like tool definitions for all MVP tools and dispatch them through `createToolRegistry`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools-registry.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add src/tools/shell.ts src/tools/registry.ts tests/tools-registry.test.ts && git commit -m "feat: add tool registry"`

## Task 5: Provider Adapters

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/openai-compatible.ts`
- Create: `src/providers/anthropic.ts`
- Create: `src/providers/factory.ts`
- Test: `tests/providers.test.ts`

- [ ] **Step 1: Write failing provider tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";

describe("providers", () => {
  it("normalizes OpenAI-compatible tool calls", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: "{\"filePath\":\"README.md\"}" } }] } }],
    }), { status: 200 }));
    const provider = new OpenAICompatibleProvider({ apiKey: "key", baseUrl: "https://api.openai.com/v1", model: "gpt-5.2", fetchImpl: fetchMock });
    const response = await provider.send({ messages: [{ role: "user", content: "read" }], tools: [] });
    expect(response.toolCalls[0]).toEqual({ id: "call_1", name: "read_file", input: { filePath: "README.md" } });
  });

  it("normalizes Anthropic tool_use blocks", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: [{ type: "tool_use", id: "toolu_1", name: "read_file", input: { filePath: "README.md" } }],
      stop_reason: "tool_use",
    }), { status: 200 }));
    const provider = new AnthropicProvider({ apiKey: "key", model: "claude-sonnet-4-6", fetchImpl: fetchMock });
    const response = await provider.send({ messages: [{ role: "user", content: "read" }], tools: [] });
    expect(response.toolCalls[0]).toEqual({ id: "toolu_1", name: "read_file", input: { filePath: "README.md" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/providers.test.ts`
Expected: fail because provider files do not exist.

- [ ] **Step 3: Implement provider adapters**

Implement raw `fetch` calls for `/chat/completions` and `/v1/messages`, including tool definition conversion, message conversion, API headers, JSON parsing, and normalized provider errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/providers.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add src/providers tests/providers.test.ts && git commit -m "feat: add model provider adapters"`

## Task 6: Agent Loop and Session Log

**Files:**
- Create: `src/session/session-log.ts`
- Create: `src/agent/system-prompt.ts`
- Create: `src/agent/agent.ts`
- Test: `tests/agent.test.ts`

- [ ] **Step 1: Write failing agent test**

```ts
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
          return { content: "", toolCalls: [{ id: "1", name: "write_file", input: { filePath: "done.txt", content: "ok" } }], raw: {} };
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent.test.ts`
Expected: fail because agent does not exist.

- [ ] **Step 3: Implement agent loop and session logging**

Implement clean-room system prompt, provider message history, approval checks, tool execution, tool result messages, max turn guard, and optional JSONL session logging.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add src/agent src/session tests/agent.test.ts && git commit -m "feat: add agent loop"`

## Task 7: CLI Entry and Smoke Tests

**Files:**
- Create: `src/cli/args.ts`
- Create: `src/cli/repl.ts`
- Create: `src/cli/main.ts`
- Modify: `package.json`
- Test: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli.test.ts`
Expected: fail because CLI args do not exist.

- [ ] **Step 3: Implement CLI**

Implement executable main, REPL loop with `/exit`, one-shot `run`, config resolution, provider factory, tool registry, and process exit codes.

- [ ] **Step 4: Run test and full verification**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: build succeeds.

Run: `node dist/cli/main.js --help`
Expected: help text prints.

- [ ] **Step 5: Commit**

Run: `git add src/cli package.json tests/cli.test.ts && git commit -m "feat: add Wade CLI entrypoint"`

## Task 8: Documentation and Final Verification

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write README**

Document install, build, commands, providers, environment variables, approvals, and examples.

- [ ] **Step 2: Run final checks**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: build succeeds.

Run: `git status --short`
Expected: only intended README/doc changes before the final commit.

- [ ] **Step 3: Commit**

Run: `git add README.md .gitignore docs/superpowers/plans/2026-06-03-wades-cli-implementation.md && git commit -m "docs: add Wade CLI usage guide"`

