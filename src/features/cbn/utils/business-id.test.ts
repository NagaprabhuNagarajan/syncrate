import { describe, it, expect } from "vitest";
import { isValidBusinessId, formatBusinessId } from "./business-id";

// ─────────────────────────────────────────────────────────────
// isValidBusinessId
// ─────────────────────────────────────────────────────────────

describe("isValidBusinessId", () => {
  it("accepts a well-formed SYN-IN-000001 style ID", () => {
    expect(isValidBusinessId("SYN-IN-000001")).toBe(true);
  });

  it("accepts SYN-US-999999", () => {
    expect(isValidBusinessId("SYN-US-999999")).toBe(true);
  });

  it("accepts any two uppercase letter state code", () => {
    expect(isValidBusinessId("SYN-MH-123456")).toBe(true);
    expect(isValidBusinessId("SYN-KA-000000")).toBe(true);
    expect(isValidBusinessId("SYN-DL-999999")).toBe(true);
  });

  it("rejects all-lowercase prefix", () => {
    expect(isValidBusinessId("syn-in-000001")).toBe(false);
  });

  it("rejects mixed-case state code", () => {
    expect(isValidBusinessId("SYN-mh-123456")).toBe(false);
  });

  it("rejects too few digits (5 instead of 6)", () => {
    expect(isValidBusinessId("SYN-IN-00001")).toBe(false);
  });

  it("rejects too many digits (7 instead of 6)", () => {
    expect(isValidBusinessId("SYN-IN-0000001")).toBe(false);
  });

  it("rejects a single-letter state code", () => {
    expect(isValidBusinessId("SYN-M-123456")).toBe(false);
  });

  it("rejects a three-letter state code", () => {
    expect(isValidBusinessId("SYN-MAH-123456")).toBe(false);
  });

  it("rejects an entirely random string", () => {
    expect(isValidBusinessId("INVALID")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidBusinessId("")).toBe(false);
  });

  it("rejects underscores instead of dashes", () => {
    expect(isValidBusinessId("SYN_IN_000001")).toBe(false);
  });

  it("rejects letters in the numeric portion", () => {
    expect(isValidBusinessId("SYN-IN-00000A")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// formatBusinessId
// ─────────────────────────────────────────────────────────────

describe("formatBusinessId", () => {
  it("returns the ID unchanged when provided", () => {
    expect(formatBusinessId("SYN-MH-123456")).toBe("SYN-MH-123456");
  });

  it("returns an em-dash when the ID is null", () => {
    expect(formatBusinessId(null)).toBe("—");
  });
});
