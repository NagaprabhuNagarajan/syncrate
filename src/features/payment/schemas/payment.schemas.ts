import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Payment method
// ─────────────────────────────────────────────────────────────

export const paymentMethodSchema = z.enum([
  "cash",
  "upi",
  "bank_transfer",
  "cheque",
  "credit_card",
  "debit_card",
  "wallet",
  "other",
]);

// ─────────────────────────────────────────────────────────────
// Allocation schemas
// ─────────────────────────────────────────────────────────────

const invoiceAllocationSchema = z.object({
  invoiceId: z.string().uuid("Invoice ID must be a valid UUID"),
  amount: z.number().positive("Allocated amount must be greater than 0"),
});

const purchaseInvoiceAllocationSchema = z.object({
  purchaseInvoiceId: z
    .string()
    .uuid("Purchase invoice ID must be a valid UUID"),
  amount: z.number().positive("Allocated amount must be greater than 0"),
});

// ─────────────────────────────────────────────────────────────
// Record customer payment
// ─────────────────────────────────────────────────────────────

export const recordCustomerPaymentSchema = z.object({
  customerId: z.string().uuid("Customer ID must be a valid UUID"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Payment amount must be greater than 0")
    .max(99_999_999_999, "Amount is too large"),
  paymentMethod: paymentMethodSchema,
  referenceNumber: z
    .string()
    .max(100, "Reference number must be 100 characters or less")
    .trim()
    .optional(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format")
    .optional(),
  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or less")
    .trim()
    .optional(),
  allocations: z
    .array(invoiceAllocationSchema)
    .default([]),
});

export type RecordCustomerPaymentFormValues = z.infer<
  typeof recordCustomerPaymentSchema
>;

// ─────────────────────────────────────────────────────────────
// Record supplier payment
// ─────────────────────────────────────────────────────────────

export const recordSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid("Supplier ID must be a valid UUID"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Payment amount must be greater than 0")
    .max(99_999_999_999, "Amount is too large"),
  paymentMethod: paymentMethodSchema,
  referenceNumber: z
    .string()
    .max(100, "Reference number must be 100 characters or less")
    .trim()
    .optional(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format")
    .optional(),
  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or less")
    .trim()
    .optional(),
  allocations: z
    .array(purchaseInvoiceAllocationSchema)
    .default([]),
});

export type RecordSupplierPaymentFormValues = z.infer<
  typeof recordSupplierPaymentSchema
>;
