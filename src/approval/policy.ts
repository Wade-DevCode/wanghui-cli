import type { ApprovalMode } from "../config/config.js";

export type ApprovalDecision = "allow" | "confirm" | "block";
export type RiskLevel = "low" | "medium" | "high";

export interface ApprovalRequest {
  mode: ApprovalMode;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  risk: RiskLevel;
  reason: string;
}

const READ_TOOLS = new Set(["list_directory", "read_file", "search_files"]);
const WRITE_TOOLS = new Set(["write_file", "apply_patch"]);

const HIGH_RISK_COMMAND_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\brm\s+-rf\b/i,
  /\bremove-item\b.*\b-recurse\b/i,
  /\bdel\b.*\/s\b/i,
  /\bformat\b/i,
  /\bnpm\s+(install|i|uninstall|remove)\b/i,
  /\bpnpm\s+(add|install|remove)\b/i,
  /\byarn\s+(add|install|remove)\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\binvoke-webrequest\b/i,
  /\biwr\b/i,
];

export function decideApproval(request: ApprovalRequest): ApprovalResult {
  const risk = classifyRisk(request.toolName, request.input);

  if (risk === "high" && request.mode === "never") {
    return { decision: "block", risk, reason: "High-risk actions are blocked in never approval mode." };
  }

  if (READ_TOOLS.has(request.toolName)) {
    return { decision: "allow", risk, reason: "Read-only workspace tools are allowed." };
  }

  if (request.mode === "never" || request.mode === "yes") {
    return { decision: "allow", risk, reason: "Approval mode permits this action." };
  }

  if (WRITE_TOOLS.has(request.toolName) || request.toolName === "run_shell") {
    return { decision: "confirm", risk, reason: "Writes and shell commands require confirmation by default." };
  }

  return { decision: "confirm", risk, reason: "Unknown tools require confirmation." };
}

function classifyRisk(toolName: string, input: Record<string, unknown>): RiskLevel {
  if (READ_TOOLS.has(toolName)) {
    return "low";
  }

  if (toolName === "run_shell") {
    const command = String(input.command ?? "");
    if (HIGH_RISK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return "high";
    }
    return "medium";
  }

  if (WRITE_TOOLS.has(toolName)) {
    return "medium";
  }

  return "medium";
}
