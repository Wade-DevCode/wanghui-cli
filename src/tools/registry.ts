import { applyUnifiedPatch, listDirectory, readTextFile, writeTextFile } from "./files.js";
import { runShell } from "./shell.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolExecutionResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

export interface ToolRegistry {
  definitions: ToolDefinition[];
  execute(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
}

export interface ToolRegistryOptions {
  workspace: string;
}

export function createToolRegistry(options: ToolRegistryOptions): ToolRegistry {
  const definitions = toolDefinitions();

  return {
    definitions,
    async execute(name, input) {
      try {
        switch (name) {
          case "list_directory":
            return { ok: true, content: await listDirectory({ workspace: options.workspace, dirPath: stringArg(input, "dirPath", ".") }) };
          case "read_file":
            return { ok: true, content: await readTextFile({ workspace: options.workspace, filePath: stringArg(input, "filePath") }) };
          case "search_files":
            return { ok: true, content: await searchFiles(options.workspace, stringArg(input, "query")) };
          case "write_file":
            return {
              ok: true,
              content: await writeTextFile({
                workspace: options.workspace,
                filePath: stringArg(input, "filePath"),
                content: stringArg(input, "content", ""),
              }),
            };
          case "apply_patch":
            return { ok: true, content: await applyUnifiedPatch({ workspace: options.workspace, patch: stringArg(input, "patch") }) };
          case "run_shell": {
            const result = await runShell({ workspace: options.workspace, command: stringArg(input, "command") });
            return {
              ok: result.exitCode === 0 && !result.timedOut,
              content: `exitCode=${result.exitCode}\ntimedOut=${result.timedOut}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
              error: result.exitCode === 0 && !result.timedOut ? undefined : `Command failed with exit code ${result.exitCode}`,
            } as ToolExecutionResult;
          }
          default:
            return { ok: false, error: `Unknown tool '${name}'.` };
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

function toolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "list_directory",
      description: "List files and directories inside the workspace.",
      inputSchema: objectSchema({ dirPath: stringSchema("Directory path relative to the workspace.") }, ["dirPath"]),
    },
    {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace.",
      inputSchema: objectSchema({ filePath: stringSchema("File path relative to the workspace.") }, ["filePath"]),
    },
    {
      name: "search_files",
      description: "Search workspace files with a text query.",
      inputSchema: objectSchema({ query: stringSchema("Search query.") }, ["query"]),
    },
    {
      name: "write_file",
      description: "Create or replace a UTF-8 text file inside the workspace.",
      inputSchema: objectSchema(
        {
          filePath: stringSchema("File path relative to the workspace."),
          content: stringSchema("Complete file content."),
        },
        ["filePath", "content"],
      ),
    },
    {
      name: "apply_patch",
      description: "Apply a unified diff patch inside the workspace.",
      inputSchema: objectSchema({ patch: stringSchema("Unified diff patch.") }, ["patch"]),
    },
    {
      name: "run_shell",
      description: "Run a shell command in the workspace.",
      inputSchema: objectSchema({ command: stringSchema("Shell command to run.") }, ["command"]),
    },
  ];
}

async function searchFiles(workspace: string, query: string): Promise<string> {
  const { runShell } = await import("./shell.js");
  const result = await runShell({ workspace, command: `rg --line-number --hidden --glob "!node_modules" ${quoteShell(query)}` });
  if (result.exitCode === 0) {
    return result.stdout;
  }
  if (result.exitCode === 1) {
    return "";
  }
  throw new Error(result.stderr || `rg failed with exit code ${result.exitCode}`);
}

function stringArg(input: Record<string, unknown>, key: string, fallback?: string): string {
  const value = input[key];
  if (typeof value === "string") {
    return value;
  }
  if (fallback !== undefined && value === undefined) {
    return fallback;
  }
  throw new Error(`Expected string input '${key}'.`);
}

function objectSchema(properties: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function stringSchema(description: string): Record<string, unknown> {
  return { type: "string", description };
}

function quoteShell(value: string): string {
  return JSON.stringify(value);
}
