import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "./customer.schemas";

// ─────────────────────────────────────────────────────────────
// createCustomerSchema
// ─────────────────────────────────────────────────────────────

describe("createCustomerSchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = createCustomerSchema.safeParse({ name: "Acme Traders" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme Traders");
    }
  });

  it("trims the name", () => {
    const result = createCustomerSchema.safeParse({ name: "  Acme  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme");
    }
  });

  it("requires a name", () => {
    const result = createCustomerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = createCustomerSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 150 characters", () => {
    const result = createCustomerSchema.safeParse({
      name: "x".repeat(151),
    });
    expect(result.success).toBe(false);
  });

  // ── code ──────────────────────────────────────────────────

  it("uppercases a provided code", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      code: "cust-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("CUST-01");
    }
  });

  it("allows an empty code", () => {
    const result = createCustomerSchema.safeParse({ name: "Acme", code: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a code that is too short", () => {
    const result = createCustomerSchema.safeParse({ name: "Acme", code: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a code with invalid characters", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      code: "cust 01!",
    });
    expect(result.success).toBe(false);
  });

  // ── GST / PAN ─────────────────────────────────────────────

  it("accepts a valid GST number and uppercases it", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      gstNumber: "22aaaaa0000a1z5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gstNumber).toBe("22AAAAA0000A1Z5");
    }
  });

  it("rejects an invalid GST number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      gstNumber: "INVALIDGST",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty GST number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      gstNumber: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PAN number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      panNumber: "abcde1234f",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.panNumber).toBe("ABCDE1234F");
    }
  });

  it("rejects an invalid PAN number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      panNumber: "12345ABCDE",
    });
    expect(result.success).toBe(false);
  });

  // ── email / phone / website / pincode ─────────────────────

  it("accepts and lowercases a valid email", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      email: "Sales@Acme.TEST",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("sales@acme.test");
    }
  });

  it("rejects an invalid email", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty email", () => {
    const result = createCustomerSchema.safeParse({ name: "Acme", email: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid phone number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      mobile: "+91 98765-43210",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      mobile: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid pincode", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      billingPincode: "600001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid pincode", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      billingPincode: "12",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid website URL", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      website: "https://acme.test",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid website URL", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      website: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty website", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      website: "",
    });
    expect(result.success).toBe(true);
  });

  // ── numeric coercion ──────────────────────────────────────

  it("coerces a numeric string creditLimit to a number", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      creditLimit: "5000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditLimit).toBe(5000);
    }
  });

  it("coerces openingBalance from a string", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      openingBalance: "1234.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openingBalance).toBe(1234.5);
    }
  });

  it("rejects a negative creditLimit", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      creditLimit: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a creditLimit that is too large", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      creditLimit: "100000000000",
    });
    expect(result.success).toBe(false);
  });

  it("coerces paymentTermsDays from a string and accepts it", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      paymentTermsDays: "30",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentTermsDays).toBe(30);
    }
  });

  it("rejects a non-integer paymentTermsDays", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      paymentTermsDays: "30.5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects paymentTermsDays over 365", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      paymentTermsDays: "366",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative paymentTermsDays", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      paymentTermsDays: "-1",
    });
    expect(result.success).toBe(false);
  });

  // ── tags / notes / country ────────────────────────────────

  it("accepts a tags array", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      tags: ["vip", "wholesale"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(["vip", "wholesale"]);
    }
  });

  it("rejects a tags array containing an empty string", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      tags: [""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 2000 characters", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      notes: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a billingCountry that is not 2 characters", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      billingCountry: "IND",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty shippingCountry", () => {
    const result = createCustomerSchema.safeParse({
      name: "Acme",
      shippingCountry: "",
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// updateCustomerSchema
// ─────────────────────────────────────────────────────────────

describe("updateCustomerSchema", () => {
  it("allows an empty payload (all fields optional)", () => {
    const result = updateCustomerSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid status enum value", () => {
    const result = updateCustomerSchema.safeParse({ status: "inactive" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("inactive");
    }
  });

  it("rejects an invalid status enum value", () => {
    const result = updateCustomerSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });

  it("still validates the name when provided", () => {
    const result = updateCustomerSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid partial update", () => {
    const result = updateCustomerSchema.safeParse({
      name: "Renamed Co",
      status: "blacklisted",
      creditLimit: "9000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditLimit).toBe(9000);
    }
  });
});
