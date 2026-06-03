import { spawn } from "node:child_process";

export interface RunShellInput {
  workspace: string;
  command: string;
  timeoutMs?: number;
}

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const MAX_OUTPUT_CHARS = 60_000;

export function runShell(input: RunShellInput): Promise<ShellResult> {
  const timeoutMs = input.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const child = spawn(input.command, {
      cwd: input.workspace,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

function appendBounded(current: string, chunk: string): string {
  const next = current + chunk;
  if (next.length <= MAX_OUTPUT_CHARS) {
    return next;
  }
  return `${next.slice(0, MAX_OUTPUT_CHARS)}\n[truncated after ${MAX_OUTPUT_CHARS} characters]`;
}
