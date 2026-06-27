import { describe, it, expect } from "vitest";
import { computeDiscount } from "./discount-engine";

// ─────────────────────────────────────────────────────────────
// Percentage discounts
// ─────────────────────────────────────────────────────────────

describe("computeDiscount — percentage type", () => {
  it("computes 10% discount (no approval needed)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 10,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(100);
    expect(result.discountPercent).toBe(10);
    expect(result.approvalRequired).toBe("none");
  });

  it("computes 20% discount (boundary — no approval needed)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 20,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(200);
    expect(result.discountPercent).toBe(20);
    expect(result.approvalRequired).toBe("none");
  });

  it("computes 21% discount (needs manager approval)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 21,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(210);
    expect(result.approvalRequired).toBe("manager");
  });

  it("computes 40% discount (boundary — manager approval)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 40,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(400);
    expect(result.approvalRequired).toBe("manager");
  });

  it("computes 41% discount (needs owner approval)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 41,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(410);
    expect(result.approvalRequired).toBe("owner");
  });

  it("computes 100% discount (needs owner approval)", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 100,
      lineAmount: 500,
    });
    expect(result.discountAmount).toBe(500);
    expect(result.discountPercent).toBe(100);
    expect(result.approvalRequired).toBe("owner");
  });

  it("clamps negative percentage to 0", () => {
    const result = computeDiscount({
      type: "percentage",
      value: -5,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountPercent).toBe(0);
    expect(result.approvalRequired).toBe("none");
  });

  it("clamps percentage above 100 to 100", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 150,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(1000);
    expect(result.discountPercent).toBe(100);
  });

  it("computes 0% discount correctly", () => {
    const result = computeDiscount({
      type: "percentage",
      value: 0,
      lineAmount: 800,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.approvalRequired).toBe("none");
  });

  it("rounds discount amount to 2 decimal places", () => {
    // 33.333% of 1000 = 333.33
    const result = computeDiscount({
      type: "percentage",
      value: 33.333,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(333.33);
  });
});

// ─────────────────────────────────────────────────────────────
// Fixed discounts
// ─────────────────────────────────────────────────────────────

describe("computeDiscount — fixed type", () => {
  it("computes a fixed discount amount with correct percent", () => {
    const result = computeDiscount({
      type: "fixed",
      value: 100,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(100);
    expect(result.discountPercent).toBe(10);
    expect(result.approvalRequired).toBe("none");
  });

  it("clamps fixed discount to lineAmount when value exceeds it", () => {
    const result = computeDiscount({
      type: "fixed",
      value: 1500,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(1000);
    expect(result.discountPercent).toBe(100);
  });

  it("clamps negative fixed discount to 0", () => {
    const result = computeDiscount({
      type: "fixed",
      value: -50,
      lineAmount: 1000,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountPercent).toBe(0);
    expect(result.approvalRequired).toBe("none");
  });

  it("computes 0 fixed discount correctly", () => {
    const result = computeDiscount({
      type: "fixed",
      value: 0,
      lineAmount: 800,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountPercent).toBe(0);
    expect(result.approvalRequired).toBe("none");
  });

  it("fixed discount >40% of line triggers owner approval", () => {
    const result = computeDiscount({
      type: "fixed",
      value: 450,
      lineAmount: 1000,
    });
    expect(result.discountPercent).toBe(45);
    expect(result.approvalRequired).toBe("owner");
  });

  it("computes discountPercent as 0 when lineAmount is 0", () => {
    const result = computeDiscount({
      type: "fixed",
      value: 0,
      lineAmount: 0,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountPercent).toBe(0);
  });
});
