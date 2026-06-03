# Wade's CLI Design

## Goal

Build Wade's CLI as an original TypeScript/Node.js coding-agent CLI. The product can take inspiration from public behavior in tools such as Codex and Claude Code, but it must not use leaked source code, copied proprietary implementation details, or non-public prompts.

The MVP should provide a practical local coding assistant with:

- Interactive REPL via `wade`
- One-shot task execution via `wade run "<task>"`
- Multi-provider model support for OpenAI, Anthropic, and OpenAI-compatible endpoints such as OpenRouter
- A reusable agent loop that can inspect a project, propose or apply edits, run shell commands, and report results
- Conservative approvals by default with an opt-in efficiency mode
- Session logging for traceability and debugging

## Non-Goals

- No use of leaked Claude Code source or derived ports.
- No product-specific claim of compatibility with Claude Code internals.
- No full terminal UI framework in the MVP.
- No MCP/plugin marketplace in the MVP, though the architecture should leave room for it.
- No autonomous background daemon in the MVP.

## Architecture

The project root is `E:\Wade's CLI`. The implementation should use a modular TypeScript layout:

- `src/cli`: command parsing, flags, REPL wiring, and process-level concerns.
- `src/agent`: provider-agnostic agent loop, tool-call routing, task state, and final response handling.
- `src/providers`: model provider interface plus OpenAI, Anthropic, and OpenAI-compatible adapters.
- `src/tools`: local tools for filesystem reads, search, writes, patching, and shell execution.
- `src/approval`: policy decisions for whether a tool can run automatically or requires user confirmation.
- `src/session`: append-only session logs, run metadata, and replay-oriented event records.
- `src/config`: config file loading, environment variable handling, defaults, and validation.
- `tests`: behavior-focused tests for providers, tools, approvals, config, and the agent loop.

The agent core must not depend on REPL or command-line UI code. `wade` and `wade run` should both call the same agent API.

## Commands

`wade` starts an interactive session:

- Shows the current working directory and selected provider/model.
- Accepts natural-language user requests.
- Streams assistant responses when the provider supports streaming.
- Shows tool requests and approval prompts inline.
- Allows exiting with `/exit`.

`wade run "<task>"` executes a single task:

- Runs the same agent loop used by the REPL.
- Prints progress and final output.
- Exits with a nonzero code if the task fails, a denied required approval blocks completion, or a tool returns an unrecoverable error.

Initial useful flags:

- `--provider openai|anthropic|openrouter|compatible`
- `--model <name>`
- `--base-url <url>` for OpenAI-compatible providers
- `--yes` to auto-approve non-destructive write/shell actions according to policy
- `--approval default|never` where `never` is equivalent to an explicit trusted automation mode
- `--cwd <path>` to choose the workspace

## Provider Model

Providers expose one common interface:

- Send messages with system, user, assistant, and tool-result roles.
- Advertise whether native tool calling is supported.
- Normalize provider-specific tool-call requests into a shared internal shape.
- Normalize errors into retryable, auth, rate-limit, invalid-request, and unknown categories.

OpenAI and OpenAI-compatible endpoints should share most adapter code. Anthropic should be implemented separately because its message and tool-use semantics differ.

The MVP may support basic text and tool calls first. More advanced provider features, such as prompt caching or extended thinking, are out of scope unless they fit naturally without complicating the common interface.

## Tools

MVP tools:

- `list_directory`: list files under a directory with depth limits.
- `read_file`: read bounded text content from a file.
- `search_files`: search with ripgrep when available.
- `write_file`: create or replace a file after approval.
- `apply_patch`: apply a unified patch after approval.
- `run_shell`: run a shell command after approval.

Tool implementations should:

- Resolve paths relative to the workspace.
- Block path traversal outside the workspace unless explicitly allowed later.
- Return structured success or failure results.
- Truncate large outputs with clear metadata.
- Avoid destructive behavior unless the approval policy permits it.

## Approval Policy

Default policy:

- Auto-allow low-risk reads: list, read, and search inside the trusted workspace.
- Require confirmation for file writes, patches, and shell commands.
- Treat deletion, broad moves, package installation, network commands, credential-related commands, and Git history modification as high-risk.
- High-risk actions require explicit confirmation even when normal confirmation is enabled.

Automation mode:

- `--yes` can approve ordinary writes and ordinary shell commands.
- `--approval never` can auto-approve according to the strict policy, but still blocks commands classified as dangerous unless a future explicit unsafe flag is added.
- Every approval decision must be logged.

## Config

The MVP should read configuration from:

- Environment variables for API keys.
- A project-local config file such as `wade.config.json`.
- A user-level config file can be added after the MVP if needed.

Expected environment variables:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `WADE_BASE_URL` for compatible providers

Config validation should produce actionable error messages, especially for missing API keys and unsupported provider/model combinations.

## Session Logging

Each run writes a session log under a local ignored directory such as `.wade/sessions`.

Logs should include:

- Start time, cwd, provider, model, command mode, and flags.
- User messages and assistant messages.
- Tool requests, approval decisions, tool outputs, and errors.
- Final status.

Logs must avoid printing secret environment variable values. If a tool output contains likely secrets, redaction can be a later enhancement.

## Error Handling

The CLI should handle:

- Missing API key: clear setup message.
- Provider rate limit or auth failure: concise provider-specific message.
- Tool failure: return the failure to the agent, then allow the agent to recover or explain.
- Approval denial: treat as a normal blocked action and ask the model to continue without it if possible.
- Invalid workspace path: fail before starting the agent.

## Testing Strategy

Implementation should follow test-driven development.

Initial tests:

- Config resolves provider settings from env and flags.
- Approval policy allows reads and requires confirmation for writes/shell by default.
- Approval policy classifies obvious dangerous commands as high-risk.
- File tools resolve paths within the workspace and reject outside paths.
- Provider adapters normalize a simple assistant message and a tool call.
- Agent loop executes a mocked tool call and returns the final assistant response.

Provider tests should use fake HTTP/client responses rather than real API calls. A separate manual smoke test can validate real provider configuration after the unit tests pass.

## Decisions

- Package manager: use `npm` for the MVP.
- Model selection: require an explicit model from flags or config when a provider has no validated default. During implementation, defaults must be checked against official provider documentation before being hardcoded.
- Patch format: support full-file writes and unified diff patches in the tool interface. Implement the simplest reliable path first, then improve patch ergonomics after the agent loop works.
