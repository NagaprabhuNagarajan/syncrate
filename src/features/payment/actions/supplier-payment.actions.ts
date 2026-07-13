"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupplierPaymentService } from "@/features/payment/services/supplier-payment.service";
import { BillService } from "@/features/purchase/services/bill.service";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { recordSupplierPaymentSchema } from "@/features/payment/schemas/payment.schemas";
import type {
  OutstandingTransaction,
  PaymentActionResult,
  SupplierPayment,
  SupplierPaymentListResult,
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

export async function recordSupplierPaymentAction(
  organizationId: string,
  formData: FormData
): Promise<PaymentActionResult<SupplierPayment>> {
  const rawAllocations = parseAllocations(formData.get("allocations"));
  if (rawAllocations === null) {
    return invalid("Allocations field is malformed");
  }

  const candidate = {
    supplierId: formData.get("supplierId") ?? undefined,
    amount: formData.get("amount")
      ? Number(formData.get("amount"))
      : undefined,
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    referenceNumber: formData.get("referenceNumber") || undefined,
    paymentDate: formData.get("paymentDate") || undefined,
    notes: formData.get("notes") || undefined,
    allocations: rawAllocations,
  };

  const parsed = recordSupplierPaymentSchema.safeParse(candidate);
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.make");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierPaymentService(supabase);
  const result = await service.recordPayment(
    parsed.data,
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath("/payments");
    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "payment.make",
      entityType: "supplier_payment",
      entityId: result.data.id,
      summary: `Recorded supplier payment ${result.data.paymentNumber} for ${result.data.amount}`,
    });
  }

  return result;
}

/**
 * Read-side: a supplier's outstanding bills (balance due > 0) for the
 * make-payment dialog's "settle outstanding" picker. Gated on the same
 * `payment.make` permission used to record the payment. Never throws — an
 * auth failure returns a forbidden result, and a query error yields an empty
 * list via the repository.
 */
export async function getOutstandingSupplierBillsAction(
  organizationId: string,
  supplierId: string
): Promise<PaymentActionResult<readonly OutstandingTransaction[]>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.make");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new BillService(supabase);
  const bills = await service.listOutstandingBillsForSupplier(
    organizationId,
    supplierId
  );
  return { success: true, data: bills };
}

/**
 * Settles an outstanding bill using the supplier's unallocated advance credit.
 * Gated on `payment.make` (same as recording a payment — it moves money onto
 * the bill). Parses `supplierId`/`billId`/`amount` from the FormData, delegates
 * the re-allocation to the service (backed by the `apply_supplier_credit` RPC),
 * then audits and revalidates on success.
 */
export async function applySupplierCreditAction(
  organizationId: string,
  formData: FormData
): Promise<PaymentActionResult<void>> {
  const supplierId = formData.get("supplierId");
  const billId = formData.get("billId");
  const amountRaw = formData.get("amount");

  if (typeof supplierId !== "string" || supplierId.trim() === "") {
    return invalid("Supplier is required");
  }
  if (typeof billId !== "string" || billId.trim() === "") {
    return invalid("Bill is required");
  }

  const amount = typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalid("Amount must be greater than 0");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "payment.make");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new SupplierPaymentService(supabase);
  const result = await service.applyCredit(
    organizationId,
    supplierId,
    billId,
    amount,
    auth.userId
  );

  if (result.success) {
    revalidatePath(`/bills/${billId}`);
    revalidatePath("/bills");
    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "supplier_credit.apply",
      entityType: "bill",
      entityId: billId,
      summary: `Applied ${amount} supplier credit to bill ${billId}`,
    });
  }

  return result;
}

export async function listSupplierPaymentsAction(
  organizationId: string
): Promise<SupplierPaymentListResult> {
  const supabase = await createServerSupabaseClient();
  const service = new SupplierPaymentService(supabase);
  return service.listSupplierPayments(organizationId);
}
