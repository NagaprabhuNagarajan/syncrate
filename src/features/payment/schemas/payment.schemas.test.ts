import { describe, it, expect } from "vitest";
import {
  recordCustomerPaymentSchema,
  recordSupplierPaymentSchema,
  paymentMethodSchema,
} from "./payment.schemas";

// ─────────────────────────────────────────────────────────────
// paymentMethodSchema
// ─────────────────────────────────────────────────────────────

describe("paymentMethodSchema", () => {
  it("accepts all valid payment methods", () => {
    const methods = [
      "cash",
      "upi",
      "bank_transfer",
      "cheque",
      "credit_card",
      "debit_card",
      "wallet",
      "other",
    ] as const;

    for (const method of methods) {
      const result = paymentMethodSchema.safeParse(method);
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid payment method", () => {
    const result = paymentMethodSchema.safeParse("wire_transfer");
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// recordCustomerPaymentSchema
// ─────────────────────────────────────────────────────────────

describe("recordCustomerPaymentSchema", () => {
  const minimalValid = {
    customerId: "550e8400-e29b-41d4-a716-446655440000",
    amount: 1000,
    paymentMethod: "cash" as const,
    allocations: [],
  };

  it("accepts a minimal valid payload", () => {
    const result = recordCustomerPaymentSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  it("accepts a full valid payload", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      referenceNumber: "REF-001",
      paymentDate: "2026-06-27",
      notes: "Payment received",
      allocations: [
        {
          invoiceId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 500,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires customerId", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      customerId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID customerId", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      customerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment method", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      paymentMethod: "wire",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid paymentDate format", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      paymentDate: "27-06-2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid paymentDate", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      paymentDate: "2026-06-27",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a referenceNumber that is too long", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      referenceNumber: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 2000 characters", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      notes: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an allocation with an invalid invoiceId UUID", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      allocations: [{ invoiceId: "invalid", amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an allocation with zero amount", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      ...minimalValid,
      allocations: [
        { invoiceId: "550e8400-e29b-41d4-a716-446655440001", amount: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("defaults allocations to an empty array when omitted", () => {
    const result = recordCustomerPaymentSchema.safeParse({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 1000,
      paymentMethod: "cash",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allocations).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// recordSupplierPaymentSchema
// ─────────────────────────────────────────────────────────────

describe("recordSupplierPaymentSchema", () => {
  const minimalValid = {
    supplierId: "550e8400-e29b-41d4-a716-446655440000",
    amount: 2500,
    paymentMethod: "bank_transfer" as const,
    allocations: [],
  };

  it("accepts a minimal valid payload", () => {
    const result = recordSupplierPaymentSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  it("requires supplierId", () => {
    const result = recordSupplierPaymentSchema.safeParse({
      ...minimalValid,
      supplierId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID supplierId", () => {
    const result = recordSupplierPaymentSchema.safeParse({
      ...minimalValid,
      supplierId: "bad-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = recordSupplierPaymentSchema.safeParse({
      ...minimalValid,
      amount: -50,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid allocation", () => {
    const result = recordSupplierPaymentSchema.safeParse({
      ...minimalValid,
      allocations: [
        {
          purchaseInvoiceId: "550e8400-e29b-41d4-a716-446655440002",
          amount: 1000,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an allocation with an invalid purchaseInvoiceId UUID", () => {
    const result = recordSupplierPaymentSchema.safeParse({
      ...minimalValid,
      allocations: [{ purchaseInvoiceId: "not-a-uuid", amount: 500 }],
    });
    expect(result.success).toBe(false);
  });
});
