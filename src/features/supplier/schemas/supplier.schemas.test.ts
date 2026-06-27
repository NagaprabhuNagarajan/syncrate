import { describe, expect, it } from "vitest";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "./supplier.schemas";

const VALID_GST = "22AAAAA0000A1Z5";
const VALID_PAN = "AAAAA0000A";
const VALID_IFSC = "HDFC0001234";

// ─────────────────────────────────────────────────────────────
// createSupplierSchema
// ─────────────────────────────────────────────────────────────

describe("createSupplierSchema", () => {
  it("accepts the minimal valid payload (name only)", () => {
    const result = createSupplierSchema.safeParse({ name: "Acme Industries" });
    expect(result.success).toBe(true);
  });

  it("trims the supplier name", () => {
    const result = createSupplierSchema.safeParse({ name: "  Acme  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme");
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(createSupplierSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("rejects a name longer than 150 characters", () => {
    const result = createSupplierSchema.safeParse({ name: "x".repeat(151) });
    expect(result.success).toBe(false);
  });

  it("uppercases and accepts a valid code", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      code: "supp-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("SUPP-01");
    }
  });

  it("rejects an invalid code with disallowed characters", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      code: "bad code!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty code (auto-generation later)", () => {
    const result = createSupplierSchema.safeParse({ name: "Acme", code: "" });
    expect(result.success).toBe(true);
  });

  it("accepts and uppercases a valid GST number", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      gstNumber: VALID_GST.toLowerCase(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gstNumber).toBe(VALID_GST);
    }
  });

  it("rejects an invalid GST number", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      gstNumber: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid PAN number", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      panNumber: VALID_PAN,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid IFSC code and uppercases it", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      bankIfsc: VALID_IFSC.toLowerCase(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bankIfsc).toBe(VALID_IFSC);
    }
  });

  it("rejects an invalid IFSC code", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      bankIfsc: "ABCD1234567",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty IFSC code", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      bankIfsc: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid bank account number", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      bankAccountNumber: "123456789012",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-numeric bank account number", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      bankAccountNumber: "ABC123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a rating within 0–5", () => {
    const result = createSupplierSchema.safeParse({ name: "Acme", rating: 4.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating).toBe(4.5);
    }
  });

  it("rejects a rating above 5", () => {
    const result = createSupplierSchema.safeParse({ name: "Acme", rating: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative rating", () => {
    const result = createSupplierSchema.safeParse({ name: "Acme", rating: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid pincode", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      pincode: "12",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payment term over 365 days", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      paymentTermsDays: 400,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = createSupplierSchema.safeParse({
      name: "Acme",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateSupplierSchema
// ─────────────────────────────────────────────────────────────

describe("updateSupplierSchema", () => {
  it("allows an optional name", () => {
    const result = updateSupplierSchema.safeParse({ city: "Pune" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid status", () => {
    const result = updateSupplierSchema.safeParse({ status: "inactive" });
    expect(result.success).toBe(true);
  });

  it("rejects the blacklisted status (suppliers do not support it)", () => {
    const result = updateSupplierSchema.safeParse({ status: "blacklisted" });
    expect(result.success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = updateSupplierSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });
});
