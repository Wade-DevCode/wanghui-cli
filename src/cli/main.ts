#!/usr/bin/env node
import readline from "node:readline/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output, stderr } from "node:process";
import { runAgent } from "../agent/agent.js";
import { resolveConfig } from "../config/config.js";
import { createProvider } from "../providers/factory.js";
import { createSessionLogger } from "../session/session-log.js";
import { createToolRegistry } from "../tools/registry.js";
import { helpText, parseArgs } from "./args.js";
import { startRepl } from "./repl.js";

export async function main(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      output.write(helpText());
      return 0;
    }

    const config = resolveConfig({ argv, env, cwd });
    const provider = createProvider(config);

    if (config.command === "repl") {
      await startRepl(config, provider);
      return 0;
    }

    if (!config.task) {
      throw new Error('Missing task. Use: wanghui run "<task>"');
    }

    const result = await runAgent({
      task: config.task,
      provider,
      registry: createToolRegistry({ workspace: config.cwd }),
      approvalMode: config.approvalMode,
      workspace: config.cwd,
      logger: createSessionLogger(config.cwd),
      confirm: confirmTool,
    });

    output.write(`${result.finalMessage}\n`);
    return result.status === "completed" ? 0 : 1;
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

export async function confirmTool(toolName: string, toolInput: Record<string, unknown>, reason: string): Promise<boolean> {
  output.write(`\nTool approval required: ${toolName}\nReason: ${reason}\nInput: ${JSON.stringify(toolInput, null, 2)}\n`);
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question("Allow? [y/N] ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export function isDirectEntrypoint(scriptPath: string | undefined, moduleUrl: string): boolean {
  if (!scriptPath) {
    return false;
  }
  return realPath(scriptPath) === realPath(fileURLToPath(moduleUrl));
}

function realPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

if (isDirectEntrypoint(process.argv[1], import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
