import { describe, it, expect } from "vitest";
import { evaluateCondition } from "./evaluate-condition";
import type { ApprovalCondition } from "@/features/approvals/types/approval.types";

function cond(overrides: Partial<ApprovalCondition>): ApprovalCondition {
  return { field: "amount", operator: "gte", value: 1000, ...overrides };
}

describe("evaluateCondition", () => {
  // ── Missing / nullish fields ─────────────────────────────────
  describe("missing fields", () => {
    it("returns false when the field is absent", () => {
      expect(evaluateCondition(cond({}), {})).toBe(false);
    });

    it("returns false when the field is undefined", () => {
      expect(evaluateCondition(cond({}), { amount: undefined })).toBe(false);
    });

    it("returns false when the field is null", () => {
      expect(evaluateCondition(cond({}), { amount: null })).toBe(false);
    });
  });

  // ── gte ──────────────────────────────────────────────────────
  describe("gte", () => {
    const c = cond({ operator: "gte", value: 1000 });
    it("matches when greater", () => {
      expect(evaluateCondition(c, { amount: 1500 })).toBe(true);
    });
    it("matches when equal", () => {
      expect(evaluateCondition(c, { amount: 1000 })).toBe(true);
    });
    it("does not match when less", () => {
      expect(evaluateCondition(c, { amount: 999 })).toBe(false);
    });
  });

  // ── gt ───────────────────────────────────────────────────────
  describe("gt", () => {
    const c = cond({ operator: "gt", value: 1000 });
    it("matches when strictly greater", () => {
      expect(evaluateCondition(c, { amount: 1001 })).toBe(true);
    });
    it("does not match when equal", () => {
      expect(evaluateCondition(c, { amount: 1000 })).toBe(false);
    });
    it("does not match when less", () => {
      expect(evaluateCondition(c, { amount: 500 })).toBe(false);
    });
  });

  // ── lte ──────────────────────────────────────────────────────
  describe("lte", () => {
    const c = cond({ operator: "lte", value: 1000 });
    it("matches when less", () => {
      expect(evaluateCondition(c, { amount: 999 })).toBe(true);
    });
    it("matches when equal", () => {
      expect(evaluateCondition(c, { amount: 1000 })).toBe(true);
    });
    it("does not match when greater", () => {
      expect(evaluateCondition(c, { amount: 1001 })).toBe(false);
    });
  });

  // ── lt ───────────────────────────────────────────────────────
  describe("lt", () => {
    const c = cond({ operator: "lt", value: 1000 });
    it("matches when strictly less", () => {
      expect(evaluateCondition(c, { amount: 999 })).toBe(true);
    });
    it("does not match when equal", () => {
      expect(evaluateCondition(c, { amount: 1000 })).toBe(false);
    });
    it("does not match when greater", () => {
      expect(evaluateCondition(c, { amount: 2000 })).toBe(false);
    });
  });

  // ── numeric coercion ─────────────────────────────────────────
  describe("numeric coercion", () => {
    it("coerces numeric string field values", () => {
      expect(
        evaluateCondition(cond({ operator: "gte", value: 1000 }), {
          amount: "1500",
        })
      ).toBe(true);
    });

    it("trims whitespace around numeric strings", () => {
      expect(
        evaluateCondition(cond({ operator: "gte", value: 1000 }), {
          amount: "  1000  ",
        })
      ).toBe(true);
    });

    it("does not match a non-numeric string field", () => {
      expect(
        evaluateCondition(cond({ operator: "gte", value: 1000 }), {
          amount: "abc",
        })
      ).toBe(false);
    });

    it("does not match an empty string field", () => {
      expect(
        evaluateCondition(cond({ operator: "gte", value: 1000 }), {
          amount: "",
        })
      ).toBe(false);
    });

    it("does not match a boolean field for numeric operators", () => {
      expect(
        evaluateCondition(cond({ operator: "gt", value: 0 }), { amount: true })
      ).toBe(false);
    });

    it("does not match when the field is NaN", () => {
      expect(
        evaluateCondition(cond({ operator: "gte", value: 1000 }), {
          amount: Number.NaN,
        })
      ).toBe(false);
    });
  });

  // ── eq: number ───────────────────────────────────────────────
  describe("eq (number)", () => {
    const c = cond({ field: "quantity", operator: "eq", value: 5 });
    it("matches an equal number", () => {
      expect(evaluateCondition(c, { quantity: 5 })).toBe(true);
    });
    it("matches an equal numeric string", () => {
      expect(evaluateCondition(c, { quantity: "5" })).toBe(true);
    });
    it("does not match a different number", () => {
      expect(evaluateCondition(c, { quantity: 6 })).toBe(false);
    });
  });

  // ── eq: string ───────────────────────────────────────────────
  describe("eq (string)", () => {
    const c = cond({ field: "status", operator: "eq", value: "draft" });
    it("matches an equal string", () => {
      expect(evaluateCondition(c, { status: "draft" })).toBe(true);
    });
    it("does not match a different string", () => {
      expect(evaluateCondition(c, { status: "posted" })).toBe(false);
    });
    it("stringifies a numeric field before comparing", () => {
      expect(
        evaluateCondition(cond({ field: "status", operator: "eq", value: "7" }), {
          status: 7,
        })
      ).toBe(true);
    });
  });

  // ── eq: boolean ──────────────────────────────────────────────
  describe("eq (boolean)", () => {
    const cTrue = cond({ field: "flagged", operator: "eq", value: true });
    it("matches a true boolean field", () => {
      expect(evaluateCondition(cTrue, { flagged: true })).toBe(true);
    });
    it("matches the string 'true'", () => {
      expect(evaluateCondition(cTrue, { flagged: "true" })).toBe(true);
    });
    it("matches the string 'TRUE' case-insensitively", () => {
      expect(evaluateCondition(cTrue, { flagged: "TRUE" })).toBe(true);
    });
    it("does not match a false boolean field against true target", () => {
      expect(evaluateCondition(cTrue, { flagged: false })).toBe(false);
    });
    it("matches a false boolean field against false target", () => {
      const cFalse = cond({ field: "flagged", operator: "eq", value: false });
      expect(evaluateCondition(cFalse, { flagged: false })).toBe(true);
      expect(evaluateCondition(cFalse, { flagged: "false" })).toBe(true);
    });
    it("does not match an unrelated string against a boolean target", () => {
      expect(evaluateCondition(cTrue, { flagged: "yes" })).toBe(false);
    });
    it("does not match a number against a boolean target", () => {
      expect(evaluateCondition(cTrue, { flagged: 1 })).toBe(false);
    });
  });

  // ── unknown operator (defensive) ─────────────────────────────
  it("returns false for an unknown operator", () => {
    const bad = {
      field: "amount",
      operator: "neq",
      value: 1,
    } as unknown as ApprovalCondition;
    expect(evaluateCondition(bad, { amount: 1 })).toBe(false);
  });
});
