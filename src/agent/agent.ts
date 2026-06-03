import { decideApproval } from "../approval/policy.js";
import type { ApprovalMode } from "../config/config.js";
import type { ModelProvider, ProviderMessage } from "../providers/types.js";
import { createNoopSessionLogger, type SessionLogger } from "../session/session-log.js";
import type { ToolRegistry } from "../tools/registry.js";
import { createSystemPrompt } from "./system-prompt.js";

export interface RunAgentInput {
  task: string;
  provider: ModelProvider;
  registry: ToolRegistry;
  approvalMode: ApprovalMode;
  workspace: string;
  maxTurns?: number;
  logger?: SessionLogger;
  confirm?: (toolName: string, input: Record<string, unknown>, reason: string) => Promise<boolean>;
}

export interface RunAgentResult {
  status: "completed" | "blocked" | "max_turns";
  finalMessage: string;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const maxTurns = input.maxTurns ?? 12;
  const logger = input.logger ?? createNoopSessionLogger();
  const messages: ProviderMessage[] = [
    { role: "system", content: createSystemPrompt(input.workspace) },
    { role: "user", content: input.task },
  ];

  await logger.log("run_start", {
    provider: input.provider.name,
    workspace: input.workspace,
    approvalMode: input.approvalMode,
  });

  for (let turn = 0; turn < maxTurns; turn += 1) {
    await logger.log("provider_request", { turn });
    const response = await input.provider.send({ messages, tools: input.registry.definitions });
    await logger.log("provider_response", {
      turn,
      content: response.content,
      toolCalls: response.toolCalls,
    });

    if (response.content) {
      messages.push({ role: "assistant", content: response.content });
    }

    if (response.toolCalls.length === 0) {
      await logger.log("run_complete", { status: "completed", finalMessage: response.content });
      return { status: "completed", finalMessage: response.content };
    }

    for (const toolCall of response.toolCalls) {
      const approval = decideApproval({
        mode: input.approvalMode,
        toolName: toolCall.name,
        input: toolCall.input,
      });
      await logger.log("approval_decision", { toolCall, approval });

      if (approval.decision === "block") {
        const message = `Tool ${toolCall.name} blocked: ${approval.reason}`;
        messages.push({ role: "tool", toolCallId: toolCall.id, name: toolCall.name, content: message });
        continue;
      }

      if (approval.decision === "confirm") {
        const allowed = input.confirm ? await input.confirm(toolCall.name, toolCall.input, approval.reason) : false;
        await logger.log("approval_prompt", { toolCall, allowed });
        if (!allowed) {
          const message = `Tool ${toolCall.name} denied by user.`;
          messages.push({ role: "tool", toolCallId: toolCall.id, name: toolCall.name, content: message });
          continue;
        }
      }

      const result = await input.registry.execute(toolCall.name, toolCall.input);
      await logger.log("tool_result", { toolCall, result });
      messages.push({
        role: "tool",
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: result.ok ? result.content : `Error: ${result.error}`,
      });
    }
  }

  await logger.log("run_complete", { status: "max_turns" });
  return { status: "max_turns", finalMessage: "Reached maximum agent turns before completing the task." };
}
