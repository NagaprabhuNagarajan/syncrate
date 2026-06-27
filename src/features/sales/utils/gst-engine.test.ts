import { describe, it, expect } from "vitest";
import { computeGST, isValidGSTRate } from "./gst-engine";

// ─────────────────────────────────────────────────────────────
// isValidGSTRate
// ─────────────────────────────────────────────────────────────

describe("isValidGSTRate", () => {
  it.each([0, 5, 12, 18, 28])("accepts valid rate %i", (rate) => {
    expect(isValidGSTRate(rate)).toBe(true);
  });

  it.each([1, 3, 6, 10, 15, 20, 25, 30, 100, -1])(
    "rejects invalid rate %i",
    (rate) => {
      expect(isValidGSTRate(rate)).toBe(false);
    }
  );
});

// ─────────────────────────────────────────────────────────────
// computeGST — GST-exempt (rate = 0)
// ─────────────────────────────────────────────────────────────

describe("computeGST — rate 0 (GST-exempt)", () => {
  it("returns all zeros for intra-state exempt product", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 0,
      orgState: "Maharashtra",
      supplyState: "Maharashtra",
    });
    expect(result).toMatchObject({
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
    });
  });

  it("returns all zeros for inter-state exempt product", () => {
    const result = computeGST({
      taxableAmount: 5000,
      gstRate: 0,
      orgState: "Delhi",
      supplyState: "Karnataka",
    });
    expect(result.taxAmount).toBe(0);
    expect(result.igstAmount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// computeGST — intra-state (CGST + SGST)
// ─────────────────────────────────────────────────────────────

describe("computeGST — intra-state", () => {
  it("splits 5% equally between CGST and SGST", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 5,
      orgState: "Maharashtra",
      supplyState: "Maharashtra",
    });
    expect(result.isInterstate).toBe(false);
    expect(result.cgstRate).toBe(2.5);
    expect(result.sgstRate).toBe(2.5);
    expect(result.igstRate).toBe(0);
    expect(result.cgstAmount).toBe(25);
    expect(result.sgstAmount).toBe(25);
    expect(result.igstAmount).toBe(0);
    expect(result.taxAmount).toBe(50);
  });

  it("splits 12% equally between CGST and SGST", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 12,
      orgState: "Karnataka",
      supplyState: "Karnataka",
    });
    expect(result.isInterstate).toBe(false);
    expect(result.cgstRate).toBe(6);
    expect(result.sgstRate).toBe(6);
    expect(result.cgstAmount).toBe(60);
    expect(result.sgstAmount).toBe(60);
    expect(result.taxAmount).toBe(120);
  });

  it("splits 18% equally between CGST and SGST", () => {
    const result = computeGST({
      taxableAmount: 10000,
      gstRate: 18,
      orgState: "Tamil Nadu",
      supplyState: "Tamil Nadu",
    });
    expect(result.isInterstate).toBe(false);
    expect(result.cgstRate).toBe(9);
    expect(result.sgstRate).toBe(9);
    expect(result.cgstAmount).toBe(900);
    expect(result.sgstAmount).toBe(900);
    expect(result.taxAmount).toBe(1800);
  });

  it("splits 28% equally between CGST and SGST", () => {
    const result = computeGST({
      taxableAmount: 500,
      gstRate: 28,
      orgState: "Gujarat",
      supplyState: "Gujarat",
    });
    expect(result.isInterstate).toBe(false);
    expect(result.cgstRate).toBe(14);
    expect(result.sgstRate).toBe(14);
    expect(result.cgstAmount).toBe(70);
    expect(result.sgstAmount).toBe(70);
    expect(result.taxAmount).toBe(140);
  });

  it("is case-insensitive for state comparison", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 18,
      orgState: "maharashtra",
      supplyState: "MAHARASHTRA",
    });
    expect(result.isInterstate).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// computeGST — inter-state (IGST only)
// ─────────────────────────────────────────────────────────────

describe("computeGST — inter-state", () => {
  it("applies full 5% as IGST for inter-state supply", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 5,
      orgState: "Maharashtra",
      supplyState: "Karnataka",
    });
    expect(result.isInterstate).toBe(true);
    expect(result.cgstRate).toBe(0);
    expect(result.sgstRate).toBe(0);
    expect(result.igstRate).toBe(5);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.igstAmount).toBe(50);
    expect(result.taxAmount).toBe(50);
  });

  it("applies full 12% as IGST for inter-state supply", () => {
    const result = computeGST({
      taxableAmount: 2000,
      gstRate: 12,
      orgState: "Delhi",
      supplyState: "Mumbai",
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstRate).toBe(12);
    expect(result.igstAmount).toBe(240);
    expect(result.taxAmount).toBe(240);
  });

  it("applies full 18% as IGST for inter-state supply", () => {
    const result = computeGST({
      taxableAmount: 5000,
      gstRate: 18,
      orgState: "Rajasthan",
      supplyState: "Kerala",
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstAmount).toBe(900);
    expect(result.taxAmount).toBe(900);
  });

  it("applies full 28% as IGST for inter-state supply", () => {
    const result = computeGST({
      taxableAmount: 10000,
      gstRate: 28,
      orgState: "Uttar Pradesh",
      supplyState: "Tamil Nadu",
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstRate).toBe(28);
    expect(result.igstAmount).toBe(2800);
    expect(result.taxAmount).toBe(2800);
  });
});

// ─────────────────────────────────────────────────────────────
// Edge cases — missing / null states → inter-state
// ─────────────────────────────────────────────────────────────

describe("computeGST — null / empty state edge cases", () => {
  it("treats null orgState as inter-state", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 18,
      orgState: null,
      supplyState: "Karnataka",
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstAmount).toBe(180);
  });

  it("treats undefined orgState as inter-state", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 18,
      orgState: undefined,
      supplyState: "Karnataka",
    });
    expect(result.isInterstate).toBe(true);
  });

  it("treats null supplyState as inter-state", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 18,
      orgState: "Maharashtra",
      supplyState: null,
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstAmount).toBe(180);
  });

  it("treats empty string supplyState as inter-state", () => {
    const result = computeGST({
      taxableAmount: 1000,
      gstRate: 18,
      orgState: "Maharashtra",
      supplyState: "",
    });
    expect(result.isInterstate).toBe(true);
  });

  it("treats both states null as inter-state", () => {
    const result = computeGST({
      taxableAmount: 500,
      gstRate: 12,
      orgState: null,
      supplyState: null,
    });
    expect(result.isInterstate).toBe(true);
    expect(result.igstAmount).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────
// Rounding
// ─────────────────────────────────────────────────────────────

describe("computeGST — rounding", () => {
  it("rounds amounts to 2 decimal places (intra-state)", () => {
    // 18% on 1234.56 = 222.2208 → rounds to 111.11 each
    const result = computeGST({
      taxableAmount: 1234.56,
      gstRate: 18,
      orgState: "Maharashtra",
      supplyState: "Maharashtra",
    });
    // CGST = 9% of 1234.56 = 111.1104 → 111.11
    expect(result.cgstAmount).toBe(111.11);
    expect(result.sgstAmount).toBe(111.11);
    // taxAmount = cgst + sgst = 222.22
    expect(result.taxAmount).toBe(222.22);
  });

  it("rounds amounts to 2 decimal places (inter-state)", () => {
    // 5% on 333.33 = 16.6665 → 16.67
    const result = computeGST({
      taxableAmount: 333.33,
      gstRate: 5,
      orgState: "Karnataka",
      supplyState: "Tamil Nadu",
    });
    expect(result.igstAmount).toBe(16.67);
    expect(result.taxAmount).toBe(16.67);
  });

  it("returns exactly 0 for zero taxable amount", () => {
    const result = computeGST({
      taxableAmount: 0,
      gstRate: 18,
      orgState: "Maharashtra",
      supplyState: "Maharashtra",
    });
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
  });
});
