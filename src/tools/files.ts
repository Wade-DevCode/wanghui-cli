import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath } from "./path.js";

export { resolveWorkspacePath };

export interface WorkspaceFileInput {
  workspace: string;
  filePath: string;
}

export interface ListDirectoryInput {
  workspace: string;
  dirPath: string;
}

export interface WriteTextFileInput extends WorkspaceFileInput {
  content: string;
}

export interface ApplyPatchInput {
  workspace: string;
  patch: string;
}

const MAX_READ_CHARS = 120_000;

export async function listDirectory(input: ListDirectoryInput): Promise<string> {
  const dir = resolveWorkspacePath(input.workspace, input.dirPath);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
    .join("\n");
}

export async function readTextFile(input: WorkspaceFileInput): Promise<string> {
  const file = resolveWorkspacePath(input.workspace, input.filePath);
  const content = await readFile(file, "utf8");
  if (content.length <= MAX_READ_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_READ_CHARS)}\n\n[truncated after ${MAX_READ_CHARS} characters]`;
}

export async function writeTextFile(input: WriteTextFileInput): Promise<string> {
  const file = resolveWorkspacePath(input.workspace, input.filePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, input.content, "utf8");
  return `Wrote ${input.filePath}`;
}

export async function applyUnifiedPatch(input: ApplyPatchInput): Promise<string> {
  if (!input.patch.trim()) {
    throw new Error("Patch is empty.");
  }

  await runGitApply(input.workspace, input.patch);
  return "Patch applied";
}

function runGitApply(workspace: string, patch: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["apply", "--whitespace=nowarn", "-"], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `git apply failed with exit code ${code}`));
    });
    child.stdin.end(patch);
  });
}
