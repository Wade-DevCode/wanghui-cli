import path from "node:path";

export function resolveWorkspacePath(workspace: string, targetPath: string): string {
  const workspaceRoot = path.resolve(workspace);
  const resolved = path.resolve(workspaceRoot, targetPath);
  const relative = path.relative(workspaceRoot, resolved);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolved;
  }

  throw new Error(`Path '${targetPath}' resolves outside workspace.`);
}
