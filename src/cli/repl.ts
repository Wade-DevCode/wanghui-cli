import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runAgent } from "../agent/agent.js";
import type { WadeConfig } from "../config/config.js";
import type { ModelProvider } from "../providers/types.js";
import { createSessionLogger } from "../session/session-log.js";
import { createToolRegistry } from "../tools/registry.js";
import { confirmTool } from "./main.js";

export async function startRepl(config: WadeConfig, provider: ModelProvider): Promise<void> {
  const rl = readline.createInterface({ input, output });
  output.write(`Wade's CLI (${config.provider}/${config.model})\nWorkspace: ${config.cwd}\nType /exit to quit.\n\n`);

  try {
    while (true) {
      const task = (await rl.question("wade> ")).trim();
      if (!task) {
        continue;
      }
      if (task === "/exit") {
        return;
      }

      const result = await runAgent({
        task,
        provider,
        registry: createToolRegistry({ workspace: config.cwd }),
        approvalMode: config.approvalMode,
        workspace: config.cwd,
        logger: createSessionLogger(config.cwd),
        confirm: confirmTool,
      });
      output.write(`${result.finalMessage}\n`);
    }
  } finally {
    rl.close();
  }
}
