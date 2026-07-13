"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CustomerPaymentService } from "@/features/payment/services/customer-payment.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { DomainEventService } from "@/features/events/services/domain-event.service";
import { DOMAIN_EVENTS } from "@/features/events/domain-events";
import { recordCustomerPaymentSchema } from "@/features/payment/schemas/payment.schemas";
import type {
  CustomerPayment,
  CustomerPaymentListResult,
  OutstandingTransaction,
  PaymentActionResult,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): PaymentActionResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): PaymentActionResult<never> {
  return { success: false, error: { code: "validation", message } };
}

function parseAllocations(
  value: FormDataEntryValue | null
): unknown[] | null {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: PaymentActionResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

export async function recordCustomerPaymentAction(
  organizationId: string,
  formData: FormData
): Promise<PaymentActionResult<CustomerPayment>> {
  const rawAllocations = parseAllocations(formData.get("allocations"));
  if (rawAllocations === null) {
    return invalid("Allocations field is malformed");
  }

  const candidate = {
    customerId: formData.get("customerId") ?? undefined,
    amount: formData.get("amount")
      ? Number(formData.get("amount"))
      : undefined,
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    referenceNumber: formData.get("referenceNumber") || undefined,
    paymentDate: formData.get("paymentDate") || undefined,
    notes: formData.get("notes") || undefined,
    allocations: rawAllocations,
  };

  const parsed = recordCustomerPaymentSchema.safeParse(candidate);
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.receive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerPaymentService(supabase);
  const result = await service.recordPayment(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/payments");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "payment.receive",
      entityType: "customer_payment",
      entityId: result.data.id,
      summary: `Recorded customer payment ${result.data.paymentNumber} for ${result.data.amount}`,
    });
    // Fire automation (webhooks + matching workflows). Best-effort.
    await new DomainEventService(supabase).emit({
      organizationId,
      eventType: DOMAIN_EVENTS.CUSTOMER_PAYMENT_RECORDED,
      entityType: "customer_payment",
      entityId: result.data.id,
      actorUserId: auth.userId,
      payload: {
        paymentId: result.data.id,
        paymentNumber: result.data.paymentNumber,
        customerId: result.data.customerId,
        amount: result.data.amount,
      },
    });
  }

  return result;
}

/**
 * Read-side: a customer's outstanding invoices (balance due > 0) for the
 * record-payment dialog's "settle outstanding" picker. Gated on the same
 * `payment.receive` permission used to record the payment. Never throws — an
 * auth failure returns a forbidden result, and a query error yields an empty
 * list via the repository.
 */
export async function getOutstandingCustomerInvoicesAction(
  organizationId: string,
  customerId: string
): Promise<PaymentActionResult<readonly OutstandingTransaction[]>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.receive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new InvoiceService(supabase);
  const invoices = await service.listOutstandingInvoicesForCustomer(
    organizationId,
    customerId
  );
  return { success: true, data: invoices };
}

/**
 * Settles an outstanding invoice using the customer's unallocated advance
 * credit. Gated on `payment.receive` (same as recording a payment — it moves
 * money onto the invoice). Parses `customerId`/`invoiceId`/`amount` from the
 * FormData, delegates the re-allocation to the service (backed by the
 * `apply_customer_credit` RPC), then audits and revalidates on success.
 */
export async function applyCustomerCreditAction(
  organizationId: string,
  formData: FormData
): Promise<PaymentActionResult<void>> {
  const customerId = formData.get("customerId");
  const invoiceId = formData.get("invoiceId");
  const amountRaw = formData.get("amount");

  if (typeof customerId !== "string" || customerId.trim() === "") {
    return invalid("Customer is required");
  }
  if (typeof invoiceId !== "string" || invoiceId.trim() === "") {
    return invalid("Invoice is required");
  }

  const amount = typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalid("Amount must be greater than 0");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.receive");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new CustomerPaymentService(supabase);
  const result = await service.applyCredit(
    organizationId,
    customerId,
    invoiceId,
    amount,
    auth.userId
  );

  if (result.success) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "customer_credit.apply",
      entityType: "invoice",
      entityId: invoiceId,
      summary: `Applied ${amount} customer credit to invoice ${invoiceId}`,
    });
  }

  return result;
}

export async function listCustomerPaymentsAction(
  organizationId: string
): Promise<CustomerPaymentListResult> {
  const supabase = await createServerSupabaseClient();
  const service = new CustomerPaymentService(supabase);
  return service.listCustomerPayments(organizationId);
}
