import { describe, expect, it } from "vitest";
import { decideApproval } from "../src/approval/policy.js";

describe("decideApproval", () => {
  it("auto-allows read tools in default mode", () => {
    expect(decideApproval({ mode: "default", toolName: "read_file", input: {} }).decision).toBe("allow");
  });

  it("requires confirmation for writes and shell in default mode", () => {
    expect(decideApproval({ mode: "default", toolName: "write_file", input: {} }).decision).toBe("confirm");
    expect(decideApproval({ mode: "default", toolName: "run_shell", input: { command: "npm test" } }).decision).toBe("confirm");
  });

  it("classifies destructive shell commands as blocked in never mode", () => {
    const result = decideApproval({ mode: "never", toolName: "run_shell", input: { command: "git reset --hard" } });
    expect(result.decision).toBe("block");
    expect(result.risk).toBe("high");
  });

  it("allows ordinary shell commands in never mode", () => {
    expect(decideApproval({ mode: "never", toolName: "run_shell", input: { command: "npm test" } }).decision).toBe("allow");
  });
});
