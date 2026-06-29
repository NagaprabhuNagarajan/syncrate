import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { PurchaseSyncRepository } from "@/features/cbn/repositories/purchase-sync.repository";
import type {
  CbnActionResult,
  CbnErrorCode,
  CbnPoListParams,
  CbnPurchaseOrder,
} from "@/features/cbn/types/cbn.types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): CbnActionResult<T> {
  return { success: true, data };
}

function fail(code: CbnErrorCode, message: string): CbnActionResult<never> {
  return { success: false, error: { code, message } };
}

function mapRpcError(message: string): CbnErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("not_found")) {return "not_found";}
  if (lower.includes("permission_denied")) {return "permission_denied";}
  if (lower.includes("invalid_status")) {return "invalid_status";}
  if (lower.includes("duplicate")) {return "duplicate";}
  if (lower.includes("prerequisite")) {return "prerequisite";}
  if (lower.includes("validation")) {return "validation";}
  return "unknown";
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class PurchaseSyncService {
  private readonly repo: PurchaseSyncRepository;
  private readonly audit: AuditService;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new PurchaseSyncRepository(supabase);
    this.audit = new AuditService(supabase);
  }

  async sendPurchaseOrder(
    poId: string,
    connectionId: string
  ): Promise<CbnActionResult<string>> {
    const { data, error } = await this.supabase.rpc("send_cbn_purchase_order", {
      p_po_id: poId,
      p_connection_id: connectionId,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    const cbnPoId = data as string;

    await this.audit.log({
      organizationId: connectionId,
      actorUserId: null,
      action: "cbn.purchase_order.send",
      entityType: "cbn_purchase_order",
      entityId: cbnPoId,
      summary: `Sent PO ${poId} via connection ${connectionId}`,
    });

    return ok(cbnPoId);
  }

  async acceptPurchaseOrder(
    cbnPoId: string,
    supplierOrgId: string,
    notes?: string
  ): Promise<CbnActionResult<string>> {
    const { data, error } = await this.supabase.rpc(
      "accept_cbn_purchase_order",
      {
        p_cbn_po_id: cbnPoId,
        p_supplier_org_id: supplierOrgId,
        p_notes: notes ?? null,
      }
    );

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    const salesOrderId = data as string;

    await this.audit.log({
      organizationId: supplierOrgId,
      actorUserId: null,
      action: "cbn.purchase_order.accept",
      entityType: "cbn_purchase_order",
      entityId: cbnPoId,
      summary: `Accepted CBN PO ${cbnPoId}, created sales order ${salesOrderId}`,
    });

    return ok(salesOrderId);
  }

  async rejectPurchaseOrder(
    cbnPoId: string,
    supplierOrgId: string,
    reason: string
  ): Promise<CbnActionResult<void>> {
    const { error } = await this.supabase.rpc("reject_cbn_purchase_order", {
      p_cbn_po_id: cbnPoId,
      p_supplier_org_id: supplierOrgId,
      p_reason: reason,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: supplierOrgId,
      actorUserId: null,
      action: "cbn.purchase_order.reject",
      entityType: "cbn_purchase_order",
      entityId: cbnPoId,
      summary: `Rejected CBN PO ${cbnPoId}: ${reason}`,
    });

    return ok(undefined);
  }

  async listSent(
    orgId: string,
    params?: CbnPoListParams
  ): Promise<CbnPurchaseOrder[]> {
    return this.repo.listBySenderOrg(orgId, params);
  }

  async listReceived(
    orgId: string,
    params?: CbnPoListParams
  ): Promise<CbnPurchaseOrder[]> {
    return this.repo.listByReceiverOrg(orgId, params);
  }
}
