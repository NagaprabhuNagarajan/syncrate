import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AuditService } from "@/features/audit/services/audit.service";
import { InvoiceSyncRepository } from "@/features/cbn/repositories/invoice-sync.repository";
import { DiscoveryRepository } from "@/features/cbn/repositories/discovery.repository";
import { resolveDocumentLines } from "@/features/cbn/services/line-resolution";
import type {
  CbnActionResult,
  CbnErrorCode,
  CbnInvoice,
  CbnInvoiceListParams,
  IncomingCbnInvoice,
  InvoiceLineMapping,
  ResolvedInvoiceLine,
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

export class InvoiceSyncService {
  private readonly repo: InvoiceSyncRepository;
  private readonly audit: AuditService;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new InvoiceSyncRepository(supabase);
    this.audit = new AuditService(supabase);
  }

  /**
   * Sends a posted invoice to a connected business via CBN.
   * The invoice must be in 'posted' status and the connection must be 'accepted'.
   */
  async sendInvoice(
    invoiceId: string,
    connectionId: string
  ): Promise<CbnActionResult<string>> {
    const { data, error } = await this.supabase.rpc("send_cbn_invoice", {
      p_invoice_id: invoiceId,
      p_connection_id: connectionId,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    const cbnInvoiceId = data as string;

    await this.audit.log({
      organizationId: connectionId, // best-effort; service caller should pass orgId if needed
      actorUserId: null,
      action: "cbn.invoice.send",
      entityType: "cbn_invoice",
      entityId: cbnInvoiceId,
      summary: `Sent invoice ${invoiceId} via connection ${connectionId}`,
    });

    return ok(cbnInvoiceId);
  }

  /**
   * Accepts a received CBN invoice, creating a draft purchase invoice.
   * Returns the new purchase invoice ID.
   */
  async acceptInvoice(
    cbnInvoiceId: string,
    buyerOrgId: string,
    lineMappings: readonly InvoiceLineMapping[],
    notes?: string
  ): Promise<CbnActionResult<string>> {
    const { data, error } = await this.supabase.rpc("accept_cbn_invoice", {
      p_cbn_invoice_id: cbnInvoiceId,
      p_buyer_org_id: buyerOrgId,
      p_notes: notes ?? null,
      p_line_mappings: lineMappings.map((m) => ({
        line_id: m.cbnInvoiceItemId,
        product_id: m.productId,
      })),
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    const purchaseInvoiceId = data as string;

    await this.audit.log({
      organizationId: buyerOrgId,
      actorUserId: null,
      action: "cbn.invoice.accept",
      entityType: "cbn_invoice",
      entityId: cbnInvoiceId,
      summary: `Accepted CBN invoice ${cbnInvoiceId}, created purchase invoice ${purchaseInvoiceId}`,
    });

    return ok(purchaseInvoiceId);
  }

  async rejectInvoice(
    cbnInvoiceId: string,
    buyerOrgId: string,
    reason: string
  ): Promise<CbnActionResult<void>> {
    const { error } = await this.supabase.rpc("reject_cbn_invoice", {
      p_cbn_invoice_id: cbnInvoiceId,
      p_buyer_org_id: buyerOrgId,
      p_reason: reason,
    });

    if (error) {
      return fail(mapRpcError(error.message), error.message);
    }

    await this.audit.log({
      organizationId: buyerOrgId,
      actorUserId: null,
      action: "cbn.invoice.reject",
      entityType: "cbn_invoice",
      entityId: cbnInvoiceId,
      summary: `Rejected CBN invoice ${cbnInvoiceId}: ${reason}`,
    });

    return ok(undefined);
  }

  async listSent(
    orgId: string,
    params?: CbnInvoiceListParams
  ): Promise<CbnInvoice[]> {
    return this.repo.listBySenderOrg(orgId, params);
  }

  async listReceived(
    orgId: string,
    params?: CbnInvoiceListParams
  ): Promise<CbnInvoice[]> {
    return this.repo.listByReceiverOrg(orgId, params);
  }

  /** Delegates to the shared resolver; see line-resolution.ts. */
  async resolveIncomingLines(
    cbnInvoiceId: string,
    buyerOrgId: string,
    connectionId: string
  ): Promise<CbnActionResult<readonly ResolvedInvoiceLine[]>> {
    return resolveDocumentLines(
      this.supabase,
      cbnInvoiceId,
      buyerOrgId,
      connectionId,
      "invoice"
    );
  }

  /**
   * Pending invoices awaiting this org's decision, each resolved to the sending
   * business's display name. The organizations table is member-only, so the
   * name comes from the public-profile RPC; a lookup miss degrades to the raw
   * org ID rather than dropping the invoice from the inbox.
   */
  async listPendingIncoming(
    orgId: string
  ): Promise<readonly IncomingCbnInvoice[]> {
    const invoices = await this.repo.listByReceiverOrg(orgId, {
      status: "pending",
    });
    if (invoices.length === 0) {
      return [];
    }

    const discovery = new DiscoveryRepository(this.supabase);
    const senderIds = [...new Set(invoices.map((i) => i.organizationId))];
    const profiles = await Promise.all(
      senderIds.map((id) => discovery.getPublicProfile(id))
    );

    const names = new Map<string, string>();
    senderIds.forEach((id, index) => {
      names.set(id, profiles[index]?.name ?? id);
    });

    return invoices.map((invoice) => ({
      invoice,
      senderName: names.get(invoice.organizationId) ?? invoice.organizationId,
    }));
  }
}
