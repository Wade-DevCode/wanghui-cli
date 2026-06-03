# Wade's CLI

Wade's CLI is an original TypeScript/Node.js coding-agent CLI. It is a clean-room implementation inspired by public coding-agent workflows: inspect a workspace, call local tools, request approvals, edit files, run commands, and keep session logs.

## Setup

```powershell
npm install
npm run build
```

Use Node.js 20 or newer.

## Provider Configuration

Set the API key for the provider you want to use:

```powershell
$env:OPENAI_API_KEY="..."
$env:ANTHROPIC_API_KEY="..."
$env:OPENROUTER_API_KEY="..."
$env:WADE_API_KEY="..."       # for --provider compatible
$env:WADE_BASE_URL="..."      # for --provider compatible
```

You can also add `wade.config.json` in the project root:

```json
{
  "provider": "openai",
  "model": "gpt-5.2",
  "approval": "default"
}
```

## Commands

Interactive REPL:

```powershell
npm run dev -- --provider openai --model gpt-5.2
```

One-shot task:

```powershell
npm run dev -- run "inspect the project and summarize it" --provider openai --model gpt-5.2
```

After building, the executable bundle is:

```powershell
node dist/main.js --help
```

## Providers

- `openai`: uses `https://api.openai.com/v1/chat/completions`
- `anthropic`: uses `https://api.anthropic.com/v1/messages`
- `openrouter`: uses `https://openrouter.ai/api/v1/chat/completions`
- `compatible`: uses `WADE_BASE_URL` with an OpenAI-compatible Chat Completions API

## Tools

The agent can request:

- `list_directory`
- `read_file`
- `search_files`
- `write_file`
- `apply_patch`
- `run_shell`

Paths are resolved inside the selected workspace. Attempts to access paths outside the workspace are rejected.

## Approvals

Default behavior:

- Read tools are allowed automatically.
- File writes, patches, and shell commands require confirmation.
- Dangerous shell commands are classified as high risk.

Automation options:

- `--yes` auto-approves ordinary writes and shell commands.
- `--approval never` auto-approves ordinary actions but blocks high-risk commands.

Session logs are written under `.wade/sessions` and are ignored by git.

## Verification

```powershell
npm test
npm run build
node dist/main.js --help
```

