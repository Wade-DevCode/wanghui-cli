import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

export interface SessionLogger {
  log(event: string, data: Record<string, unknown>): Promise<void>;
}

export function createNoopSessionLogger(): SessionLogger {
  return {
    async log() {
      return undefined;
    },
  };
}

export function createSessionLogger(workspace: string, id = new Date().toISOString().replace(/[:.]/g, "-")): SessionLogger {
  const logPath = path.join(workspace, ".wade", "sessions", `${id}.jsonl`);

  return {
    async log(event, data) {
      await mkdir(path.dirname(logPath), { recursive: true });
      const entry = {
        time: new Date().toISOString(),
        event,
        data: redact(data),
      };
      await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    },
  };
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/(api[_-]?key|token|secret)["'=:\s]+[A-Za-z0-9_.-]+/gi, "$1=[redacted]");
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, /key|token|secret/i.test(key) ? "[redacted]" : redact(child)]));
  }
  return value;
}
