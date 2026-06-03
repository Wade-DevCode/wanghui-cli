import type { ApprovalMode, CommandMode, ProviderName } from "../config/config.js";

export interface ParsedArgs {
  command: CommandMode;
  task?: string;
  provider?: ProviderName;
  model?: string;
  baseUrl?: string;
  cwd?: string;
  yes: boolean;
  approval?: ApprovalMode;
  help: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command: CommandMode = args[0] === "run" ? "run" : "repl";
  if (command === "run") {
    args.shift();
  }

  let task: string | undefined;
  if (command === "run" && args[0] && !args[0].startsWith("--")) {
    task = args.shift();
  }

  const parsed: ParsedArgs = { command, task, yes: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--yes") {
      parsed.yes = true;
      continue;
    }
    if (arg === "--provider") {
      parsed.provider = parseProvider(requireValue(args, ++index, "--provider"));
      continue;
    }
    if (arg === "--model") {
      parsed.model = requireValue(args, ++index, "--model");
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = requireValue(args, ++index, "--base-url");
      continue;
    }
    if (arg === "--cwd") {
      parsed.cwd = requireValue(args, ++index, "--cwd");
      continue;
    }
    if (arg === "--approval") {
      parsed.approval = parseApproval(requireValue(args, ++index, "--approval"));
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }

  return parsed;
}

export function helpText(): string {
  return `Wanghui CLI

Usage:
  wanghui [options]
  wanghui run "<task>" [options]

Options:
  --provider openai|anthropic|openrouter|compatible
  --model <name>
  --base-url <url>
  --cwd <path>
  --yes
  --approval default|yes|never
  -h, --help
`;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseProvider(value: string): ProviderName {
  if (["openai", "anthropic", "openrouter", "compatible"].includes(value)) {
    return value as ProviderName;
  }
  throw new Error(`Unsupported provider '${value}'.`);
}

function parseApproval(value: string): ApprovalMode {
  if (["default", "yes", "never"].includes(value)) {
    return value as ApprovalMode;
  }
  throw new Error(`Invalid approval mode '${value}'.`);
}
