import type { AppSupabaseClient } from "@/lib/supabase/types";
import { SupplierPaymentRepository } from "@/features/payment/repositories/supplier-payment.repository";
import type {
  PaymentActionResult,
  PaymentError,
  PaymentErrorCode,
  RecordSupplierPaymentInput,
  SupplierPayment,
  SupplierPaymentListParams,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): PaymentActionResult<T> {
  return { success: true, data };
}

function fail(
  code: PaymentErrorCode,
  message: string
): PaymentActionResult<never> {
  const error: PaymentError = { code, message };
  return { success: false, error };
}

function mapRpcError(message: string): PaymentErrorCode {
  if (message.includes("not_found")) {
    return "not_found";
  }
  if (message.includes("duplicate")) {
    return "duplicate";
  }
  return "unknown";
}

function generatePaymentNumber(existingCount: number, year: number): string {
  const sequence = String(existingCount + 1).padStart(6, "0");
  return `PAY-${year}-${sequence}`;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class SupplierPaymentService {
  private readonly repo: SupplierPaymentRepository;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new SupplierPaymentRepository(supabase);
  }

  async listSupplierPayments(
    orgId: string,
    params?: SupplierPaymentListParams
  ): Promise<SupplierPaymentListResult> {
    return this.repo.findAll(orgId, params);
  }

  async getSupplierPayment(
    id: string
  ): Promise<PaymentActionResult<SupplierPayment>> {
    const payment = await this.repo.findById(id);
    if (!payment) {
      return fail("not_found", "Payment not found");
    }
    return ok(payment);
  }

  async recordPayment(
    input: RecordSupplierPaymentInput,
    orgId: string,
    _userId: string
  ): Promise<PaymentActionResult<SupplierPayment>> {
    // Validate amount
    if (input.amount <= 0) {
      return fail("validation", "Payment amount must be greater than 0");
    }

    // Validate allocations don't exceed payment amount
    const totalAllocated = input.allocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );
    if (totalAllocated > input.amount) {
      return fail(
        "validation",
        `Total allocated amount (${totalAllocated}) exceeds payment amount (${input.amount})`
      );
    }

    // Generate payment number
    const year = new Date().getFullYear();
    const existingCount = await this.repo.countByOrg(orgId);
    const paymentNumber = generatePaymentNumber(existingCount, year);

    // Map allocations to RPC format
    const allocationsPayload = input.allocations.map((a) => ({
      purchase_invoice_id: a.purchaseInvoiceId,
      amount: a.amount,
    }));

    const { data, error } = await this.supabase.rpc(
      "record_supplier_payment",
      {
        p_org_id: orgId,
        p_supplier_id: input.supplierId,
        p_amount: input.amount,
        p_method: input.paymentMethod ?? null,
        p_reference: input.referenceNumber ?? null,
        p_payment_date: input.paymentDate ?? null,
        p_notes: input.notes ?? null,
        p_payment_number: paymentNumber,
        p_allocations: JSON.stringify(allocationsPayload),
      }
    );

    if (error) {
      const code = mapRpcError(error.message);
      const messages: Record<PaymentErrorCode, string> = {
        not_found: "Supplier or purchase invoice not found",
        duplicate: "A payment with this reference already exists",
        forbidden: "You do not have permission to record this payment",
        validation: error.message,
        unknown: "Failed to record payment. Please try again.",
      };
      return fail(code, messages[code]);
    }

    const paymentId = data as string;
    const payment = await this.repo.findById(paymentId);
    if (!payment) {
      return fail("unknown", "Payment was recorded but could not be retrieved");
    }
    return ok(payment);
  }
}
