import fs from "node:fs";
import path from "node:path";

export type ProviderName = "openai" | "anthropic" | "openrouter" | "compatible";
export type CommandMode = "repl" | "run";
export type ApprovalMode = "default" | "yes" | "never";

export interface ResolveConfigInput {
  argv: string[];
  env: Record<string, string | undefined>;
  cwd: string;
}

export interface WadeConfig {
  command: CommandMode;
  task?: string;
  provider: ProviderName;
  model: string;
  apiKey: string;
  baseUrl: string;
  cwd: string;
  approvalMode: ApprovalMode;
}

interface ConfigFile {
  provider?: ProviderName;
  model?: string;
  baseUrl?: string;
  approval?: ApprovalMode;
}

const DEFAULT_PROVIDER: ProviderName = "openai";
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-5.5",
  anthropic: "claude-sonnet-4-6",
  openrouter: "openai/gpt-5.5",
  compatible: "",
};

const DEFAULT_BASE_URLS: Record<ProviderName, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai/api/v1",
  compatible: "",
};

const API_KEY_ENV: Record<ProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  compatible: "WADE_API_KEY",
};

export function resolveConfig(input: ResolveConfigInput): WadeConfig {
  const parsed = parseArgv(input.argv);
  const file = readConfigFile(input.cwd);
  const provider = (parsed.provider ?? file.provider ?? DEFAULT_PROVIDER) as ProviderName;
  assertProvider(provider);

  const cwd = parsed.cwd ? path.resolve(parsed.cwd) : input.cwd;
  const model = parsed.model ?? file.model ?? DEFAULT_MODELS[provider];
  if (!model) {
    throw new Error(`Missing model for provider '${provider}'. Pass --model or set model in wanghui.config.json.`);
  }

  const baseUrl = parsed.baseUrl ?? file.baseUrl ?? providerBaseUrl(provider, input.env);
  if (!baseUrl) {
    throw new Error(`Missing base URL for provider '${provider}'. Pass --base-url or set WADE_BASE_URL.`);
  }

  const apiKeyEnv = API_KEY_ENV[provider];
  const apiKey = input.env[apiKeyEnv] ?? (provider === "compatible" ? input.env.WADE_API_KEY : undefined);
  if (!apiKey) {
    throw new Error(`Missing API key for provider '${provider}'. Set ${apiKeyEnv}.`);
  }

  return {
    command: parsed.command,
    task: parsed.task,
    provider,
    model,
    apiKey,
    baseUrl,
    cwd,
    approvalMode: parsed.approvalMode ?? file.approval ?? (parsed.yes ? "yes" : "default"),
  };
}

function providerBaseUrl(provider: ProviderName, env: Record<string, string | undefined>): string {
  if (provider === "compatible") {
    return env.WADE_BASE_URL ?? "";
  }
  return DEFAULT_BASE_URLS[provider];
}

function parseArgv(argv: string[]): {
  command: CommandMode;
  task?: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  cwd?: string;
  yes: boolean;
  approvalMode?: ApprovalMode;
} {
  const args = [...argv];
  const command: CommandMode = args[0] === "run" ? "run" : "repl";
  if (command === "run") {
    args.shift();
  }

  let task: string | undefined;
  if (command === "run" && args[0] && !args[0].startsWith("--")) {
    task = args.shift();
  }

  const result = { command, task, yes: false } as {
    command: CommandMode;
    task?: string;
    provider?: string;
    model?: string;
    baseUrl?: string;
    cwd?: string;
    yes: boolean;
    approvalMode?: ApprovalMode;
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--yes") {
      result.yes = true;
      continue;
    }
    if (arg === "--provider") {
      result.provider = requireValue(args, ++index, "--provider");
      continue;
    }
    if (arg === "--model") {
      result.model = requireValue(args, ++index, "--model");
      continue;
    }
    if (arg === "--base-url") {
      result.baseUrl = requireValue(args, ++index, "--base-url");
      continue;
    }
    if (arg === "--cwd") {
      result.cwd = requireValue(args, ++index, "--cwd");
      continue;
    }
    if (arg === "--approval") {
      const mode = requireValue(args, ++index, "--approval");
      if (!isApprovalMode(mode)) {
        throw new Error(`Invalid --approval '${mode}'. Use default, yes, or never.`);
      }
      result.approvalMode = mode;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }

  return result;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function readConfigFile(cwd: string): ConfigFile {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as ConfigFile;
  if (parsed.provider) {
    assertProvider(parsed.provider);
  }
  if (parsed.approval && !isApprovalMode(parsed.approval)) {
    throw new Error(`Invalid approval mode '${parsed.approval}' in ${path.basename(configPath)}.`);
  }
  return parsed;
}

function findConfigPath(cwd: string): string | undefined {
  const currentName = path.join(cwd, "wanghui.config.json");
  if (fs.existsSync(currentName)) {
    return currentName;
  }

  const legacyName = path.join(cwd, "wade.config.json");
  if (fs.existsSync(legacyName)) {
    return legacyName;
  }

  return undefined;
}

function assertProvider(provider: string): asserts provider is ProviderName {
  if (!["openai", "anthropic", "openrouter", "compatible"].includes(provider)) {
    throw new Error(`Unsupported provider '${provider}'.`);
  }
}

function isApprovalMode(mode: string): mode is ApprovalMode {
  return ["default", "yes", "never"].includes(mode);
}
